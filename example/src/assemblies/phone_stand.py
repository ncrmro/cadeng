"""Phone stand assembly -- base + cradle + phone composed at the configured angle.

Supports an `explode` parameter for exploded-view variants.
"""

import anchorscad as ad

from ..config import DIMS
from ..registry import register_part
from ..vitamins.phone import Phone
from ..components.stand_base import StandBase
from ..components.stand_cradle import StandCradle


@ad.shape
@ad.datatree
class PhoneStandAssembly(ad.CompositeShape):
    """Complete phone stand assembly."""
    explode: float = 0.0
    cradle_angle: float = DIMS.cradle_angle
    base_depth: float = DIMS.base_depth
    base_height: float = DIMS.base_height
    cradle_back_height: float = DIMS.cradle_back_height
    wall_thickness: float = DIMS.wall_thickness

    EXAMPLE_SHAPE_ARGS = ad.args()

    def build(self) -> ad.Maker:
        # Base plate
        base = StandBase()
        maker = base.solid("base").at("centre")

        # Cradle -- position on top of the base, near the back
        cradle = StandCradle()
        cradle_z_offset = self.base_height / 2 + self.cradle_back_height / 2
        cradle_y_offset = (
            self.base_depth / 2
            - DIMS.base_slot_depth / 2
            - self.wall_thickness
        )
        maker.add_at(
            cradle.solid("cradle").at("centre"),
            "base", "face_centre", "top",
            post=ad.translate([
                0,
                cradle_y_offset,
                cradle_z_offset + self.explode,
            ]),
        )

        # Phone -- resting in the cradle at the configured angle
        phone = Phone()
        phone_z_offset = (
            self.base_height / 2
            + DIMS.cradle_lip_height / 2
            + self.explode * 2
        )
        maker.add_at(
            phone.solid("phone").at("centre"),
            "base", "face_centre", "top",
            post=ad.rotX(self.cradle_angle)
            * ad.translate([
                0,
                cradle_y_offset,
                phone_z_offset,
            ]),
        )

        return maker


@register_part("phone_stand_exploded", part_type="assembly")
def phone_stand_exploded():
    """Factory for exploded-view variant."""
    return PhoneStandAssembly(explode=30.0)
