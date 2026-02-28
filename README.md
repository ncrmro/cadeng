# CADeng

Live preview server for AnchorSCAD projects. Watches Python sources, builds SCAD, renders screenshots via OpenSCAD, serves a WebSocket-powered gallery with STL downloads.

## Components

### CADeng Server (TypeScript/Bun)
The main preview server for AnchorSCAD projects.

### TW3D Engine (Rust)
Terminal-to-Web 3D rendering engine for STL and OpenSCAD files. See [tw3d/README.md](tw3d/README.md) for details.

**Quick Start:**
```bash
# Run terminal 3D renderer
cargo run --manifest-path tw3d/tw3d-terminal/Cargo.toml
```

## Install via Nix Flake

Add cadeng to your project's `flake.nix`:

```nix
{
  inputs.cadeng.url = "github:ncrmro/cadeng";

  outputs = { self, nixpkgs, cadeng, ... }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      devShells.${system}.default = pkgs.mkShell {
        packages = [
          cadeng.packages.${system}.default
          # ... your other packages
        ];
      };
    };
}
```

Then from any directory with a `cadeng.yaml`:

```bash
nix develop
cadeng
# http://localhost:9090
```

## Dev Mode

For working on cadeng itself:

```bash
git clone git@github.com:ncrmro/cadeng.git
cd cadeng
nix develop
cd example && uv sync && cd ..
bun run dev
# http://localhost:9090
```

## Requirements

Provided by `flake.nix` dev shell:

- Bun (for CADeng server)
- Python 3.12+ with uv (for AnchorSCAD)
- OpenSCAD (for rendering)
- Rust toolchain (for TW3D engine)
  - cargo, rustc
  - wasm-pack, binaryen (for web builds)

## Architecture

### CADeng Server
```
Edit .py → fs.watch → debounce(2s) → python build → registry validate → openscad render → WS → browser updates
```

### TW3D Engine
```
STL file → Parse mesh → Transform (rotation) → Project to 2D → ASCII rasterize → Terminal display
```

See [tw3d/README.md](tw3d/README.md) for detailed TW3D documentation.

## Configuration

All CADeng server behavior is declared in `cadeng.yaml` (in your project root):

- **models** — name, SCAD path, camera angles, STL toggle
- **cameras** — named OpenSCAD camera strings
- **camera_sets** — groups of cameras (quick, standard, full)
- **python** — build/registry commands, watch dirs, debounce
- **render** — resolution, colorscheme, $fn
- **stl.scales** — available scale percentages


