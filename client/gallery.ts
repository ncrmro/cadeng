// CADeng Gallery — WebSocket client + DOM rendering

interface ModelInfo {
  name: string;
  type: string;
  stl: boolean;
  scad: string;
  angles: string;
  camera_distance?: number;
  variants?: { name: string; scad: string; angles: string }[];
}

interface ProjectGroup {
  name: string;
  label: string;
  models: string[];
}

interface Screenshot {
  model: string;
  angle: string;
  path: string;
  mtime: number;
}

// State
let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;
const screenshots = new Map<string, Screenshot>();
let models: ModelInfo[] = [];
let validModels: string[] = [];
let warnings: { model: string; issue: string }[] = [];
let stlScales: number[] = [100, 50, 25];
let buildDir = "cad/build";
let projectName = "CADeng Gallery";
let projects: ProjectGroup[] = [];
let activeProject: string | null = null;

// DOM refs
const $content = () => document.getElementById("content")!;
const $statusDot = () => document.getElementById("status-dot")!;
const $statusText = () => document.getElementById("status-text")!;
const $reconnecting = () => document.getElementById("reconnecting-banner")!;
const $progressFill = () => document.getElementById("progress-fill")!;
const $buildStatus = () => document.getElementById("build-status")!;
const $rebuildBtn = () => document.getElementById("rebuild-btn") as HTMLButtonElement;

function connectWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    reconnectAttempts = 0;
    $reconnecting().classList.remove("visible");
    updateStatus("connected", "Connected");
  };

  ws.onclose = () => {
    updateStatus("disconnected", "Disconnected");
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    } catch {
      // Ignore invalid messages
    }
  };
}

function scheduleReconnect() {
  $reconnecting().classList.add("visible");
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  setTimeout(connectWebSocket, delay);
}

function handleMessage(msg: any) {
  switch (msg.type) {
    case "connected":
      models = msg.models || [];
      projects = msg.projects || [];
      buildDir = msg.config?.buildDir || buildDir;
      // Restore activeProject from URL path (e.g. /project/stand)
      const pathMatch = location.pathname.match(/^\/project\/([^/]+)/);
      if (pathMatch) {
        const urlProject = pathMatch[1];
        if (projects.some((p) => p.name === urlProject)) {
          activeProject = urlProject;
        }
      }
      renderGallery();
      break;

    case "build_start":
      updateStatus("building", "Building...");
      $rebuildBtn().disabled = true;
      $buildStatus().textContent = `Building: ${msg.command}`;
      break;

    case "build_complete":
      if (msg.success) {
        $buildStatus().textContent = `Build complete (${msg.duration_ms}ms)`;
      } else {
        $buildStatus().textContent = `Build failed: ${msg.error}`;
      }
      updateStatus("connected", "Connected");
      break;

    case "validation":
      warnings = msg.warnings || [];
      validModels = msg.valid_models || [];
      renderGallery();
      break;

    case "render_start":
      updateStatus("rendering", `Rendering ${msg.totalAngles} screenshots...`);
      setProgress(0);
      break;

    case "render_progress":
      setProgress((msg.current / msg.total) * 100);
      $buildStatus().textContent = `Rendering ${msg.model}/${msg.angle} (${msg.current}/${msg.total})`;
      break;

    case "render_complete":
      updateStatus("connected", "Connected");
      setProgress(100);
      setTimeout(() => setProgress(0), 1000);
      $buildStatus().textContent = `Render complete (${msg.duration_ms}ms)`;
      $rebuildBtn().disabled = false;
      break;

    case "screenshot_updated":
      screenshots.set(`${msg.model}-${msg.angle}`, {
        model: msg.model,
        angle: msg.angle,
        path: msg.path,
        mtime: msg.mtime,
      });
      updateScreenshot(msg.model, msg.angle, msg.path, msg.mtime);
      break;

    case "stl_ready":
      $buildStatus().textContent = `STL ready: ${msg.model} (${msg.scale}%)`;
      break;

    case "error":
      $buildStatus().textContent = `Error: ${msg.message}`;
      console.error(`[cadeng] ${msg.context || "error"}: ${msg.message}`);
      break;
  }
}

function updateStatus(state: string, text: string) {
  const dot = $statusDot();
  dot.className = `status-dot ${state}`;
  $statusText().textContent = text;
}

function setProgress(pct: number) {
  $progressFill().style.width = `${pct}%`;
}

function updateScreenshot(model: string, angle: string, path: string, mtime: number) {
  const img = document.getElementById(`img-${model}-${angle}`) as HTMLImageElement;
  if (img) {
    img.src = `/build/${path.split("/").pop()}?t=${mtime}`;
  } else {
    // New screenshot — re-render the gallery
    renderGallery();
  }
}

