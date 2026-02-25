"""Auto-register all component modules."""

from ..registry import auto_register_module
from . import cube, cylinder

auto_register_module(cube)
auto_register_module(cylinder)
