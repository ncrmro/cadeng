"""Phone vitamin -- mockup of a smartphone for the phone stand assembly.

Dark gray body with screen face on front (-Y) and camera bump on back (+Y).
"""

import anchorscad as ad

from ..config import DIMS


@ad.shape
@ad.datatree
class Phone(ad.CompositeShape):
    """Smartphone mockup vitamin."""
    width: float = DIMS.phone.width
    height: float = DIMS.phone.height
    thickness: float = DIMS.phone.thickness
    screen_bezel: float = DIMS.phone.screen_bezel
    camera_bump_width: float = DIMS.phone.camera_bump_width
    camera_bump_height: float = DIMS.phone.camera_bump_height
    camera_bump_thickness: float = DIMS.phone.camera_bump_thickness

    EXAMPLE_SHAPE_ARGS = ad.args()

    def build(self) -> ad.Maker:
        # Main phone body
        body = ad.Box(size=[self.width, self.thickness, self.height])
        maker = body.solid("body").colour([0.2, 0.2, 0.2]).at("centre")

        # Screen face (thin slab on front -Y side)
        screen_w = self.width - 2 * self.screen_bezel
        screen_h = self.height - 2 * self.screen_bezel
        screen_t = 0.5
        screen = ad.Box(size=[screen_w, screen_t, screen_h])
        maker.add_at(
            screen.solid("screen").colour([0.1, 0.1, 0.15]).at("centre"),
            "body", "face_centre", "front",
            post=ad.translate([0, -screen_t / 2, 0]),
        )

        # Camera bump on back (+Y side)
        bump = ad.Box(
            size=[
                self.camera_bump_width,
                self.camera_bump_thickness,
                self.camera_bump_height,
            ]
        )
        maker.add_at(
            bump.solid("camera_bump").colour([0.15, 0.15, 0.15]).at("centre"),
            "body", "face_centre", "back",
            post=ad.translate([
                -self.width / 4 + self.camera_bump_width / 4,
                self.camera_bump_thickness / 2,
                self.height / 4,
            ]),
        )

        return maker
