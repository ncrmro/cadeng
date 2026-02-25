import { resolve } from "path";
import { mkdirSync, readdirSync, statSync } from "fs";
import { parseConfigAsync, resolveAngles, validateRegistry } from "./config.ts";
import {
  runBuild,
  runRegistryList,
  runScreenshotForModel,
} from "./python.ts";
import type { ServerWebSocket } from "bun";
import {
  broadcast,
  createWebSocketHandler,
  sendTo,
  setHandlers,
  type WsData,
} from "./websocket.ts";
import { handleRequest } from "./routes.ts";
import { createWatcher, stopWatchers } from "./watcher.ts";
import type { BuildState, CadengConfig, ModelConfig } from "./types.ts";

const CONFIG_PATH = resolve("cadeng.yaml");

const state: BuildState = {
  building: false,
  rendering: false,
  lastBuild: null,
  lastValidation: null,
  stlCache: new Map(),
  stlLocks: new Map(),
};

let pipelineLock = false;

// Screenshot name pattern: {type}-{name}-{angle}.png
// Angle can be simple (iso, front) or variant (exploded_iso, exploded_front)
const SCREENSHOT_RE = /^(vitamin_assembly|vitamin|component|assembly)-(.+)-([a-z]+(?:_[a-z]+)*)\.png$/;

function scanExistingScreenshots(config: CadengConfig) {
  const screenshots: { model: string; angle: string; path: string; mtime: number }[] = [];
  try {
    const files = readdirSync(config.project.build_dir);
    for (const file of files) {
      const match = file.match(SCREENSHOT_RE);
      if (!match) continue;
      const [, , model, angle] = match;
      // Only include screenshots for models in config
      if (!config.models.some((m) => m.name === model)) continue;
      const fullPath = `${config.project.build_dir}/${file}`;
      const mtime = statSync(fullPath).mtimeMs;
      screenshots.push({ model, angle, path: fullPath, mtime });
    }
  } catch {
    // Build dir may not exist yet
  }
  return screenshots;
}

function broadcastExistingScreenshots(config: CadengConfig) {
  const screenshots = scanExistingScreenshots(config);
  for (const ss of screenshots) {
    broadcast({
      type: "screenshot_updated",
      model: ss.model,
      angle: ss.angle,
      path: ss.path,
      mtime: ss.mtime,
    });
  }
  if (screenshots.length > 0) {
    console.log(`[startup] Sent ${screenshots.length} existing screenshots`);
  }
}

function sendExistingScreenshotsTo(ws: ServerWebSocket<WsData>, config: CadengConfig) {
  const screenshots = scanExistingScreenshots(config);
  for (const ss of screenshots) {
    sendTo(ws, {
      type: "screenshot_updated",
      model: ss.model,
      angle: ss.angle,
      path: ss.path,
      mtime: ss.mtime,
    });
  }
  // Also send last validation if available
  if (state.lastValidation) {
    sendTo(ws, {
      type: "validation",
      warnings: state.lastValidation.warnings,
      valid_models: state.lastValidation.valid_models,
    });
  }
}

