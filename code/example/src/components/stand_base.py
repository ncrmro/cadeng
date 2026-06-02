"""Stand base plate component.

Flat rectangular base with a slot near the back to receive the cradle.
"""

import anchorscad as ad

from ..config import DIMS


@ad.shape
@ad.datatree
class StandBase(ad.CompositeShape):
    """Flat base plate with cradle mounting slot."""
    width: float = DIMS.base_width
    depth: float = DIMS.base_depth
    height: float = DIMS.base_height
    slot_width: float = DIMS.base_slot_width
    slot_depth: float = DIMS.base_slot_depth
    slot_height: float = DIMS.base_height  # through-slot
    wall_thickness: float = DIMS.wall_thickness

    EXAMPLE_SHAPE_ARGS = ad.args()

    def build(self) -> ad.Maker:
        # Main base plate
        base = ad.Box(size=[self.width, self.depth, self.height])
        maker = base.solid("base").at("centre")

        # Slot cut near the back of the base for the cradle
        slot = ad.Box(size=[self.slot_width, self.slot_depth, self.slot_height + 1])
        # Position slot near the back edge of the base
        slot_y_offset = self.depth / 2 - self.slot_depth / 2 - self.wall_thickness
        maker.add_at(
            slot.hole("cradle_slot").at("centre"),
            "base", "face_centre", "top",
            post=ad.translate([0, slot_y_offset, 0]),
        )

        return maker
