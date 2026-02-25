import { readFileSync } from "fs";
import type {
  CadengConfig,
  ModelConfig,
  RegistryEntry,
  ValidationResult,
  ValidationWarning,
} from "./types.ts";

export function parseConfig(configPath: string): CadengConfig {
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch {
    throw new Error(
      `cadeng.yaml not found at ${configPath}. Create one or check the path.`
    );
  }

  let parsed: any;
  try {
    // Bun supports YAML.parse as a global (Bun v1.2+)
    // For older Bun versions, fall back to a simple approach
    if (typeof (globalThis as any).Bun !== "undefined") {
      // Bun has built-in YAML support via Bun's YAML module
      parsed = require("js-yaml")?.load?.(raw);
      if (!parsed) {
        // Bun 1.2+ supports importing YAML directly, but for parsing strings
        // we use the TOML-like approach
        parsed = JSON.parse(
          JSON.stringify(
            new Function(
              "return " + raw.replace(/^---\n/, "").replace(/\n---$/, "")
            )()
          )
        );
      }
    }
  } catch {
    // Bun native YAML parsing: import the file directly
  }

  // Primary approach: use Bun's built-in YAML file import
  if (!parsed) {
    try {
      // Write a temp import and use Bun's native YAML support
      const yamlModule = require(configPath);
      parsed = yamlModule.default || yamlModule;
    } catch {
      throw new Error(
        `Failed to parse cadeng.yaml. Check YAML syntax at ${configPath}.`
      );
    }
  }

  return validateConfig(parsed);
}

// Parse YAML string directly using Bun's built-in capabilities
export async function parseConfigAsync(
  configPath: string
): Promise<CadengConfig> {
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    throw new Error(
      `cadeng.yaml not found at ${configPath}. Create one or check the path.`
    );
  }

  const raw = await file.text();
  // Bun supports YAML parsing via file import
  // For string parsing, we import the file directly
  try {
    const mod = await import(configPath);
    const parsed = mod.default || mod;
    return validateConfig(parsed);
  } catch (e) {
    throw new Error(
      `Failed to parse cadeng.yaml: ${e instanceof Error ? e.message : e}`
    );
  }
}

function validateConfig(parsed: any): CadengConfig {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("cadeng.yaml is empty or not a valid YAML object.");
  }

  const required = ["project", "python", "render", "cameras", "camera_sets", "models"];
  for (const key of required) {
    if (!(key in parsed)) {
      throw new Error(`cadeng.yaml missing required section: '${key}'`);
    }
  }

  if (!parsed.project?.name) {
    throw new Error("cadeng.yaml: project.name is required");
  }
  if (!parsed.project?.build_dir) {
    throw new Error("cadeng.yaml: project.build_dir is required");
  }
  if (!parsed.project?.port) {
    parsed.project.port = 9090;
  }

  if (!parsed.python?.build_command) {
    throw new Error("cadeng.yaml: python.build_command is required");
  }
  if (!parsed.python?.registry_command) {
    throw new Error("cadeng.yaml: python.registry_command is required");
  }

  if (!parsed.stl) {
    parsed.stl = { scales: [100] };
  }

  // Validate model camera set references
  for (const model of parsed.models as ModelConfig[]) {
    if (model.angles && !(model.angles in parsed.camera_sets)) {
      console.warn(
        `Warning: Model '${model.name}' references unknown camera set '${model.angles}'. ` +
          `Available sets: ${Object.keys(parsed.camera_sets).filter((k) => k !== "default").join(", ")}`
      );
    }
  }

  return parsed as CadengConfig;
}

export function resolveAngles(
  model: ModelConfig,
  config: CadengConfig
): string[] {
  const setName =
    model.angles || config.camera_sets.default || "standard";
  const angleNames = config.camera_sets[setName];
  if (!angleNames) {
    console.warn(
      `Camera set '${setName}' not found for model '${model.name}'. Using 'iso' only.`
    );
    return ["iso"];
  }
  return angleNames;
}

export function getCameraString(
  angleName: string,
  model: ModelConfig,
  config: CadengConfig
): string {
  const base = config.cameras[angleName];
  if (!base) {
    console.warn(`Camera angle '${angleName}' not defined. Skipping.`);
    return "";
  }
  // If model has camera_distance override, replace the last component (dist)
  if (model.camera_distance !== undefined) {
    const parts = base.split(",");
    parts[parts.length - 1] = String(model.camera_distance);
    return parts.join(",");
  }
  return base;
}

export function validateRegistry(
  registryEntries: RegistryEntry[],
  configModels: ModelConfig[]
): ValidationResult {
  const registryNames = new Set(registryEntries.map((e) => e.name));
  const configNames = new Set(configModels.map((m) => m.name));

  // Collect variant registry names (these are referenced by models, not standalone)
  const variantRegistryNames = new Set<string>();
  for (const model of configModels) {
    if (model.variants) {
      for (const variant of model.variants) {
        // Derive the registry name from the variant SCAD path
        // e.g. build/esp32_c3_assembly_exploded.scad → esp32_c3_assembly_exploded
        const scadStem = variant.scad.split("/").pop()?.replace(".scad", "");
        if (scadStem) variantRegistryNames.add(scadStem);
      }
    }
  }

  const warnings: ValidationWarning[] = [];

  // Models in config but not in registry (stale config)
  for (const model of configModels) {
    if (!registryNames.has(model.name)) {
      warnings.push({ model: model.name, issue: "not_in_registry" });
    }
  }

  // Models in registry but not in config (undeclared)
  // Skip variant registry entries — they're referenced by a parent model
  for (const entry of registryEntries) {
    if (!configNames.has(entry.name) && !variantRegistryNames.has(entry.name)) {
      warnings.push({ model: entry.name, issue: "not_in_config" });
    }
  }

  const valid_models = configModels
    .filter((m) => registryNames.has(m.name))
    .map((m) => m.name);

  return { warnings, valid_models };
}