function renderGallery() {
  const content = $content();

  if (models.length === 0 && screenshots.size === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <h2>No renders yet</h2>
        <p>Save a file to trigger a build, or click Rebuild.</p>
      </div>
    `;
    return;
  }

  let html = "";

  // Project tabs (only when projects exist)
  if (projects.length > 0) {
    html += `<div class="project-tabs">`;
    html += `<button class="project-tab${activeProject === null ? " active" : ""}" onclick="setProject(null)">All</button>`;
    for (const proj of projects) {
      const isActive = activeProject === proj.name;
      html += `<button class="project-tab${isActive ? " active" : ""}" onclick="setProject('${proj.name}')">${proj.label}</button>`;
    }
    html += `</div>`;
  }

  // Filter models by active project
  let visibleModels = models;
  if (activeProject !== null) {
    const proj = projects.find((p) => p.name === activeProject);
    if (proj) {
      const projModelNames = new Set(proj.models);
      visibleModels = models.filter((m) => projModelNames.has(m.name));
    }
  }

  const visibleModelNames = new Set(visibleModels.map((m) => m.name));

  // Validation warnings (only for visible models)
  const visibleWarnings = warnings.filter((w) => visibleModelNames.has(w.model));
  if (visibleWarnings.length > 0) {
    html += `<div class="warnings"><h3>Validation Warnings</h3><ul>`;
    for (const w of visibleWarnings) {
      const label =
        w.issue === "not_in_registry"
          ? `'${w.model}' is in cadeng.yaml but not found in Python registry (stale config)`
          : `'${w.model}' is in Python registry but not declared in cadeng.yaml`;
      html += `<li>${label}</li>`;
    }
    html += `</ul></div>`;
  }

  // Group screenshots by model
  const groups = new Map<string, Screenshot[]>();
  for (const model of visibleModels) {
    groups.set(model.name, []);
  }
  for (const ss of screenshots.values()) {
    if (!visibleModelNames.has(ss.model)) continue;
    const list = groups.get(ss.model) || [];
    list.push(ss);
    groups.set(ss.model, list);
  }

  // Build type lookup from full model objects
  const modelTypeMap = new Map<string, string>();
  for (const m of models) {
    modelTypeMap.set(m.name, m.type);
  }

  // Sort models: assemblies first, then components, then vitamin assemblies, then vitamins
  const typeOrder: Record<string, number> = { assembly: 0, component: 1, vitamin_assembly: 2, vitamin: 3 };
  const sortedEntries = [...groups.entries()].sort((a, b) => {
    const aType = modelTypeMap.get(a[0]) || "component";
    const bType = modelTypeMap.get(b[0]) || "component";
    return (typeOrder[aType] ?? 1) - (typeOrder[bType] ?? 1);
  });

  for (const [modelName, shots] of sortedEntries) {
    const modelWarnings = warnings.filter((w) => w.model === modelName);
    const isValid = validModels.includes(modelName);

    html += `<div class="model-group">`;
    html += `<div class="model-group-header">`;
    html += `<h2>${modelName}</h2>`;
    if (modelWarnings.length > 0) {
      html += `<span class="model-badge warning">warning</span>`;
    } else if (isValid) {
      const modelType = modelTypeMap.get(modelName) || "component";
      const badgeLabel = modelType === "vitamin_assembly" ? "vitamin assembly" : modelType;
      html += `<span class="model-badge">${badgeLabel}</span>`;
    }
    html += `</div>`;

    if (shots.length > 0) {
      html += `<div class="screenshot-grid">`;
      // Sort: standard angles first, then variant angles alphabetically
      const angleOrder = ["iso", "front", "back", "top", "right", "left"];
      shots.sort((a, b) => {
        const ai = angleOrder.indexOf(a.angle);
        const bi = angleOrder.indexOf(b.angle);
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1;
        if (bi >= 0) return 1;
        return a.angle.localeCompare(b.angle);
      });

      for (const ss of shots) {
        const filename = ss.path.split("/").pop();
        html += `
          <div class="screenshot-card" onclick="openLightbox('/build/${filename}?t=${ss.mtime}', '${modelName} — ${ss.angle}')">
            <img id="img-${ss.model}-${ss.angle}" src="/build/${filename}?t=${ss.mtime}" alt="${modelName} ${ss.angle}" loading="lazy" />
            <div class="card-footer">
              <span class="angle-label">${ss.angle}</span>
            </div>
          </div>
        `;
      }
      html += `</div>`;
    } else {
      html += `<p style="color: var(--text-muted); font-size: 0.9rem;">No screenshots yet</p>`;
    }

    // STL buttons (only when model has stl: true in config)
    const modelStl = models.find((m) => m.name === modelName)?.stl;
    if (isValid && modelStl !== false) {
      html += `<div class="stl-buttons">`;
      for (const scale of stlScales) {
        const label = scale === 100 ? "STL" : `STL ${scale}%`;
        html += `<button class="stl-btn" onclick="downloadStl('${modelName}', ${scale})">${label}</button>`;
      }
      html += `</div>`;
    }

    html += `</div>`;
  }

  content.innerHTML = html;
}

// Global functions for onclick handlers
(window as any).openLightbox = function (src: string, caption: string) {
  const lightbox = document.getElementById("lightbox")!;
  const img = document.getElementById("lightbox-img") as HTMLImageElement;
  const cap = document.getElementById("lightbox-caption")!;
  img.src = src;
  cap.textContent = caption;
  lightbox.classList.add("open");
};

(window as any).closeLightbox = function () {
  document.getElementById("lightbox")!.classList.remove("open");
};

(window as any).downloadStl = function (model: string, scale: number) {
  const url = `/stl/${model}${scale !== 100 ? `?scale=${scale}` : ""}`;
  window.open(url, "_blank");
};

(window as any).setProject = function (name: string | null) {
  activeProject = name;
  const url = name ? `/project/${name}` : "/";
  history.pushState({ project: name }, "", url);
  renderGallery();
};

(window as any).requestRebuild = function () {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "request_rebuild" }));
  }
};

// Lightbox keyboard close
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    (window as any).closeLightbox();
  }
});

// Browser back/forward navigation
window.addEventListener("popstate", (e) => {
  const state = e.state as { project: string | null } | null;
  activeProject = state?.project ?? null;
  renderGallery();
});

// Initialize
connectWebSocket();
