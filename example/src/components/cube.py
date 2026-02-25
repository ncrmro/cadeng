"""Simple parametric cube part.

In a real AnchorSCAD project, this would use @ad.shape and @datatree.
This simplified version uses pythonopenscad directly.
"""

import pythonopenscad as poscad

from ..config import CUBE


class Cube:
    """A parametric cube."""

    def __init__(self, size: float = CUBE.size):
        self.size = size

    def build(self):
        return poscad.Cube([self.size, self.size, self.size], center=True)

    def write_scad(self, path: str):
        model = self.build()
        with open(path, "w") as f:
            f.write(model.dumps())


# Module-level instantiation for OpenSCAD rendering
if __name__ == "__main__":
    cube = Cube()
    print(cube.build().dumps())
