"""Simple parametric cylinder part.

In a real AnchorSCAD project, this would use @ad.shape and @datatree.
This simplified version uses pythonopenscad directly.
"""

import pythonopenscad as poscad

from ..config import CYLINDER


class Cylinder:
    """A parametric cylinder."""

    def __init__(
        self,
        radius: float = CYLINDER.radius,
        height: float = CYLINDER.height,
        center: bool = CYLINDER.center,
    ):
        self.radius = radius
        self.height = height
        self.center = center

    def build(self):
        return poscad.Cylinder(r=self.radius, h=self.height, center=self.center)

    def write_scad(self, path: str):
        model = self.build()
        with open(path, "w") as f:
            f.write(model.dumps())


# Module-level instantiation for OpenSCAD rendering
if __name__ == "__main__":
    cyl = Cylinder()
    print(cyl.build().dumps())
