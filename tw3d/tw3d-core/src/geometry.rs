/// Geometry primitives for 3D rendering
use nalgebra::{Point3, Vector3};

/// A 3D vertex with position and normal
#[derive(Debug, Clone, Copy)]
pub struct Vertex {
    pub position: Point3<f32>,
    pub normal: Vector3<f32>,
}

impl Vertex {
    pub fn new(x: f32, y: f32, z: f32, nx: f32, ny: f32, nz: f32) -> Self {
        Self {
            position: Point3::new(x, y, z),
            normal: Vector3::new(nx, ny, nz),
        }
    }
}

/// A triangle face defined by three vertices
#[derive(Debug, Clone)]
pub struct Triangle {
    pub vertices: [Vertex; 3],
}

impl Triangle {
    pub fn new(v0: Vertex, v1: Vertex, v2: Vertex) -> Self {
        Self {
            vertices: [v0, v1, v2],
        }
    }

    /// Calculate the face normal from the triangle's vertices
    pub fn calculate_normal(&self) -> Vector3<f32> {
        let v0 = self.vertices[0].position;
        let v1 = self.vertices[1].position;
        let v2 = self.vertices[2].position;
        
        let edge1 = v1 - v0;
        let edge2 = v2 - v0;
        
        edge1.cross(&edge2).normalize()
    }
}

/// A 3D mesh composed of triangles
#[derive(Debug, Clone)]
pub struct Mesh {
    pub triangles: Vec<Triangle>,
}

impl Mesh {
    pub fn new() -> Self {
        Self {
            triangles: Vec::new(),
        }
    }

    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            triangles: Vec::with_capacity(capacity),
        }
    }

    pub fn add_triangle(&mut self, triangle: Triangle) {
        self.triangles.push(triangle);
    }

    /// Create a simple cube mesh for testing
    pub fn cube(size: f32) -> Self {
        let half = size / 2.0;
        let mut mesh = Self::new();

        // Front face
        mesh.add_triangle(Triangle::new(
            Vertex::new(-half, -half, half, 0.0, 0.0, 1.0),
            Vertex::new(half, -half, half, 0.0, 0.0, 1.0),
            Vertex::new(half, half, half, 0.0, 0.0, 1.0),
        ));
        mesh.add_triangle(Triangle::new(
            Vertex::new(-half, -half, half, 0.0, 0.0, 1.0),
            Vertex::new(half, half, half, 0.0, 0.0, 1.0),
            Vertex::new(-half, half, half, 0.0, 0.0, 1.0),
        ));

        // Back face
        mesh.add_triangle(Triangle::new(
            Vertex::new(-half, -half, -half, 0.0, 0.0, -1.0),
            Vertex::new(-half, half, -half, 0.0, 0.0, -1.0),
            Vertex::new(half, half, -half, 0.0, 0.0, -1.0),
        ));
        mesh.add_triangle(Triangle::new(
            Vertex::new(-half, -half, -half, 0.0, 0.0, -1.0),
            Vertex::new(half, half, -half, 0.0, 0.0, -1.0),
            Vertex::new(half, -half, -half, 0.0, 0.0, -1.0),
        ));

        // Top face
        mesh.add_triangle(Triangle::new(
            Vertex::new(-half, half, -half, 0.0, 1.0, 0.0),
            Vertex::new(-half, half, half, 0.0, 1.0, 0.0),
            Vertex::new(half, half, half, 0.0, 1.0, 0.0),
        ));
        mesh.add_triangle(Triangle::new(
            Vertex::new(-half, half, -half, 0.0, 1.0, 0.0),
            Vertex::new(half, half, half, 0.0, 1.0, 0.0),
            Vertex::new(half, half, -half, 0.0, 1.0, 0.0),
        ));

        // Bottom face
        mesh.add_triangle(Triangle::new(
            Vertex::new(-half, -half, -half, 0.0, -1.0, 0.0),
            Vertex::new(half, -half, -half, 0.0, -1.0, 0.0),
            Vertex::new(half, -half, half, 0.0, -1.0, 0.0),
        ));
        mesh.add_triangle(Triangle::new(
            Vertex::new(-half, -half, -half, 0.0, -1.0, 0.0),
            Vertex::new(half, -half, half, 0.0, -1.0, 0.0),
            Vertex::new(-half, -half, half, 0.0, -1.0, 0.0),
        ));

        // Right face
        mesh.add_triangle(Triangle::new(
            Vertex::new(half, -half, -half, 1.0, 0.0, 0.0),
            Vertex::new(half, half, -half, 1.0, 0.0, 0.0),
            Vertex::new(half, half, half, 1.0, 0.0, 0.0),
        ));
        mesh.add_triangle(Triangle::new(
            Vertex::new(half, -half, -half, 1.0, 0.0, 0.0),
            Vertex::new(half, half, half, 1.0, 0.0, 0.0),
            Vertex::new(half, -half, half, 1.0, 0.0, 0.0),
        ));

        // Left face
        mesh.add_triangle(Triangle::new(
            Vertex::new(-half, -half, -half, -1.0, 0.0, 0.0),
            Vertex::new(-half, -half, half, -1.0, 0.0, 0.0),
            Vertex::new(-half, half, half, -1.0, 0.0, 0.0),
        ));
        mesh.add_triangle(Triangle::new(
            Vertex::new(-half, -half, -half, -1.0, 0.0, 0.0),
            Vertex::new(-half, half, half, -1.0, 0.0, 0.0),
            Vertex::new(-half, half, -half, -1.0, 0.0, 0.0),
        ));

        mesh
    }
}

impl Default for Mesh {
    fn default() -> Self {
        Self::new()
    }
}
