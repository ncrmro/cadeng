"""Part auto-discovery and registration.

Follows the AnchorSCAD registry pattern:
- _PART_REGISTRY stores name → (factory, part_type) tuples
- register_part() decorator for manual registration
- auto_register_module() for scanning modules
- list_parts() outputs JSON-compatible part metadata
"""

import inspect
import re
from typing import Callable, Dict, List

_PART_REGISTRY: Dict[str, tuple[Callable, str]] = {}


def camel_to_snake(name: str) -> str:
    """Convert CamelCase to kebab-case."""
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1-\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", s1).lower()


def register_part(name: str, part_type: str = "component"):
    """Decorator to register a part factory with its type."""
    def decorator(cls):
        _PART_REGISTRY[name] = (cls, part_type)
        return cls
    return decorator


def auto_register_module(module, part_type: str = "component"):
    """Scan a module for shape classes and register those with no required args."""
    for attr_name in dir(module):
        obj = getattr(module, attr_name)
        if not inspect.isclass(obj):
            continue
        if getattr(obj, "__module__", None) != module.__name__:
            continue
        # Check if instantiable with no required args
        try:
            sig = inspect.signature(obj.__init__)
            required = [
                p for p in sig.parameters.values()
                if p.name != "self" and p.default is inspect.Parameter.empty
            ]
            if required:
                continue
        except (ValueError, TypeError):
            continue

        name = camel_to_snake(attr_name)
        if name not in _PART_REGISTRY:
            _PART_REGISTRY[name] = (obj, part_type)


def get_registry() -> Dict[str, tuple[Callable, str]]:
    """Return the full part registry."""
    # Trigger auto-discovery by importing all packages
    from . import vitamins    # noqa: F401
    from . import components  # noqa: F401
    from . import assemblies  # noqa: F401
    return dict(_PART_REGISTRY)


def list_parts() -> List[dict]:
    """Return JSON-serializable list of registered parts."""
    registry = get_registry()
    return [
        {"name": name, "type": ptype, "stl": True}
        for name, (factory, ptype) in sorted(registry.items())
    ]
