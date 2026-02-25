import { watch, type FSWatcher } from "fs";
import type { CadengConfig } from "./types.ts";

export function createWatcher(
  config: CadengConfig,
  onTrigger: () => void
): FSWatcher[] {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const extensions = new Set(config.python.watch_extensions);

  function handleChange(eventType: string, filename: string | null) {
    if (!filename) return;

    // Check extension filter
    const ext = filename.includes(".")
      ? "." + filename.split(".").pop()
      : "";
    if (!extensions.has(ext)) return;

    // Debounce: reset timer on each event
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      console.log(`[watcher] Change detected: ${filename}`);
      onTrigger();
    }, config.python.debounce_ms);
  }

  const watchers: FSWatcher[] = [];

  for (const dir of config.python.watch_dirs) {
    try {
      const w = watch(dir, { recursive: true }, handleChange);
      watchers.push(w);
      console.log(`[watcher] Watching ${dir} (recursive)`);
    } catch (err) {
      console.error(
        `[watcher] Failed to watch ${dir}: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  return watchers;
}

export function stopWatchers(watchers: FSWatcher[]) {
  for (const w of watchers) {
    w.close();
  }
}
