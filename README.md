# CADeng

Live preview server for AnchorSCAD projects. Watches Python sources, builds SCAD, renders screenshots via OpenSCAD, serves a WebSocket-powered gallery with STL downloads.

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

## How It Works

```
Edit .py → fs.watch → debounce(2s) → python build → registry validate → openscad render → WS → browser updates
```

## Configuration

All behavior is declared in `cadeng.yaml` (in your project root):

- **models** — name, SCAD path, camera angles, STL toggle
- **cameras** — named OpenSCAD camera strings
- **camera_sets** — groups of cameras (quick, standard, full)
- **python** — build/registry commands, watch dirs, debounce
- **render** — resolution, colorscheme, $fn
- **stl.scales** — available scale percentages

## Requirements

Provided by `flake.nix` dev shell:

- Bun
- Python 3.12+ with uv
- OpenSCAD
