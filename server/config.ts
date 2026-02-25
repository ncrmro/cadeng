import { readFileSync } from "fs";
import type {
  CadengConfig,
  ModelConfig,
  ProjectGroup,
  RegistryEntry,
  ValidationResult,
  ValidationWarning,
} from "./types.ts";

export function parseConfig(configPath: string): CadengConfig {
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch {
    throw new Error(
      `cadeng.yaml not found at ${configPath}. Create one or check the path.`
    );
  }

  let parsed: any;
  try {
    if (typeof (globalThis as any).Bun !== "undefined") {
      parsed = require("js-yaml")?.load?.(raw);
      if (!parsed) {
        parsed = JSON.parse(
          JSON.stringify(
            new Function(
              "return " + raw.replace(/^---\n/, "").replace(/\n---$/, "")
            )()
          )
        );
      }
    }
  } catch {
    // Bun native YAML parsing: import the file directly
  }

  if (!parsed) {
    try {
      const yamlModule = require(configPath);
      parsed = yamlModule.default || yamlModule;
    } catch {
      throw new Error(
        `Failed to parse cadeng.yaml. Check YAML syntax at ${configPath}.`
      );
    }
  }

  return validateConfig(parsed);
}

export async function parseConfigAsync(
  configPath: string
): Promise<CadengConfig> {
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    throw new Error(
      `cadeng.yaml not found at ${configPath}. Create one or check the path.`
    );
  }

  const raw = await file.text();
  try {
    const mod = await import(configPath);
    const parsed = mod.default || mod;
    return validateConfig(parsed);
  } catch (e) {
    throw new Error(
      `Failed to parse cadeng.yaml: ${e instanceof Error ? e.message : e}`
    );
  }
}

function validateConfig(parsed: any): CadengConfig {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("cadeng.yaml is empty or not a valid YAML object.");
  }

  const required = ["project", "python", "render", "cameras", "camera_sets", "models"];
  for (const key of required) {
    if (!(key in parsed)) {
      throw new Error(`cadeng.yaml missing required section: '${key}'`);
    }
  }

  if (!parsed.project?.name) {
    throw new Error("cadeng.yaml: project.name is required");
  }
  if (!parsed.project?.build_dir) {
    throw new Error("cadeng.yaml: project.build_dir is required");
  }
  if (!parsed.project?.port) {
    parsed.project.port = 9090;
  }

  if (!parsed.python?.build_command) {
    throw new Error("cadeng.yaml: python.build_command is required");
  }
  if (!parsed.python?.registry_command) {
    throw new Error("cadeng.yaml: python.registry_command is required");
  }

  if (!parsed.stl) {
    parsed.stl = { scales: [100] };
  }

  // Validate and normalize projects
  const modelNames = new Set((parsed.models as ModelConfig[]).map((m) => m.name));
  if (parsed.projects) {
    if (!Array.isArray(parsed.projects)) {
      throw new Error("cadeng.yaml: 'projects' must be an array");
    }
    for (const proj of parsed.projects) {
      if (!proj.name || typeof proj.name !== "string") {
        throw new Error("cadeng.yaml: each project requires a 'name' string");
      }
      if (!Array.isArray(proj.models)) {
        throw new Error(`cadeng.yaml: project '${proj.name}' requires a 'models' array`);
      }
      if (!proj.label) {
        proj.label = proj.name
          .split(/[-_]/)
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      }
      for (const ref of proj.models) {
        if (!modelNames.has(ref)) {
          console.warn(
            `Warning: Project '${proj.name}' references unknown model '${ref}'. ` +
              `Available models: ${[...modelNames].join(", ")}`
          );
        }
      }
    }
  } else {
    parsed.projects = [];
  }

  // Validate model camera set references
  for (const model of parsed.models as ModelConfig[]) {
    if (model.angles && !(model.angles in parsed.camera_sets)) {
      console.warn(
        `Warning: Model '${model.name}' references unknown camera set '${model.angles}'. ` +
          `Available sets: ${Object.keys(parsed.camera_sets).filter((k) => k !== "default").join(", ")}`
      );
    }
  }

  return parsed as CadengConfig;
}

export function resolveAngles(
  model: ModelConfig,
  config: CadengConfig
): string[] {
  const setName =
    model.angles || config.camera_sets.default || "standard";
  const angleNames = config.camera_sets[setName];
  if (!angleNames) {
    console.warn(
      `Camera set '${setName}' not found for model '${model.name}'. Using 'iso' only.`
    );
    return ["iso"];
  }
  return angleNames;
}

export function getCameraString(
  angleName: string,
  model: ModelConfig,
  config: CadengConfig
): string {
  const base = config.cameras[angleName];
  if (!base) {
    console.warn(`Camera angle '${angleName}' not defined. Skipping.`);
    return "";
  }
  if (model.camera_distance !== undefined) {
    const parts = base.split(",");
    parts[parts.length - 1] = String(model.camera_distance);
    return parts.join(",");
  }
  return base;
}

export function validateRegistry(
  registryEntries: RegistryEntry[],
  configModels: ModelConfig[]
): ValidationResult {
  const registryNames = new Set(registryEntries.map((e) => e.name));
  const configNames = new Set(configModels.map((m) => m.name));

  const variantRegistryNames = new Set<string>();
  for (const model of configModels) {
    if (model.variants) {
      for (const variant of model.variants) {
        const scadStem = variant.scad.split("/").pop()?.replace(".scad", "");
        if (scadStem) variantRegistryNames.add(scadStem);
      }
    }
  }

  const warnings: ValidationWarning[] = [];

  for (const model of configModels) {
    if (!registryNames.has(model.name)) {
      warnings.push({ model: model.name, issue: "not_in_registry" });
    }
  }

  for (const entry of registryEntries) {
    if (!configNames.has(entry.name) && !variantRegistryNames.has(entry.name)) {
      warnings.push({ model: entry.name, issue: "not_in_config" });
    }
  }

  const valid_models = configModels
    .filter((m) => registryNames.has(m.name))
    .map((m) => m.name);

  return { warnings, valid_models };
}
