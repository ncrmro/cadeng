"""Auto-register all vitamin modules."""

from ..registry import auto_register_module
from . import phone

auto_register_module(phone, part_type="vitamin")
