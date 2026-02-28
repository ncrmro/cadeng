/// Terminal-based ASCII rasterizer for 3D rendering
use crossterm::{
    cursor,
    event::{self, Event, KeyCode, KeyEvent},
    execute, queue,
    style::{Color, Print, ResetColor, SetForegroundColor},
    terminal::{self},
};
use std::io::{self, stdout, Write};
use std::time::{Duration, Instant};
use tw3d_core::{Camera, Mesh, RotationState, Transform};

pub mod renderer;

pub use renderer::AsciiRenderer;

/// Main application struct for terminal 3D rendering
pub struct TerminalApp {
    mesh: Mesh,
    rotation: RotationState,
    camera: Camera,
    renderer: AsciiRenderer,
    running: bool,
    last_frame: Instant,
    frame_count: u32,
    fps: f32,
}

impl TerminalApp {
    pub fn new(mesh: Mesh) -> io::Result<Self> {
        let (width, height) = terminal::size()?;
        
        Ok(Self {
            mesh,
            rotation: RotationState::new(0.3, 0.3, 0.0),
            camera: Camera::new(width as u32, height as u32),
            renderer: AsciiRenderer::new(width as usize, height as usize),
            running: true,
            last_frame: Instant::now(),
            frame_count: 0,
            fps: 0.0,
        })
    }

    pub fn run(&mut self) -> io::Result<()> {
        terminal::enable_raw_mode()?;
        execute!(stdout(), terminal::EnterAlternateScreen, cursor::Hide)?;

        let result = self.main_loop();

        // Cleanup
        terminal::disable_raw_mode()?;
        execute!(stdout(), terminal::LeaveAlternateScreen, cursor::Show)?;

        result
    }

    fn main_loop(&mut self) -> io::Result<()> {
        let target_frame_time = Duration::from_millis(1000 / 30); // 30 FPS target

        while self.running {
            let frame_start = Instant::now();

            // Handle input
            if event::poll(Duration::from_millis(0))? {
                self.handle_input()?;
            }

            // Update
            self.update();

            // Render
            self.render()?;

            // Frame timing
            self.frame_count += 1;
            let elapsed = frame_start.elapsed();
            if elapsed < target_frame_time {
                std::thread::sleep(target_frame_time - elapsed);
            }

            // Update FPS counter
            let now = Instant::now();
            if (now - self.last_frame).as_secs() >= 1 {
                self.fps = self.frame_count as f32 / (now - self.last_frame).as_secs_f32();
                self.frame_count = 0;
                self.last_frame = now;
            }
        }

        Ok(())
    }

    fn handle_input(&mut self) -> io::Result<()> {
        if let Event::Key(KeyEvent { code, .. }) = event::read()? {
            match code {
                KeyCode::Char('q') | KeyCode::Esc => {
                    self.running = false;
                }
                KeyCode::Char('w') | KeyCode::Up => {
                    self.rotation.rotate(0.1, 0.0, 0.0);
                }
                KeyCode::Char('s') | KeyCode::Down => {
                    self.rotation.rotate(-0.1, 0.0, 0.0);
                }
                KeyCode::Char('a') | KeyCode::Left => {
                    self.rotation.rotate(0.0, -0.1, 0.0);
                }
                KeyCode::Char('d') | KeyCode::Right => {
                    self.rotation.rotate(0.0, 0.1, 0.0);
                }
                KeyCode::Char('e') => {
                    self.rotation.rotate(0.0, 0.0, 0.1);
                }
                KeyCode::Char('r') => {
                    self.rotation.rotate(0.0, 0.0, -0.1);
                }
                _ => {}
            }
        }
        Ok(())
    }

    fn update(&mut self) {
        // Continuous slow rotation for demo effect
        self.rotation.rotate(0.01, 0.015, 0.0);
    }

    fn render(&mut self) -> io::Result<()> {
        let model = Transform::rotation_matrix(&self.rotation);
        
        // Clear renderer
        self.renderer.clear();

        // Render mesh
        self.renderer.render_mesh(&self.mesh, &model, &self.camera);

        // Output to terminal
        let mut stdout = stdout();
        queue!(stdout, cursor::MoveTo(0, 0))?;
        
        self.renderer.draw(&mut stdout)?;

        // Draw UI overlay
        let (_width, _) = terminal::size()?;
        queue!(
            stdout,
            cursor::MoveTo(0, 0),
            SetForegroundColor(Color::Yellow),
            Print(format!(
                "TW3D Terminal Renderer | FPS: {:.1} | Controls: WASD/Arrows=Rotate E/R=Roll Q=Quit",
                self.fps
            )),
            ResetColor
        )?;

        stdout.flush()?;
        Ok(())
    }
}
