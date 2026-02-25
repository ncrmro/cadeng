"""Auto-register all component modules."""

from ..registry import auto_register_module
from . import stand_base, stand_cradle

auto_register_module(stand_base)
auto_register_module(stand_cradle)
