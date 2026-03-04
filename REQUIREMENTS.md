# CADeng Requirements

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

## 1. Configuration

1.1. The system MUST read project configuration from a `cadeng.yaml` file in the working directory.

1.2. The configuration MUST include the following top-level sections: `project`, `python`, `render`, `cameras`, `camera_sets`, and `models`.

1.3. `project.name` and `project.build_dir` MUST be present. `project.port` SHOULD default to `9090` when omitted.

1.4. The system MUST validate that all model `angles` references resolve to a defined `camera_sets` entry. Unknown references SHOULD emit a warning.

1.5. The system MUST validate that `projects[].models` entries reference defined model names. Unknown references SHOULD emit a warning.

1.6. The `stl` section is OPTIONAL and MUST default to `{ scales: [100] }` when omitted.

1.7. The system MUST watch `cadeng.yaml` for changes and hot-reload the configuration without restarting the server.

## 2. File Watching

2.1. The system MUST recursively watch all directories listed in `python.watch_dirs` for file changes.

2.2. Only files matching extensions in `python.watch_extensions` SHALL trigger a rebuild.

2.3. File change events MUST be debounced by `python.debounce_ms` milliseconds before triggering the pipeline.

2.4. When the configuration is reloaded (see 1.7), the system MUST stop existing watchers and create new ones reflecting the updated `watch_dirs`.

## 3. Build Pipeline

3.1. The pipeline MUST execute in two sequential phases: **build** (Python), then **render** (OpenSCAD screenshots).

3.2. The build phase MUST run the command specified in `python.build_command` with the working directory `python.build_cwd`.

3.3. If the build phase fails (non-zero exit code), the pipeline MUST NOT proceed to rendering and MUST broadcast an error to all connected clients.

3.4. The pipeline MUST be serialized: if a pipeline is already running, subsequent triggers MUST be dropped (not queued).

## 4. Caching

4.1. The system MUST compute a SHA-256 hash over all watched source files and `cadeng.yaml`. If the hash matches the cached value, the entire pipeline SHOULD be skipped.

4.2. After a successful build, the system MUST compute per-model `.scad` file hashes. Models whose `.scad` output is unchanged SHOULD skip rendering.

4.3. Render configuration changes (resolution, colorscheme, `$fn`, camera definitions) MUST invalidate all model render caches.

4.4. The cache MUST be persisted to `.cadeng-cache.json` in the build directory.

4.5. A forced rebuild (via client request) MUST bypass all cache checks.

## 5. Rendering

5.1. The system MUST invoke OpenSCAD to render PNG screenshots for each model at each camera angle defined by the model's camera set.

5.2. Screenshot filenames MUST follow the pattern `{type}-{name}-{angle}.png` (e.g., `assembly-stand-iso.png`).

5.3. Model variants MUST be rendered as additional angles with filenames `{type}-{name}-{variantName}_{angle}.png`.

5.4. The system MUST apply `render.resolution`, `render.colorscheme`, and `render.$fn` as OpenSCAD arguments.

5.5. When `render.autocenter` is true, the `--autocenter` flag MUST be passed. Likewise for `render.viewall`.

5.6. Per-model `camera_distance` overrides MUST replace the last component of the camera string.

5.7. In headless environments (no `$DISPLAY` or `$WAYLAND_DISPLAY`), the system MUST prefix OpenSCAD commands with `xvfb-run -a`.

5.8. Screenshot rendering and STL export MUST work in headless, containerized environments (e.g., Docker, Podman, CI runners) without access to a physical GPU or display server. The system SHOULD provide or document the required runtime dependencies (e.g., `xvfb`, Mesa software rendering) for container images.

## 6. STL Export

6.1. The system MUST generate STL files on demand via HTTP when a model has `stl: true`.

6.2. Components (`type: "component"`) MUST default to `stl: true`; all other types MUST default to `stl: false`.

6.3. Scaled STL exports MUST only be served for scale percentages listed in `stl.scales`. Requests for unlisted scales MUST return HTTP 400.

6.4. The system MUST cache generated STL files keyed by model name and scale. The cache MUST be invalidated when the source `.scad` file's mtime changes.

6.5. Concurrent STL requests for the same model and scale MUST coalesce into a single generation, not spawn duplicate OpenSCAD processes.

6.6. STL responses MUST include a `Content-Disposition: attachment` header with the appropriate filename.

## 7. HTTP Server

7.1. The server MUST serve the gallery UI at `/` and `/index.html`.

7.2. Client-side routes (`/project/{name}`) MUST be handled by serving `index.html` for client-side routing.

7.3. Build artifacts MUST be served from `/build/*` mapped to the configured `build_dir`. Path traversal attempts (containing `..`) MUST return HTTP 403.

7.4. Build artifact responses MUST include `Cache-Control: no-cache, no-store, must-revalidate` headers.

7.5. If the configured port is in use, the server SHOULD try up to 10 consecutive ports before failing.

7.6. The server MUST handle graceful shutdown on `SIGINT` and `SIGTERM`, closing watchers and stopping the HTTP server.

## 8. WebSocket Communication

8.1. The server MUST upgrade HTTP connections with an `Upgrade: websocket` header to WebSocket connections.

8.2. On connection, the server MUST send a `connected` message containing the model list, project groups, camera sets, and server configuration.

8.3. The server MUST send existing (pre-rendered) screenshots to newly connected clients.

8.4. The server MUST broadcast the following events to all connected clients: `build_start`, `build_complete`, `render_start`, `render_progress`, `render_complete`, `screenshot_updated`, `stl_ready`, and `error`.

8.5. The server MUST accept the following client messages: `request_rebuild`, `request_render` (with optional model filter), and `request_stl`.

8.6. Invalid or unknown client messages MUST be silently ignored.

## 9. Gallery UI

9.1. The client MUST establish a WebSocket connection on page load and auto-reconnect with exponential backoff (capped at 30 seconds) on disconnection.

9.2. The gallery MUST display models grouped by name, sorted by type: assemblies first, then components, then vitamin assemblies, then vitamins.

9.3. When project groups are configured, the UI MUST render tab navigation allowing the user to filter models by project.

9.4. The active project MUST be reflected in the URL path (`/project/{name}`) and preserved across page reloads and browser back/forward navigation.

9.5. Screenshot cards MUST render as skeleton placeholders until image data is received, then update in-place without full page re-renders.

9.6. The UI MUST display a lightbox overlay when a screenshot is clicked, closable via the close button or the Escape key.

9.7. For models with STL enabled, the UI MUST display download buttons for each configured scale.

9.8. The UI MUST show a progress bar and status text during build and render phases.

9.9. A reconnecting banner MUST be displayed when the WebSocket connection is lost.

## 10. Distribution

10.1. The system MUST be installable as a Nix flake input, exposing a `packages.${system}.default` output.

10.2. When installed via Nix, the client assets path MUST be configurable via the `CADENG_CLIENT_DIR` environment variable, falling back to `./client` in dev mode.

10.3. The server MUST be compilable to a single binary via `bun build --compile`.

10.4. The server port MUST be overridable via the `PORT` environment variable.
