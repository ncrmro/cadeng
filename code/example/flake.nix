{
  description = "CADeng Example — phone stand project";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    cadeng.url = "github:ncrmro/cadeng";
  };

  outputs = { self, nixpkgs, cadeng }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
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
              cadeng.packages.${system}.default
              python
              pkgs.uv
              pkgs.openscad-unstable
            ];

            # manifold3d (via pythonopenscad) needs libstdc++ and libGL
            LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
              pkgs.stdenv.cc.cc.lib
              pkgs.libGL
            ];

            shellHook = ''
              echo "cadeng example dev shell"
              echo "  cadeng  $(cadeng --version 2>&1 || echo 'available')"
              echo "  python  $(python3 --version 2>&1 | cut -d' ' -f2)"
              echo "  uv      $(uv --version 2>&1 | cut -d' ' -f2)"
              echo "  openscad $(openscad --version 2>&1 | head -1)"
              echo ""
              echo "Run: cadeng"
            '';
          };
        }
      );
    };
}
