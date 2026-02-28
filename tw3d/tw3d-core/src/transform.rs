/// 3D transformation matrices and rotation state
use nalgebra::{Matrix4, Vector3};

/// Rotation state around three axes (in radians)
#[derive(Debug, Clone, Copy)]
pub struct RotationState {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl RotationState {
    pub fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }

    pub fn zero() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        }
    }

    /// Rotate by delta amounts (in radians)
    pub fn rotate(&mut self, dx: f32, dy: f32, dz: f32) {
        self.x += dx;
        self.y += dy;
        self.z += dz;
    }
}

impl Default for RotationState {
    fn default() -> Self {
        Self::zero()
    }
}

/// Transform builder for 3D transformations
pub struct Transform;

impl Transform {
    /// Create a rotation matrix from a rotation state
    pub fn rotation_matrix(rotation: &RotationState) -> Matrix4<f32> {
        let rx = Matrix4::new_rotation(Vector3::new(rotation.x, 0.0, 0.0));
        let ry = Matrix4::new_rotation(Vector3::new(0.0, rotation.y, 0.0));
        let rz = Matrix4::new_rotation(Vector3::new(0.0, 0.0, rotation.z));
        
        // Apply rotations in order: Z, Y, X
        rz * ry * rx
    }

    /// Create a translation matrix
    pub fn translation_matrix(x: f32, y: f32, z: f32) -> Matrix4<f32> {
        Matrix4::new_translation(&Vector3::new(x, y, z))
    }

    /// Create a scale matrix
    pub fn scale_matrix(sx: f32, sy: f32, sz: f32) -> Matrix4<f32> {
        Matrix4::new_nonuniform_scaling(&Vector3::new(sx, sy, sz))
    }

    /// Create a model-view-projection matrix
    pub fn mvp_matrix(
        model: &Matrix4<f32>,
        view: &Matrix4<f32>,
        projection: &Matrix4<f32>,
    ) -> Matrix4<f32> {
        projection * view * model
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rotation_state() {
        let mut state = RotationState::zero();
        assert_eq!(state.x, 0.0);
        assert_eq!(state.y, 0.0);
        assert_eq!(state.z, 0.0);

        state.rotate(0.1, 0.2, 0.3);
        assert!((state.x - 0.1).abs() < 1e-6);
        assert!((state.y - 0.2).abs() < 1e-6);
        assert!((state.z - 0.3).abs() < 1e-6);
    }

    #[test]
    fn test_identity_rotation() {
        let rotation = RotationState::zero();
        let matrix = Transform::rotation_matrix(&rotation);
        assert!((matrix - Matrix4::identity()).norm() < 1e-6);
    }
}
