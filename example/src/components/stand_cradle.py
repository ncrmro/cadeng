"""Stand cradle component.

U-shaped cradle: back wall + bottom shelf + front lip, forming the phone holder.
"""

import anchorscad as ad

from ..config import DIMS


@ad.shape
@ad.datatree
class StandCradle(ad.CompositeShape):
    """U-shaped cradle to hold the phone."""
    interior_width: float = DIMS.cradle_interior_width
    exterior_width: float = DIMS.cradle_exterior_width
    wall_thickness: float = DIMS.wall_thickness
    cradle_depth: float = DIMS.cradle_depth
    back_height: float = DIMS.cradle_back_height
    lip_height: float = DIMS.cradle_lip_height
    slot_width: float = DIMS.cradle_slot_width

    EXAMPLE_SHAPE_ARGS = ad.args()

    def build(self) -> ad.Maker:
        # Outer block of the cradle
        outer = ad.Box(
            size=[self.exterior_width, self.cradle_depth, self.back_height]
        )
        maker = outer.solid("outer").at("centre")

        # Interior cavity (hollow out the U-shape)
        cavity_height = self.back_height - self.wall_thickness
        cavity_depth = self.cradle_depth - self.wall_thickness
        cavity = ad.Box(
            size=[self.interior_width, cavity_depth, cavity_height + 1]
        )
        maker.add_at(
            cavity.hole("cavity").at("centre"),
            "outer", "face_centre", "top",
            post=ad.translate([0, -self.wall_thickness / 2, 0]),
        )

        # Phone slot in the bottom shelf
        slot = ad.Box(
            size=[self.slot_width, self.cradle_depth + 1, self.back_height + 1]
        )
        # Cut the slot through the front face to allow the phone to slide in
        maker.add_at(
            slot.hole("phone_slot").at("centre"),
            "outer", "face_centre", "front",
            post=ad.translate([0, 0, (self.back_height - self.lip_height) / 2]),
        )

        return maker
