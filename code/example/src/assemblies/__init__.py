"""Auto-register all assembly modules."""

from ..registry import auto_register_module
from . import phone_stand

auto_register_module(phone_stand, part_type="assembly")
