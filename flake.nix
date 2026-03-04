{
  description = "CADeng — live preview server for AnchorSCAD projects";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      packages = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};

          # Stage 1: Build client assets (compile gallery.ts → gallery.js)
          cadeng-client = pkgs.stdenv.mkDerivation {
            pname = "cadeng-client";
            version = "0.1.0";
            src = ./client;

            nativeBuildInputs = [ pkgs.bun ];

            buildPhase = ''
              export HOME="$TMPDIR"
              bun build gallery.ts --outfile gallery.js --target browser
            '';

            installPhase = ''
              mkdir -p $out
              cp index.html style.css gallery.js $out/
            '';
          };

          # Stage 2: Compile server binary
          cadeng-server = pkgs.stdenv.mkDerivation {
            pname = "cadeng-server";
            version = "0.1.0";
            src = ./server;

            nativeBuildInputs = [ pkgs.bun ];

            buildPhase = ''
              export HOME="$TMPDIR"
              # Bundle all TS modules into a single JS file.
              # bun --compile silently drops embedded bytecode in
              # nix sandbox chroots, so we bundle + run with bun instead.
              bun build index.ts --outfile cadeng-server.js --target bun
            '';

            installPhase = ''
              mkdir -p $out/lib $out/bin
              cp cadeng-server.js $out/lib/
            '';
          };

          # Wrapped openscad with automatic EGL detection for headless rendering.
          # Sets Mesa EGL vendor discovery (harmless on desktop); only forces
          # software rendering when no display server is detected.
          openscad = if pkgs.stdenv.isDarwin
            then pkgs.writeShellScriptBin "openscad" ''
              exec ${pkgs.openscad-unstable}/bin/openscad "$@"
            ''
            else pkgs.writeShellScriptBin "openscad" ''
              if [ -z "''${DISPLAY:-}" ] && [ -z "''${WAYLAND_DISPLAY:-}" ]; then
                export LIBGL_ALWAYS_SOFTWARE=1
              fi
              export __EGL_VENDOR_LIBRARY_FILENAMES="${pkgs.mesa}/share/glvnd/egl_vendor.d/50_mesa.json"
              exec ${pkgs.openscad-unstable}/bin/openscad "$@"
            '';

          # Stage 3: Wrapped package — sets CADENG_CLIENT_DIR and runs via bun
          cadeng = pkgs.stdenv.mkDerivation {
            pname = "cadeng";
            version = "0.1.0";

            dontUnpack = true;

            nativeBuildInputs = [ pkgs.makeWrapper ];

            installPhase = ''
              mkdir -p $out/bin $out/lib $out/share/cadeng/client
              cp -r ${cadeng-client}/* $out/share/cadeng/client/
              cp ${cadeng-server}/lib/cadeng-server.js $out/lib/
              makeWrapper ${pkgs.bun}/bin/bun $out/bin/cadeng \
                --set CADENG_CLIENT_DIR "$out/share/cadeng/client" \
                --add-flags "run $out/lib/cadeng-server.js"
            '';
          };
        in
        {
          default = cadeng;
          inherit cadeng-client cadeng-server cadeng openscad;
        }
      );

      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          python = pkgs.python312.withPackages (ps: with ps; [
            pip
          ]);
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.bun
              python
              pkgs.uv
              self.packages.${system}.openscad
            ];

            # manifold3d (via pythonopenscad) needs libstdc++ and libGL
            LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
              pkgs.stdenv.cc.cc.lib
              pkgs.libGL
            ];

            shellHook = ''
              echo "cadeng dev shell"
              echo "  bun    $(bun --version)"
              echo "  python $(python3 --version 2>&1 | cut -d' ' -f2)"
              echo "  uv     $(uv --version 2>&1 | cut -d' ' -f2)"
              echo "  openscad $(openscad --version 2>&1 | head -1)"
              echo ""
              echo "Run: bun run dev"
            '';
          };
        }
      );

      apps = forAllSystems (system: {
        default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/cadeng";
        };
      });
    };
}
