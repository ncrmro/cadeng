/// STL file parser for binary and ASCII formats
use nom::{
    bytes::complete::{tag, take},
    character::complete::{multispace0, multispace1},
    multi::many0,
    number::complete::float,
    sequence::preceded,
    IResult,
};

use crate::geometry::{Mesh, Triangle, Vertex};

/// Parse a binary STL file
pub fn parse_binary_stl(data: &[u8]) -> Result<Mesh, String> {
    if data.len() < 84 {
        return Err("File too small to be a valid STL".to_string());
    }

    // Skip 80-byte header
    let data = &data[80..];

    // Read triangle count (4 bytes, little-endian)
    let triangle_count = u32::from_le_bytes([data[0], data[1], data[2], data[3]]) as usize;

    let mut mesh = Mesh::with_capacity(triangle_count);
    let mut offset = 4;

    for _ in 0..triangle_count {
        if offset + 50 > data.len() {
            return Err("Unexpected end of file".to_string());
        }

        // Read normal (3 floats)
        let nx = f32::from_le_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]);
        let ny = f32::from_le_bytes([data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]]);
        let nz = f32::from_le_bytes([data[offset + 8], data[offset + 9], data[offset + 10], data[offset + 11]]);
        offset += 12;

        // Read 3 vertices (9 floats)
        let mut vertices = [Vertex::new(0.0, 0.0, 0.0, nx, ny, nz); 3];
        for vertex in &mut vertices {
            let x = f32::from_le_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]);
            let y = f32::from_le_bytes([data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]]);
            let z = f32::from_le_bytes([data[offset + 8], data[offset + 9], data[offset + 10], data[offset + 11]]);
            *vertex = Vertex::new(x, y, z, nx, ny, nz);
            offset += 12;
        }

        // Skip attribute byte count (2 bytes)
        offset += 2;

        mesh.add_triangle(Triangle::new(vertices[0], vertices[1], vertices[2]));
    }

    Ok(mesh)
}

/// Parse an ASCII STL file
pub fn parse_ascii_stl(input: &str) -> Result<Mesh, String> {
    match parse_ascii_stl_impl(input) {
        Ok((_, mesh)) => Ok(mesh),
        Err(e) => Err(format!("Failed to parse ASCII STL: {:?}", e)),
    }
}

fn parse_ascii_stl_impl(input: &str) -> IResult<&str, Mesh> {
    let (input, _) = preceded(multispace0, tag("solid"))(input)?;
    let (input, _) = preceded(multispace0, take(0usize))(input)?; // Optional name
    let (input, triangles) = many0(parse_facet)(input)?;
    let (input, _) = preceded(multispace0, tag("endsolid"))(input)?;

    let mut mesh = Mesh::with_capacity(triangles.len());
    for triangle in triangles {
        mesh.add_triangle(triangle);
    }

    Ok((input, mesh))
}

fn parse_facet(input: &str) -> IResult<&str, Triangle> {
    let (input, _) = preceded(multispace0, tag("facet"))(input)?;
    let (input, _) = preceded(multispace1, tag("normal"))(input)?;
    let (input, normal) = parse_vector3(input)?;
    let (input, _) = preceded(multispace0, tag("outer"))(input)?;
    let (input, _) = preceded(multispace1, tag("loop"))(input)?;
    let (input, v1) = parse_vertex(input, normal)?;
    let (input, v2) = parse_vertex(input, normal)?;
    let (input, v3) = parse_vertex(input, normal)?;
    let (input, _) = preceded(multispace0, tag("endloop"))(input)?;
    let (input, _) = preceded(multispace0, tag("endfacet"))(input)?;

    Ok((input, Triangle::new(v1, v2, v3)))
}

fn parse_vertex(input: &str, normal: (f32, f32, f32)) -> IResult<&str, Vertex> {
    let (input, _) = preceded(multispace0, tag("vertex"))(input)?;
    let (input, (x, y, z)) = parse_vector3(input)?;
    Ok((input, Vertex::new(x, y, z, normal.0, normal.1, normal.2)))
}

fn parse_vector3(input: &str) -> IResult<&str, (f32, f32, f32)> {
    let (input, _) = multispace0(input)?;
    let (input, x) = float(input)?;
    let (input, _) = multispace1(input)?;
    let (input, y) = float(input)?;
    let (input, _) = multispace1(input)?;
    let (input, z) = float(input)?;
    Ok((input, (x, y, z)))
}

/// Detect and parse STL file (binary or ASCII)
pub fn parse_stl(data: &[u8]) -> Result<Mesh, String> {
    // Try to detect format
    if data.len() > 5 && &data[0..5] == b"solid" {
        // Might be ASCII
        if let Ok(text) = std::str::from_utf8(data) {
            if let Ok(mesh) = parse_ascii_stl(text) {
                return Ok(mesh);
            }
        }
    }

    // Try binary format
    parse_binary_stl(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_binary_header() {
        let mut data = vec![0u8; 84];
        // Set triangle count to 0
        data[80..84].copy_from_slice(&0u32.to_le_bytes());
        
        let result = parse_binary_stl(&data);
        assert!(result.is_ok());
        let mesh = result.unwrap();
        assert_eq!(mesh.triangles.len(), 0);
    }
}
