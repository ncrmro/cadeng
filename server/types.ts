// -- Config Schema Types --

export interface ProjectGroup {
  name: string;
  label: string;
  models: string[];
}

export interface CadengConfig {
  project: ProjectConfig;
  python: PythonConfig;
  render: RenderConfig;
  cameras: Record<string, string>;
  camera_sets: Record<string, string[]> & { default: string };
  stl: StlConfig;
  projects: ProjectGroup[];
  models: ModelConfig[];
}

export interface ProjectConfig {
  name: string;
  build_dir: string;
  port: number;
}

export interface PythonConfig {
  build_command: string;
  build_cwd: string;
  registry_command: string;
  watch_dirs: string[];
  watch_extensions: string[];
  debounce_ms: number;
}

export interface RenderConfig {
  resolution: [number, number];
  colorscheme: string;
  fn: number;
  autocenter: boolean;
  viewall: boolean;
}

export interface StlConfig {
  scales: number[];
}

export interface ModelVariant {
  name: string;
  scad: string;
  angles: string; // camera set name (e.g. "standard", "full")
}

export interface ModelConfig {
  name: string;
  type: "vitamin" | "vitamin_assembly" | "component" | "assembly";
  scad: string;
  angles: string;
  stl: boolean;
  camera_distance?: number;
  variants?: ModelVariant[];
}

// -- Registry Types --

export interface RegistryEntry {
  name: string;
  type: string;
  stl: boolean;
}

// -- Validation Types --

export interface ValidationWarning {
  model: string;
  issue: "not_in_registry" | "not_in_config";
}

export interface ValidationResult {
  warnings: ValidationWarning[];
  valid_models: string[];
}

// -- WebSocket Message Types --

export type WsServerMessage =
  | { type: "connected"; models: ModelConfig[]; projects: ProjectGroup[]; config: { port: number; buildDir: string } }
  | { type: "build_start"; command: string }
  | { type: "build_complete"; success: boolean; error?: string; duration_ms: number }
  | { type: "render_start"; models: string[]; totalAngles: number }
  | { type: "render_progress"; model: string; angle: string; current: number; total: number }
  | { type: "render_complete"; duration_ms: number }
  | { type: "screenshot_updated"; model: string; angle: string; path: string; mtime: number }
  | { type: "stl_ready"; model: string; scale: number; path: string }
  | { type: "validation"; warnings: ValidationWarning[]; valid_models: string[] }
  | { type: "error"; message: string; context?: string };

export type WsClientMessage =
  | { type: "request_rebuild" }
  | { type: "request_render"; models?: string[] }
  | { type: "request_stl"; model: string; scale?: number };

// -- Build State --

export interface BuildState {
  building: boolean;
  rendering: boolean;
  lastBuild: number | null;
  lastValidation: ValidationResult | null;
  stlCache: Map<string, { path: string; sourceMtime: number }>;
  stlLocks: Map<string, Promise<string>>;
}
