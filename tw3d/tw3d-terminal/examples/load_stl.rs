/// Example: Load and render an STL file in the terminal
/// 
/// Usage: cargo run --example load_stl -- path/to/file.stl

use std::env;
use std::fs;
use std::io;
use tw3d_core::stl;
use tw3d_terminal::TerminalApp;

fn main() -> io::Result<()> {
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 2 {
        eprintln!("Usage: {} <stl-file>", args[0]);
        eprintln!("\nNo STL file provided, using default cube...");
        // Use default cube
        let cube = tw3d_core::Mesh::cube(2.0);
        let mut app = TerminalApp::new(cube)?;
        return app.run();
    }

    let stl_path = &args[1];
    
    println!("Loading STL file: {}", stl_path);
    
    // Read STL file
    let data = fs::read(stl_path)
        .map_err(|e| io::Error::new(io::ErrorKind::NotFound, format!("Failed to read STL file: {}", e)))?;
    
    // Parse STL
    let mesh = stl::parse_stl(&data)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, format!("Failed to parse STL: {}", e)))?;
    
    println!("Loaded {} triangles", mesh.triangles.len());
    println!("Starting terminal renderer (press Q to quit)...");
    std::thread::sleep(std::time::Duration::from_secs(1));
    
    // Run the terminal app
    let mut app = TerminalApp::new(mesh)?;
    app.run()?;
    
    println!("Thank you for using TW3D Terminal Renderer!");
    Ok(())
}