async function runPipeline(config: CadengConfig, models?: string[]) {
  if (pipelineLock) {
    console.log("[pipeline] Already running, skipping");
    return;
  }
  pipelineLock = true;

  try {
    // Ensure build directory exists
    mkdirSync(config.project.build_dir, { recursive: true });

    // Phase 1: Build
    state.building = true;
    broadcast({
      type: "build_start",
      command: config.python.build_command,
    });
    console.log(`[build] Running: ${config.python.build_command}`);

    const buildResult = await runBuild(config);
    state.building = false;
    state.lastBuild = Date.now();

    broadcast({
      type: "build_complete",
      success: buildResult.success,
      error: buildResult.success ? undefined : buildResult.stderr,
      duration_ms: buildResult.duration_ms,
    });

    if (!buildResult.success) {
      console.error(`[build] Failed: ${buildResult.stderr}`);
      broadcast({
        type: "error",
        message: `Build failed: ${buildResult.stderr}`,
        context: "build",
      });
      return;
    }
    console.log(`[build] Complete (${buildResult.duration_ms}ms)`);

    // Phase 2: Registry validation
    const registryResult = await runRegistryList(config);
    if (registryResult.error) {
      console.warn(`[registry] ${registryResult.error}`);
      broadcast({
        type: "error",
        message: registryResult.error,
        context: "registry",
      });
    }

    const validation = validateRegistry(
      registryResult.entries,
      config.models
    );
    state.lastValidation = validation;

    if (validation.warnings.length > 0) {
      for (const w of validation.warnings) {
        const label =
          w.issue === "not_in_registry"
            ? "stale config (not in registry)"
            : "undeclared (not in cadeng.yaml)";
        console.warn(`[validation] Model '${w.model}': ${label}`);
      }
    }

    broadcast({
      type: "validation",
      warnings: validation.warnings,
      valid_models: validation.valid_models,
    });

    console.log(
      `[validation] ${validation.valid_models.length} valid, ${validation.warnings.length} warnings`
    );

    // Phase 3: Render screenshots
    const targetModels = config.models.filter((m) => {
      if (!validation.valid_models.includes(m.name)) return false;
      if (models && !models.includes(m.name)) return false;
      return true;
    });

    const renderJobs: { model: ModelConfig; angle: string; scadOverride?: string; cameraAngle?: string }[] = [];
    for (const model of targetModels) {
      const angles = resolveAngles(model, config);
      for (const angle of angles) {
        renderJobs.push({ model, angle });
      }
      // Add variant render jobs (rendered as extra angles within the same model)
      if (model.variants) {
        for (const variant of model.variants) {
          const variantAngles = resolveAngles({ ...model, angles: variant.angles }, config);
          for (const cameraAngle of variantAngles) {
            renderJobs.push({
              model,
              angle: `${variant.name}_${cameraAngle}`,
              scadOverride: variant.scad,
              cameraAngle,
            });
          }
        }
      }
    }

    if (renderJobs.length === 0) {
      console.log("[render] No valid models to render");
      return;
    }

    state.rendering = true;
    broadcast({
      type: "render_start",
      models: targetModels.map((m) => m.name),
      totalAngles: renderJobs.length,
    });

    const renderStart = performance.now();

    for (let i = 0; i < renderJobs.length; i++) {
      const { model, angle, scadOverride, cameraAngle } = renderJobs[i];
      broadcast({
        type: "render_progress",
        model: model.name,
        angle,
        current: i + 1,
        total: renderJobs.length,
      });

      console.log(
        `[render] ${model.name}/${angle} (${i + 1}/${renderJobs.length})`
      );

      const result = await runScreenshotForModel(
        model,
        angle,
        config,
        scadOverride ? { scadOverride, cameraAngle } : undefined
      );
      if (result.success) {
        const mtime = Date.now();
        broadcast({
          type: "screenshot_updated",
          model: model.name,
          angle,
          path: result.outputPath,
          mtime,
        });
      } else {
        console.error(
          `[render] Failed ${model.name}/${angle}: ${result.stderr}`
        );
        broadcast({
          type: "error",
          message: `Render failed for ${model.name}/${angle}: ${result.stderr}`,
          context: "render",
        });
      }
    }

    state.rendering = false;
    const renderDuration = Math.round(performance.now() - renderStart);
    broadcast({ type: "render_complete", duration_ms: renderDuration });
    console.log(`[render] Complete (${renderDuration}ms)`);
  } catch (err) {
    console.error(
      `[pipeline] Error: ${err instanceof Error ? err.message : err}`
    );
    broadcast({
      type: "error",
      message: `Pipeline error: ${err instanceof Error ? err.message : err}`,
    });
  } finally {
    state.building = false;
    state.rendering = false;
    pipelineLock = false;
  }
}

async function main() {
  console.log("[cadeng] Loading config...");
  const config = await parseConfigAsync(CONFIG_PATH);
  console.log(`[cadeng] Project: ${config.project.name}`);
  console.log(`[cadeng] Build dir: ${config.project.build_dir}`);
  console.log(`[cadeng] Models: ${config.models.map((m) => m.name).join(", ")}`);

  // Set up WebSocket command handlers
  setHandlers({
    onRebuild: () => runPipeline(config),
    onRender: (models) => runPipeline(config, models),
    onStlRequest: (model, scale) => {
      console.log(`[ws] STL request: ${model} scale=${scale || 100}`);
    },
    onClientConnected: (ws) => sendExistingScreenshotsTo(ws, config),
  });

  const wsHandler = createWebSocketHandler(config);

  // Start Bun server
  let server: ReturnType<typeof Bun.serve<WsData>>;
  try {
    server = Bun.serve<WsData>({
      port: parseInt(process.env.PORT || "") || config.project.port,
      async fetch(req, server) {
        // WebSocket upgrade
        if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
          const id = crypto.randomUUID();
          const success = server.upgrade(req, { data: { id } });
          if (success) return undefined;
          return new Response("WebSocket upgrade failed", { status: 400 });
        }

        // HTTP routes
        const response = await handleRequest(req, config, state);
        if (response) return response;

        return new Response("Not Found", { status: 404 });
      },
      websocket: wsHandler,
    });
  } catch (err) {
    throw new Error(
      `Failed to start server on port ${parseInt(process.env.PORT || "") || config.project.port}: ${err instanceof Error ? err.message : err}`
    );
  }

  console.log(
    `[cadeng] Server running at http://localhost:${server.port}`
  );

  // Start file watcher
  const watchers = createWatcher(config, () => runPipeline(config));

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[cadeng] Shutting down...");
    stopWatchers(watchers);
    server.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("[cadeng] Shutting down...");
    stopWatchers(watchers);
    server.stop();
    process.exit(0);
  });

  // Send any pre-existing screenshots to early-connecting clients
  broadcastExistingScreenshots(config);

  // Run initial pipeline
  console.log("[cadeng] Running initial build pipeline...");
  await runPipeline(config);

  // Broadcast screenshots again — picks up anything the pipeline just rendered
  broadcastExistingScreenshots(config);
  console.log("[cadeng] Ready.");
}

main().catch((err) => {
  console.error(`[cadeng] Fatal: ${err.message}`);
  process.exit(1);
});
