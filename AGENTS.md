# CADeng — Agent Instructions

## What This Is

CADeng is a live preview server for AnchorSCAD projects. It watches Python sources, builds SCAD, renders screenshots via OpenSCAD, and serves a WebSocket-powered gallery with STL downloads.

## Dev Shell

Always use `nix develop` — provides bun, python, uv, openscad.

For the example project: `cd example && uv sync && cd ..`

## Running

```bash
# Dev mode (from repo root, with cadeng.yaml in CWD)
bun run dev

# Example project
cd example && bun run ../server/index.ts

# Build compiled binary
bun run build
```

## Architecture

- **Config**: `cadeng.yaml` (in consumer's project root) → parsed by `server/config.ts` via Bun YAML import
- **Server**: `server/index.ts` entry → Bun.serve (HTTP + WS) + fs.watch
- **Pipeline**: file change → build (`python.ts`) → registry validate (`config.ts`) → openscad render (`python.ts`) → WS broadcast (`websocket.ts`)
- **Client**: `client/` — vanilla HTML/JS/CSS, served by Bun. In dev mode `.ts` transpiled on-the-fly; in compiled mode pre-built `.js` served from `CADENG_CLIENT_DIR`
- **Types**: `server/types.ts` — all shared types (config schema, WS messages, registry)
- **Zero npm deps**: everything uses Bun built-ins

## Key Files

| File | Role |
|------|------|
| `server/index.ts` | Entry + pipeline orchestration |
| `server/config.ts` | YAML parse, camera resolution, registry↔config validation |
| `server/python.ts` | Bun.spawn wrappers for python/openscad |
| `server/routes.ts` | HTTP routes: gallery, /api/*, /stl/*, /build/* — uses CADENG_CLIENT_DIR env var |
| `server/websocket.ts` | WS broadcast + client message handling |
| `server/watcher.ts` | fs.watch + debounce |
| `client/gallery.ts` | WS client, DOM render, lightbox, reconnect |
| `example/` | Working AnchorSCAD example project |

## Nix Package

`flake.nix` exports:
- `packages.default` — compiled `cadeng` binary + client assets, wrapped with `CADENG_CLIENT_DIR`
- `devShells.default` — bun, python, uv, openscad for developing cadeng itself
- `apps.default` — `nix run github:ncrmro/cadeng`

Consumer projects add cadeng as a flake input and get the `cadeng` binary in their dev shell.

## Package Organization

Python source packages (`example/src/`) follow strict ownership rules:

| Package | Contains | `cadeng.yaml` type | Sort order |
|---------|----------|---------------------|------------|
| `vitamins/` | Off-the-shelf parts with known dimensions | `vitamin` | 4 (last) |
| `vitamins/` | Compositions of vitamins only | `vitamin_assembly` | 3 |
| `components/` | 3D-printed or fabricated parts you design | `component` | 2 |
| `assemblies/` | Cross-category compositions (vitamins + components) | `assembly` | 1 (first) |

## Conventions

- Screenshot naming: `{type}-{name}-{angle}.png`
- STL cache: `{name}-{scale}pct.stl` in build dir
- Registry contract: `--list` → JSON `[{"name": "...", "type": "...", "stl": true}]`
- Camera strings: OpenSCAD format `tx,ty,tz,rx,ry,rz,dist`
- Gallery sort: assembly → component → vitamin_assembly → vitamin
