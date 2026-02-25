import type { ServerWebSocket } from "bun";
import type { WsServerMessage, WsClientMessage, CadengConfig } from "./types.ts";

export type WsData = { id: string };

const clients = new Set<ServerWebSocket<WsData>>();

let onRebuild: (() => void) | null = null;
let onRender: ((models?: string[]) => void) | null = null;
let onStlRequest: ((model: string, scale?: number) => void) | null = null;
let onClientConnected: ((ws: ServerWebSocket<WsData>) => void) | null = null;

export function setHandlers(handlers: {
  onRebuild: () => void;
  onRender: (models?: string[]) => void;
  onStlRequest: (model: string, scale?: number) => void;
  onClientConnected?: (ws: ServerWebSocket<WsData>) => void;
}) {
  onRebuild = handlers.onRebuild;
  onRender = handlers.onRender;
  onStlRequest = handlers.onStlRequest;
  onClientConnected = handlers.onClientConnected ?? null;
}

export function sendTo(ws: ServerWebSocket<WsData>, message: WsServerMessage) {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    clients.delete(ws);
  }
}

export function broadcast(message: WsServerMessage) {
  const data = JSON.stringify(message);
  for (const ws of clients) {
    try {
      ws.send(data);
    } catch {
      clients.delete(ws);
    }
  }
}

export function getClientCount(): number {
  return clients.size;
}

export function createWebSocketHandler(config: CadengConfig) {
  return {
    open(ws: ServerWebSocket<WsData>) {
      clients.add(ws);
      const msg: WsServerMessage = {
        type: "connected",
        models: config.models,
        projects: config.projects ?? [],
        config: {
          port: config.project.port,
          buildDir: config.project.build_dir,
        },
      };
      ws.send(JSON.stringify(msg));
      console.log(
        `[ws] Client connected (${clients.size} total)`
      );
      onClientConnected?.(ws);
    },

    close(ws: ServerWebSocket<WsData>) {
      clients.delete(ws);
      console.log(
        `[ws] Client disconnected (${clients.size} total)`
      );
    },

    message(ws: ServerWebSocket<WsData>, raw: string | Buffer) {
      try {
        const msg = JSON.parse(
          typeof raw === "string" ? raw : raw.toString()
        ) as WsClientMessage;

        switch (msg.type) {
          case "request_rebuild":
            onRebuild?.();
            break;
          case "request_render":
            onRender?.(msg.models);
            break;
          case "request_stl":
            onStlRequest?.(msg.model, msg.scale);
            break;
          default:
            // Unknown message type — silently ignore
            break;
        }
      } catch {
        // Invalid JSON — ignore
      }
    },
  };
}
