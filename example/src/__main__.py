"""CLI entry point for the CADeng example project.

Usage:
    python -m src --list     Output JSON registry of all parts
    python -m src --render   Build all SCAD files from registered parts
"""

import argparse
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

# Mock OpenGL before any anchorscad import (headless environments)
sys.modules.setdefault("OpenGL", MagicMock())
sys.modules.setdefault("OpenGL.GL", MagicMock())

import anchorscad as ad  # noqa: E402

from .registry import get_registry, list_parts  # noqa: E402


def render_all():
    """Render all registered parts to SCAD files."""
    build_dir = Path("build")
    build_dir.mkdir(exist_ok=True)

    registry = get_registry()
    for name, (factory, ptype) in registry.items():
        try:
            shape = factory()
            rendered = ad.render(shape)
            scad_code = rendered.rendered_shape.dumps()
            scad_path = build_dir / f"{name}.scad"
            scad_path.write_text(scad_code)
            print(f"Rendered: {scad_path}")
        except Exception as e:
            print(f"Failed to render {name}: {e}", file=sys.stderr)
            raise


def main():
    parser = argparse.ArgumentParser(description="CADeng example project")
    parser.add_argument("--list", action="store_true", help="List all parts as JSON")
    parser.add_argument("--render", action="store_true", help="Render all parts to SCAD")
    args = parser.parse_args()

    if args.list:
        parts = list_parts()
        print(json.dumps(parts, indent=2))
    elif args.render:
        render_all()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
