"""Shared parametric dimensions for the phone stand project.

Central config hub -- every part derives geometry from these dimensions.
Uses @dataclass with derived @property methods for computed values.
"""

from dataclasses import dataclass
import math


@dataclass
class PhoneDimensions:
    """Dimensions of a typical smartphone (vitamin mockup)."""
    width: float = 75.0
    height: float = 150.0
    thickness: float = 8.0
    corner_radius: float = 8.0
    screen_bezel: float = 3.0
    camera_bump_width: float = 30.0
    camera_bump_height: float = 30.0
    camera_bump_thickness: float = 2.0


@dataclass
class PhoneStandDimensions:
    """Aggregated dimensions for the complete phone stand assembly."""
    phone: PhoneDimensions = None
    wall_thickness: float = 3.0
    clearance: float = 1.0
    cradle_angle: float = 70.0  # degrees from horizontal
    base_depth: float = 100.0
    base_height: float = 5.0
    cradle_lip_height: float = 15.0
    cradle_back_height: float = 40.0
    cradle_depth: float = 20.0

    def __post_init__(self):
        if self.phone is None:
            self.phone = PhoneDimensions()

    @property
    def cradle_slot_width(self) -> float:
        """Interior slot width to receive the phone thickness."""
        return self.phone.thickness + 2 * self.clearance

    @property
    def cradle_interior_width(self) -> float:
        """Interior width of the cradle (phone + clearance on each side)."""
        return self.phone.width + 2 * self.clearance

    @property
    def cradle_exterior_width(self) -> float:
        """Exterior width including walls."""
        return self.cradle_interior_width + 2 * self.wall_thickness

    @property
    def base_width(self) -> float:
        """Base plate width matches cradle exterior."""
        return self.cradle_exterior_width

    @property
    def base_slot_depth(self) -> float:
        """Depth of the slot in the base to receive the cradle."""
        return self.cradle_depth

    @property
    def base_slot_width(self) -> float:
        """Width of the slot in the base for the cradle."""
        return self.cradle_exterior_width

    @property
    def cradle_angle_rad(self) -> float:
        """Cradle angle in radians."""
        return math.radians(self.cradle_angle)


# Default dimensions
DIMS = PhoneStandDimensions()
