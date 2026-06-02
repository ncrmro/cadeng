"""Parametric dimension validation tests for the phone stand."""

from src.config import PhoneDimensions, PhoneStandDimensions


class TestPhoneDimensions:
    """Verify phone dimension defaults and constraints."""

    def test_default_values(self):
        phone = PhoneDimensions()
        assert phone.width == 75.0
        assert phone.height == 150.0
        assert phone.thickness == 8.0
        assert phone.corner_radius == 8.0
        assert phone.screen_bezel == 3.0

    def test_camera_bump_fits_on_back(self):
        phone = PhoneDimensions()
        assert phone.camera_bump_width < phone.width
        assert phone.camera_bump_height < phone.height


class TestParametricRelationships:
    """Changing phone dims must propagate to derived stand dimensions."""

    def test_phone_width_updates_cradle_interior(self):
        dims = PhoneStandDimensions()
        default_interior = dims.cradle_interior_width
        dims.phone.width = 85.0
        assert dims.cradle_interior_width == 85.0 + 2 * dims.clearance
        assert dims.cradle_interior_width != default_interior

    def test_phone_thickness_updates_slot_width(self):
        dims = PhoneStandDimensions()
        default_slot = dims.cradle_slot_width
        dims.phone.thickness = 12.0
        assert dims.cradle_slot_width == 12.0 + 2 * dims.clearance
        assert dims.cradle_slot_width != default_slot

    def test_exterior_includes_walls(self):
        dims = PhoneStandDimensions()
        expected = dims.cradle_interior_width + 2 * dims.wall_thickness
        assert dims.cradle_exterior_width == expected


class TestFitConstraints:
    """Verify that parts physically fit together."""

    def test_phone_fits_in_cradle(self):
        dims = PhoneStandDimensions()
        assert dims.phone.width < dims.cradle_interior_width
        assert dims.phone.thickness < dims.cradle_slot_width

    def test_cradle_fits_in_base_slot(self):
        dims = PhoneStandDimensions()
        assert dims.cradle_exterior_width <= dims.base_slot_width

    def test_clearance_on_each_side(self):
        dims = PhoneStandDimensions()
        clearance_per_side = (dims.cradle_interior_width - dims.phone.width) / 2
        assert clearance_per_side == dims.clearance


class TestAbsoluteDimensions:
    """Pin exact default values to catch accidental changes."""

    def test_default_slot_width(self):
        dims = PhoneStandDimensions()
        # phone.thickness (8) + 2 * clearance (1) = 10
        assert dims.cradle_slot_width == 10.0

    def test_default_interior_width(self):
        dims = PhoneStandDimensions()
        # phone.width (75) + 2 * clearance (1) = 77
        assert dims.cradle_interior_width == 77.0

    def test_default_exterior_width(self):
        dims = PhoneStandDimensions()
        # interior (77) + 2 * wall_thickness (3) = 83
        assert dims.cradle_exterior_width == 83.0

    def test_base_width_matches_cradle(self):
        dims = PhoneStandDimensions()
        assert dims.base_width == dims.cradle_exterior_width
