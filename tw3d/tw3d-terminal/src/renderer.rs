/// ASCII rasterizer for terminal rendering
use crossterm::{
    style::{Color, Print, ResetColor, SetForegroundColor},
    QueueableCommand,
};
use nalgebra::Matrix4;
use std::io::Write;
use tw3d_core::{Camera, Mesh, Triangle};

/// Character luminosity ramp for depth/shading (darkest to lightest)
const LUMINOSITY_RAMP: &[char] = &[' ', '.', ':', '-', '=', '+', '*', '#', '%', '@'];

/// ASCII renderer that converts 3D meshes to terminal characters
pub struct AsciiRenderer {
    width: usize,
    height: usize,
    depth_buffer: Vec<f32>,
    char_buffer: Vec<char>,
}

impl AsciiRenderer {
    pub fn new(width: usize, height: usize) -> Self {
        let size = width * height;
        Self {
            width,
            height,
            depth_buffer: vec![f32::INFINITY; size],
            char_buffer: vec![' '; size],
        }
    }

    pub fn clear(&mut self) {
        for i in 0..self.depth_buffer.len() {
            self.depth_buffer[i] = f32::INFINITY;
            self.char_buffer[i] = ' ';
        }
    }

    pub fn render_mesh(&mut self, mesh: &Mesh, model_matrix: &Matrix4<f32>, camera: &Camera) {
        for triangle in &mesh.triangles {
            self.render_triangle(triangle, model_matrix, camera);
        }
    }

    fn render_triangle(&mut self, triangle: &Triangle, model_matrix: &Matrix4<f32>, camera: &Camera) {
        // Project vertices to screen space
        let mut screen_coords = Vec::new();
        for vertex in &triangle.vertices {
            if let Some((x, y, z)) = camera.project_to_screen(
                &vertex.position,
                model_matrix,
                self.width as u32,
                self.height as u32,
            ) {
                screen_coords.push((x, y, z));
            } else {
                return; // Triangle is clipped
            }
        }

        if screen_coords.len() != 3 {
            return;
        }

        // Calculate face normal for shading
        let normal = triangle.calculate_normal();
        let light_dir = nalgebra::Vector3::new(0.0, 0.0, 1.0).normalize();
        let brightness = normal.dot(&light_dir).max(0.0);

        // Map brightness to character
        let char_index = (brightness * (LUMINOSITY_RAMP.len() - 1) as f32) as usize;
        let char_index = char_index.min(LUMINOSITY_RAMP.len() - 1);
        let character = LUMINOSITY_RAMP[char_index];

        // Rasterize triangle using scanline algorithm
        self.rasterize_triangle(&screen_coords, character);
    }

    fn rasterize_triangle(&mut self, coords: &[(f32, f32, f32)], character: char) {
        let (v0, v1, v2) = (coords[0], coords[1], coords[2]);

        // Bounding box
        let min_x = v0.0.min(v1.0).min(v2.0).floor() as i32;
        let max_x = v0.0.max(v1.0).max(v2.0).ceil() as i32;
        let min_y = v0.1.min(v1.1).min(v2.1).floor() as i32;
        let max_y = v0.1.max(v1.1).max(v2.1).ceil() as i32;

        // Clip to screen bounds
        let min_x = min_x.max(0);
        let max_x = max_x.min(self.width as i32 - 1);
        let min_y = min_y.max(0);
        let max_y = max_y.min(self.height as i32 - 1);

        // Scanline rasterization
        for y in min_y..=max_y {
            for x in min_x..=max_x {
                let px = x as f32 + 0.5;
                let py = y as f32 + 0.5;

                // Barycentric coordinates
                if let Some((w0, w1, w2)) = barycentric(
                    (v0.0, v0.1),
                    (v1.0, v1.1),
                    (v2.0, v2.1),
                    (px, py),
                ) {
                    if w0 >= 0.0 && w1 >= 0.0 && w2 >= 0.0 {
                        // Interpolate depth
                        let depth = w0 * v0.2 + w1 * v1.2 + w2 * v2.2;

                        let idx = y as usize * self.width + x as usize;
                        if depth < self.depth_buffer[idx] {
                            self.depth_buffer[idx] = depth;
                            self.char_buffer[idx] = character;
                        }
                    }
                }
            }
        }
    }

    pub fn draw<W: Write>(&self, writer: &mut W) -> std::io::Result<()> {
        for y in 0..self.height {
            for x in 0..self.width {
                let idx = y * self.width + x;
                let c = self.char_buffer[idx];
                
                // Color based on character intensity
                let color = match c {
                    ' ' | '.' | ':' => Color::DarkGrey,
                    '-' | '=' => Color::Grey,
                    '+' | '*' => Color::White,
                    '#' | '%' | '@' => Color::Cyan,
                    _ => Color::White,
                };

                writer.queue(SetForegroundColor(color))?;
                writer.queue(Print(c))?;
            }
            writer.queue(Print('\n'))?;
        }
        writer.queue(ResetColor)?;
        Ok(())
    }
}

/// Calculate barycentric coordinates for a point in a triangle
fn barycentric(
    v0: (f32, f32),
    v1: (f32, f32),
    v2: (f32, f32),
    p: (f32, f32),
) -> Option<(f32, f32, f32)> {
    let denom = (v1.1 - v2.1) * (v0.0 - v2.0) + (v2.0 - v1.0) * (v0.1 - v2.1);
    
    if denom.abs() < 1e-6 {
        return None;
    }

    let w0 = ((v1.1 - v2.1) * (p.0 - v2.0) + (v2.0 - v1.0) * (p.1 - v2.1)) / denom;
    let w1 = ((v2.1 - v0.1) * (p.0 - v2.0) + (v0.0 - v2.0) * (p.1 - v2.1)) / denom;
    let w2 = 1.0 - w0 - w1;

    Some((w0, w1, w2))
}
