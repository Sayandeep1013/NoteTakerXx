"use client";

import { useEffect } from "react";
import { useNotesStore, type CanvasViewport } from "@/store/notes";

const KEYS = {
  view: "nxtaker_canvas_view",
  legacyView: "canvas-pan",
  folderPan: "nxtaker_folder_pan",
  activeFolder: "nxtaker_active_folder_id",
  connections: "nxtaker_connections",
} as const;

const SAVE_DELAY = 400;

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function toView(value: unknown): CanvasViewport | null {
  const v = value as Partial<CanvasViewport> | null;
  if (!v || typeof v.panX !== "number" || typeof v.panY !== "number") return null;
  return { panX: v.panX, panY: v.panY, zoom: typeof v.zoom === "number" ? v.zoom : 1 };
}

/** Restores the viewport, per-folder views, open folder and connections; saves them (debounced) on change. */
export function useCanvasPersistence() {
  useEffect(() => {
    const view = toView(readJson(KEYS.view) ?? readJson(KEYS.legacyView));
    const folderPan = readJson(KEYS.folderPan);
    const connections = readJson(KEYS.connections);
    const activeFolder = (() => { try { return localStorage.getItem(KEYS.activeFolder); } catch { return null; } })();

    useNotesStore.setState((s) => {
      const restoredPans: Record<string, CanvasViewport> = {};
      if (folderPan && typeof folderPan === "object") {
        for (const [key, value] of Object.entries(folderPan)) {
          const v = toView(value);
          if (v) restoredPans[key] = v;
        }
      }
      if (view) restoredPans.root = view;
      return {
        folderPan: { ...s.folderPan, ...restoredPans },
        canvas: view ?? s.canvas,
        ...(Array.isArray(connections) && connections.length > 0 ? { connections } : {}),
      };
    });
    if (activeFolder) useNotesStore.getState().setActiveFolderId(activeFolder);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      clearTimeout(timer);
      timer = undefined;
      const s = useNotesStore.getState();
      try {
        localStorage.setItem(KEYS.view, JSON.stringify(s.folderPan.root ?? s.canvas));
        localStorage.setItem(KEYS.folderPan, JSON.stringify(s.folderPan));
        localStorage.setItem(KEYS.connections, JSON.stringify(s.connections));
        if (s.activeFolderId) localStorage.setItem(KEYS.activeFolder, s.activeFolderId);
        else localStorage.removeItem(KEYS.activeFolder);
      } catch {}
    };
    const unsub = useNotesStore.subscribe((s, prev) => {
      if (s.canvas === prev.canvas && s.folderPan === prev.folderPan && s.connections === prev.connections && s.activeFolderId === prev.activeFolderId) return;
      clearTimeout(timer);
      timer = setTimeout(flush, SAVE_DELAY);
    });
    window.addEventListener("pagehide", flush);
    return () => {
      unsub();
      window.removeEventListener("pagehide", flush);
      if (timer) flush();
    };
  }, []);
}
