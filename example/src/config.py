"""Shared parametric dimensions for the example project.

In a real project, use @datatree for parametric configuration.
This simplified version uses plain dataclasses.
"""

from dataclasses import dataclass


@dataclass
class CubeConfig:
    """Parametric cube dimensions."""
    size: float = 20.0
    rounded: bool = False
    radius: float = 2.0


@dataclass
class CylinderConfig:
    """Parametric cylinder dimensions."""
    radius: float = 10.0
    height: float = 30.0
    center: bool = True


# Default configurations
CUBE = CubeConfig()
CYLINDER = CylinderConfig()
