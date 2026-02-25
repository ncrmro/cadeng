import { resolve } from "path";
import { statSync, existsSync } from "fs";
import type { CadengConfig, BuildState, ModelConfig } from "./types.ts";
import { runScaledStlExport, runStlExport } from "./python.ts";
import { broadcast } from "./websocket.ts";

// When installed via Nix, CADENG_CLIENT_DIR points to the client assets
// in the Nix store. In dev mode, falls back to CWD-relative client/.
const CLIENT_DIR = process.env.CADENG_CLIENT_DIR || resolve("client");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".ts": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".stl": "application/octet-stream",
  ".scad": "text/plain",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
};

function getMimeType(path: string): string {
  const ext = "." + path.split(".").pop();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function noCache(response: Response): Response {
  response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  return response;
}

export async function handleRequest(
  req: Request,
  config: CadengConfig,
  state: BuildState
): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;

  // Gallery root
  if (path === "/" || path === "/index.html") {
    return serveFile(resolve(CLIENT_DIR, "index.html"));
  }

  // Client assets
  if (path.startsWith("/client/")) {
    const filename = path.slice("/client/".length); // e.g. "gallery.ts" or "style.css"
    const filePath = resolve(CLIENT_DIR, filename);

    // For .ts files: serve pre-compiled .js if available, otherwise Bun transpile
    if (filename.endsWith(".ts")) {
      const jsPath = filePath.replace(/\.ts$/, ".js");
      if (existsSync(jsPath)) {
        return serveFile(jsPath);
      }
      return serveBunTranspiled(filePath);
    }
    return serveFile(filePath);
  }

  // API endpoints
  if (path === "/api/config") {
    return Response.json(config);
  }

  if (path === "/api/models") {
    const models = config.models.map((m) => ({
      ...m,
      valid: state.lastValidation?.valid_models.includes(m.name) ?? true,
      warnings: state.lastValidation?.warnings.filter(
        (w) => w.model === m.name
      ),
    }));
    return Response.json(models);
  }

  if (path === "/api/status") {
    return Response.json({
      building: state.building,
      rendering: state.rendering,
      lastBuild: state.lastBuild,
      lastValidation: state.lastValidation,
    });
  }

  // STL downloads
  if (path.startsWith("/stl/")) {
    return handleStlRequest(path, url, config, state);
  }

  // Build artifacts
  if (path.startsWith("/build/")) {
    const relativePath = path.slice(1); // Remove leading /
    // Path traversal protection
    if (relativePath.includes("..")) {
      return new Response("Forbidden", { status: 403 });
    }
    // Map /build/* to the configured build_dir
    const filePath =
      config.project.build_dir +
      path.slice("/build".length);
    return noCache(await serveFileOrNotFound(filePath));
  }

  // Not handled by routes
  return null;
}

async function handleStlRequest(
  path: string,
  url: URL,
  config: CadengConfig,
  state: BuildState
): Promise<Response> {
  const modelName = path.slice("/stl/".length);
  const model = config.models.find(
    (m) => m.name === modelName && m.stl
  );

  if (!model) {
    return Response.json(
      {
        error: `Model '${modelName}' not found or STL not enabled`,
        available: config.models.filter((m) => m.stl).map((m) => m.name),
      },
      { status: 404 }
    );
  }

  // Check source SCAD exists
  const scadFile = Bun.file(model.scad);
  if (!(await scadFile.exists())) {
    return Response.json(
      {
        error: `Source SCAD not found: ${model.scad}. Run a build first.`,
      },
      { status: 404 }
    );
  }

  const scaleParam = url.searchParams.get("scale");
  const scale = scaleParam ? parseInt(scaleParam, 10) : 100;

  if (scale !== 100 && !config.stl.scales.includes(scale)) {
    return Response.json(
      {
        error: `Scale ${scale}% not available`,
        available_scales: config.stl.scales,
      },
      { status: 400 }
    );
  }

  const suffix = scale === 100 ? "" : `-${scale}pct`;
  const stlPath = `${config.project.build_dir}/${model.name}${suffix}.stl`;
  const cacheKey = `${model.name}-${scale}`;

  // Check cache
  const sourceMtime = getFileMtime(model.scad);
  const cached = state.stlCache.get(cacheKey);

  if (cached && cached.sourceMtime === sourceMtime) {
    const file = Bun.file(cached.path);
    if (await file.exists()) {
      return new Response(file, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${model.name}${suffix}.stl"`,
        },
      });
    }
  }

  // Check for concurrent generation
  const existingLock = state.stlLocks.get(cacheKey);
  if (existingLock) {
    const resultPath = await existingLock;
    return serveStlFile(resultPath, `${model.name}${suffix}.stl`);
  }

  // Generate STL
  const generatePromise = (async () => {
    const result =
      scale === 100
        ? await runStlExport(model.scad, stlPath, config.render.fn)
        : await runScaledStlExport(
            model.scad,
            stlPath,
            scale,
            config.render.fn
          );

    state.stlLocks.delete(cacheKey);

    if (!result.success) {
      throw new Error(
        `STL generation failed: ${result.stderr}`
      );
    }

    state.stlCache.set(cacheKey, {
      path: stlPath,
      sourceMtime: sourceMtime,
    });

    broadcast({
      type: "stl_ready",
      model: model.name,
      scale,
      path: stlPath,
    });

    return stlPath;
  })();

  state.stlLocks.set(cacheKey, generatePromise);

  try {
    const resultPath = await generatePromise;
    return serveStlFile(resultPath, `${model.name}${suffix}.stl`);
  } catch (err) {
    return Response.json(
      {
        error: `STL generation failed: ${err instanceof Error ? err.message : err}`,
      },
      { status: 500 }
    );
  }
}

async function serveStlFile(
  path: string,
  filename: string
): Promise<Response> {
  const file = Bun.file(path);
  return new Response(file, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

async function serveFile(filePath: string): Promise<Response> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(file, {
    headers: { "Content-Type": getMimeType(filePath) },
  });
}

async function serveBunTranspiled(filePath: string): Promise<Response> {
  try {
    const result = await Bun.build({
      entrypoints: [filePath],
      target: "browser",
    });
    if (result.outputs.length > 0) {
      const text = await result.outputs[0].text();
      return new Response(text, {
        headers: { "Content-Type": "application/javascript" },
      });
    }
  } catch {
    // Fall through to serve raw
  }
  return serveFile(filePath);
}

async function serveFileOrNotFound(filePath: string): Promise<Response> {
  return serveFile(filePath);
}

function getFileMtime(filePath: string): number {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}
