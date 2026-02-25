import type {
  CadengConfig,
  ModelConfig,
  RegistryEntry,
  RenderConfig,
} from "./types.ts";
import { getCameraString } from "./config.ts";

interface SpawnResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration_ms: number;
}

async function spawnCommand(
  command: string | string[],
  cwd?: string
): Promise<SpawnResult> {
  const start = performance.now();
  const parts = Array.isArray(command) ? command : command.split(/\s+/);
  const proc = Bun.spawn(parts, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  const duration_ms = Math.round(performance.now() - start);

  return {
    success: exitCode === 0,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode,
    duration_ms,
  };
}

export async function runBuild(
  config: CadengConfig
): Promise<SpawnResult> {
  return spawnCommand(config.python.build_command, config.python.build_cwd);
}

export async function runRegistryList(
  config: CadengConfig
): Promise<{ entries: RegistryEntry[]; error?: string }> {
  const result = await spawnCommand(
    config.python.registry_command,
    config.python.build_cwd
  );

  if (!result.success) {
    return {
      entries: [],
      error: `Registry command failed (exit ${result.exitCode}): ${result.stderr}`,
    };
  }

  try {
    const entries = JSON.parse(result.stdout) as RegistryEntry[];
    return { entries };
  } catch {
    return {
      entries: [],
      error: `Registry command output is not valid JSON: ${result.stdout.slice(0, 200)}`,
    };
  }
}

export async function runScreenshot(
  scadPath: string,
  outputPath: string,
  cameraString: string,
  render: RenderConfig
): Promise<SpawnResult> {
  const args = [
    "openscad",
    `--imgsize=${render.resolution[0]},${render.resolution[1]}`,
    `--camera=${cameraString}`,
    `--colorscheme=${render.colorscheme}`,
    `-D$fn=${render.fn}`,
  ];

  if (render.autocenter) args.push("--autocenter");
  if (render.viewall) args.push("--viewall");

  args.push("-o", outputPath, scadPath);

  return spawnCommand(args);
}

export async function runScreenshotForModel(
  model: ModelConfig,
  angleName: string,
  config: CadengConfig,
  options?: { scadOverride?: string; cameraAngle?: string }
): Promise<SpawnResult & { outputPath: string }> {
  const cameraAngle = options?.cameraAngle || angleName;
  const cameraString = getCameraString(cameraAngle, model, config);
  if (!cameraString) {
    return {
      success: false,
      stdout: "",
      stderr: `Camera angle '${cameraAngle}' not defined`,
      exitCode: -1,
      duration_ms: 0,
      outputPath: "",
    };
  }

  const scadPath = options?.scadOverride || model.scad;
  const outputPath = `${config.project.build_dir}/${model.type}-${model.name}-${angleName}.png`;
  const result = await runScreenshot(
    scadPath,
    outputPath,
    cameraString,
    config.render
  );
  return { ...result, outputPath };
}

export async function runStlExport(
  scadPath: string,
  outputPath: string,
  fn: number
): Promise<SpawnResult> {
  return spawnCommand([
    "openscad",
    `-D$fn=${fn}`,
    "-o",
    outputPath,
    scadPath,
  ]);
}

export async function runScaledStlExport(
  scadPath: string,
  outputPath: string,
  scale: number,
  fn: number
): Promise<SpawnResult> {
  if (scale === 100) {
    return runStlExport(scadPath, outputPath, fn);
  }

  const file = Bun.file(scadPath);
  if (!(await file.exists())) {
    return {
      success: false,
      stdout: "",
      stderr: `Source SCAD not found: ${scadPath}`,
      exitCode: -1,
      duration_ms: 0,
    };
  }

  // Use an absolute path for the include so OpenSCAD can resolve it
  const { resolve } = require("path");
  const absoluteScad = resolve(scadPath);
  const factor = scale / 100;
  const wrapperContent = `scale([${factor}, ${factor}, ${factor}]) {\n  include <${absoluteScad}>;\n}\n`;

  const wrapperPath = outputPath.replace(".stl", "_scale_tmp.scad");
  await Bun.write(wrapperPath, wrapperContent);

  const result = await runStlExport(wrapperPath, outputPath, fn);

  // Clean up temp file
  try {
    const { unlinkSync } = require("fs");
    unlinkSync(wrapperPath);
  } catch {
    // Ignore cleanup failures
  }

  return result;
}
