# TW3D (Terminal-to-Web 3D) Engine

A Rust-based 3D geometry engine for rendering STL and OpenSCAD files in terminal and web environments.

## Architecture

The TW3D engine is organized as a Cargo workspace with three packages:

### `tw3d-core`
Core library providing stateless 3D functionality:
- **STL Parser**: Binary and ASCII STL file parsing
- **Geometry**: Mesh, Triangle, and Vertex primitives
- **Transform**: Rotation matrices and transformation utilities
- **Projection**: Camera and projection calculations

### `tw3d-terminal`
Terminal-based ASCII rasterizer (Phase I - ✅ Implemented):
- Software rasterizer using character luminosity mapping
- Real-time keyboard interaction (WASD/Arrow keys)
- Targets 15+ FPS rendering
- Depth buffer and scanline rasterization
- Unicode Braille pattern support (future enhancement)

### `tw3d-web`
WebAssembly-based web renderer (Phase II - 🚧 Placeholder):
- WGPU backend for GPU acceleration
- HTML5 Canvas integration
- CSG operations for OpenSCAD compatibility
- Shared rotation state with terminal renderer
- Targets 60 FPS rendering

## Building

The Rust toolchain is provided by the Nix flake. From the repository root:

```bash
# Enter the dev shell (provides Rust, cargo, etc.)
nix develop

# Build all workspace packages
cd tw3d
cargo build --workspace

# Build release version
cargo build --workspace --release

# Run terminal demo
cargo run --package tw3d-terminal
# or
cargo run --manifest-path tw3d-terminal/Cargo.toml
```

## Usage

### Terminal Renderer

```bash
cargo run --package tw3d-terminal
```

**Controls:**
- `W`/`↑` - Rotate up
- `S`/`↓` - Rotate down
- `A`/`←` - Rotate left
- `D`/`→` - Rotate right
- `E` - Roll clockwise
- `R` - Roll counter-clockwise
- `Q`/`ESC` - Quit

The demo renders a rotating cube using ASCII characters with a luminosity ramp:
```
 .:-=+*#%@
```

## Development

### Running Tests

```bash
cd tw3d
cargo test --workspace
```

### Code Structure

```
tw3d/
├── Cargo.toml              # Workspace manifest
├── tw3d-core/              # Core geometry library
│   ├── src/
│   │   ├── lib.rs          # Module exports
│   │   ├── geometry.rs     # Mesh primitives
│   │   ├── transform.rs    # Transformation matrices
│   │   ├── projection.rs   # Camera and projection
│   │   └── stl.rs          # STL file parser
│   └── Cargo.toml
├── tw3d-terminal/          # Terminal renderer
│   ├── src/
│   │   ├── main.rs         # Demo application
│   │   ├── lib.rs          # TerminalApp
│   │   └── renderer.rs     # ASCII rasterizer
│   └── Cargo.toml
└── tw3d-web/               # Web renderer (Phase II)
    ├── src/
    │   └── lib.rs          # WASM bindings
    └── Cargo.toml
```

## Phase I Status (Terminal Rendering)

- ✅ Rust development environment in flake.nix
- ✅ Cargo workspace structure
- ✅ STL parser (binary and ASCII)
- ✅ Software rasterizer with orthographic/perspective projection
- ✅ ASCII character mapping for depth/shading
- ✅ Keyboard event capture for rotation
- ✅ Terminal demo with cube rotation
- ⏳ Unicode Braille patterns (planned enhancement)

## Phase II Status (Web Rendering)

- ⏳ WGPU backend
- ⏳ WASM compilation
- ⏳ HTML5 Canvas integration
- ⏳ CSG kernel for OpenSCAD operations
- ⏳ Shared rotation state
- ⏳ 60 FPS web rendering

## RFC Compliance

This implementation follows the [RFC: Terminal-to-Web 3D CAD Engine](../docs/RFC.md) specification:

- **Section 2**: Development environment using flake.nix ✅
- **Section 3**: Full terminal rendering with TUI ✅
  - 3.1: STL parsing into triangle mesh ✅
  - 3.2: 3D-to-2D projection ✅
  - 3.3: Character luminosity mapping ✅
  - 3.4: Keyboard interaction ✅
  - 3.5: Unicode Braille patterns ⏳
- **Section 4**: Web & Native rendering 🚧
- **Section 5**: Rotation requirements ✅

## License

MIT License - See repository LICENSE file
