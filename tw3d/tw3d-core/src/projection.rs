/// Camera and projection utilities
use nalgebra::{Matrix4, Point3, Vector3};

/// Projection mode for rendering
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ProjectionMode {
    Orthographic,
    Perspective,
}

/// Camera configuration for 3D rendering
pub struct Camera {
    pub position: Point3<f32>,
    pub target: Point3<f32>,
    pub up: Vector3<f32>,
    pub fov: f32,
    pub aspect: f32,
    pub near: f32,
    pub far: f32,
    pub mode: ProjectionMode,
}

impl Camera {
    pub fn new(width: u32, height: u32) -> Self {
        Self {
            position: Point3::new(0.0, 0.0, 5.0),
            target: Point3::new(0.0, 0.0, 0.0),
            up: Vector3::new(0.0, 1.0, 0.0),
            fov: std::f32::consts::PI / 4.0, // 45 degrees
            aspect: width as f32 / height as f32,
            near: 0.1,
            far: 100.0,
            mode: ProjectionMode::Perspective,
        }
    }

    /// Create the view matrix (camera transformation)
    pub fn view_matrix(&self) -> Matrix4<f32> {
        Matrix4::look_at_rh(&self.position, &self.target, &self.up)
    }

    /// Create the projection matrix
    pub fn projection_matrix(&self) -> Matrix4<f32> {
        match self.mode {
            ProjectionMode::Perspective => {
                Matrix4::new_perspective(self.aspect, self.fov, self.near, self.far)
            }
            ProjectionMode::Orthographic => {
                let height = (self.position - self.target).norm();
                let width = height * self.aspect;
                Matrix4::new_orthographic(
                    -width / 2.0,
                    width / 2.0,
                    -height / 2.0,
                    height / 2.0,
                    self.near,
                    self.far,
                )
            }
        }
    }

    /// Project a 3D point to 2D screen space
    pub fn project_to_screen(
        &self,
        point: &Point3<f32>,
        model_matrix: &Matrix4<f32>,
        width: u32,
        height: u32,
    ) -> Option<(f32, f32, f32)> {
        let view = self.view_matrix();
        let projection = self.projection_matrix();
        let mvp = projection * view * model_matrix;

        // Transform to clip space
        let clip = mvp.transform_point(point);

        // Prevent division by near-zero depth values
        if clip.z.abs() < 1e-6 {
            return None;
        }

        let ndc_x = clip.x / clip.z;
        let ndc_y = clip.y / clip.z;
        let depth = clip.z;

        // Clip test
        if ndc_x < -1.0 || ndc_x > 1.0 || ndc_y < -1.0 || ndc_y > 1.0 {
            return None;
        }

        // Convert to screen space
        let screen_x = (ndc_x + 1.0) * 0.5 * width as f32;
        let screen_y = (1.0 - ndc_y) * 0.5 * height as f32;

        Some((screen_x, screen_y, depth))
    }
}

impl Default for Camera {
    fn default() -> Self {
        Self::new(800, 600)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_camera_creation() {
        let camera = Camera::new(800, 600);
        assert_eq!(camera.mode, ProjectionMode::Perspective);
        assert!((camera.aspect - 800.0 / 600.0).abs() < 1e-6);
    }

    #[test]
    fn test_view_matrix() {
        let camera = Camera::new(800, 600);
        let view = camera.view_matrix();
        // View matrix should be non-zero
        assert!(view.norm() > 0.0);
    }
}
