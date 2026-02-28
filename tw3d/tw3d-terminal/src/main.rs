/// TW3D Terminal Demo - Rotating Cube
/// 
/// Demonstrates the terminal-based ASCII rasterizer with a rotating cube.
/// Controls:
///   - WASD / Arrow Keys: Rotate the cube
///   - E/R: Roll rotation
///   - Q/ESC: Quit

use std::io;
use tw3d_core::Mesh;
use tw3d_terminal::TerminalApp;

fn main() -> io::Result<()> {
    println!("TW3D Terminal Renderer - Loading...");
    
    // Create a cube mesh
    let cube = Mesh::cube(2.0);
    
    println!("Starting terminal renderer (press Q to quit)...");
    std::thread::sleep(std::time::Duration::from_secs(1));
    
    // Run the terminal app
    let mut app = TerminalApp::new(cube)?;
    app.run()?;
    
    println!("Thank you for using TW3D Terminal Renderer!");
    Ok(())
}
