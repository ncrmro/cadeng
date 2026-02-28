/// TW3D Core Library - Shared geometry and transformation logic
/// 
/// This library provides the stateless core functionality for 3D rendering,
/// including STL parsing, transformation matrices, and projection calculations.

pub mod stl;
pub mod transform;
pub mod geometry;
pub mod projection;

// Re-export commonly used types
pub use geometry::{Mesh, Triangle, Vertex};
pub use transform::{Transform, RotationState};
pub use projection::{Camera, ProjectionMode};
