"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useNotesStore, type Note as CanvasItem, type StrokePoint } from "@/store/notes";
import { usePhotoAdd } from "@/hooks/usePhotoAdd";
import { useCanvasPersistence } from "@/hooks/useCanvasPersistence";
import { DEMO_SPEC } from "@/lib/demo";
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from "@/lib/constants";
import Note from "./Note";
import FolderItem from "./FolderItem";
import PhotoItem from "./PhotoItem";
import DotGrid from "./DotGrid";
import ConnectionLayer from "./ConnectionLayer";
import StrokeLayer from "./StrokeLayer";
import CanvasHud from "./CanvasHud";
import Dock from "./Dock";
import UniversalSearch from "./UniversalSearch";
import SyncManager from "./SyncManager";
import ResourceMonitor from "./ResourceMonitor";

const DEMO_SHOWN_KEY = "nxtaker_demo_shown";
const SHOW_PERF_HUD = process.env.NODE_ENV !== "production";

function distanceToStroke(px: number, py: number, points: StrokePoint[]) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lenSq));
    best = Math.min(best, Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy)));
  }
  return best;
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || !!el?.isContentEditable;
}

type GestureMode = "idle" | "pan" | "draw" | "erase" | "pinch";

const EMPTY: CanvasItem[] = [];

export default function Canvas() {
  const notes = useNotesStore((s) => s.notes);
  const activeFolderId = useNotesStore((s) => s.activeFolderId);
  const badgeFilter = useNotesStore((s) => s.badgeFilter);
  const drawingMode = useNotesStore((s) => s.drawingMode);
  const eraserMode = useNotesStore((s) => s.eraserMode);
  const strokeColor = useNotesStore((s) => s.strokeColor);
  const badgeMode = useNotesStore((s) => s.badgeMode !== null);
  const { handlePhotoUpload } = usePhotoAdd();
  useCanvasPersistence();

  const surfaceRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const livePathRef = useRef<SVGPathElement>(null);
  const gesture = useRef({
    mode: "idle" as GestureMode,
    pointers: new Map<number, { x: number; y: number }>(),
    start: { x: 0, y: 0, panX: 0, panY: 0, zoom: 1, dist: 1 },
    points: [] as StrokePoint[],
    path: "",
  });

  // Pan/zoom is applied straight to the DOM: panning never re-renders React.
  // While the view is moving the world gets its own GPU layer (moving it is then
  // free); shortly after it settles the hint is dropped so text re-rasterises crisply.
  useLayoutEffect(() => {
    let settle: ReturnType<typeof setTimeout> | undefined;
    const apply = ({ panX, panY, zoom }: { panX: number; panY: number; zoom: number }, moving: boolean) => {
      const world = worldRef.current;
      if (!world) return;
      world.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom || 1})`;
      if (!moving) return;
      world.style.willChange = "transform";
      clearTimeout(settle);
      settle = setTimeout(() => { world.style.willChange = ""; }, 200);
    };
    apply(useNotesStore.getState().canvas, false);
    const unsub = useNotesStore.subscribe((s, prev) => { if (s.canvas !== prev.canvas) apply(s.canvas, true); });
    return () => { unsub(); clearTimeout(settle); };
  }, []);

  // Wheel: pan, or zoom with Ctrl/⌘ (also what trackpad pinch sends). Safari pinch uses gesture events.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    let safariGesture: { zoom: number } | null = null;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      const s = useNotesStore.getState();
      if (e.ctrlKey || e.metaKey) {
        if (safariGesture) return;
        const delta = Math.max(-30, Math.min(30, e.deltaY * unit));
        s.zoomBy(Math.exp(-delta * 0.006), { x: e.clientX, y: e.clientY });
        return;
      }
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
      s.setPan(s.canvas.panX - dx * unit, s.canvas.panY - dy * unit);
    };
    type SafariGestureEvent = Event & { scale: number; clientX: number; clientY: number };
    const onGestureStart = (e: Event) => { e.preventDefault(); safariGesture = { zoom: useNotesStore.getState().canvas.zoom || 1 }; };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as SafariGestureEvent;
      if (safariGesture) useNotesStore.getState().setZoom(safariGesture.zoom * g.scale, { x: g.clientX, y: g.clientY });
    };
    const onGestureEnd = (e: Event) => { e.preventDefault(); safariGesture = null; };
    // Stop the browser's own page zoom anywhere in the app.
    const blockPageZoom = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    el.addEventListener("gestureend", onGestureEnd);
    window.addEventListener("wheel", blockPageZoom, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      el.removeEventListener("gestureend", onGestureEnd);
      window.removeEventListener("wheel", blockPageZoom);
    };
  }, []);

  // Keyboard: zoom shortcuts and one Escape chain that backs out of whatever is active.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useNotesStore.getState();
      if ((e.ctrlKey || e.metaKey) && !isTyping(e.target)) {
        if (e.key === "+" || e.key === "=") { e.preventDefault(); s.zoomBy(ZOOM_STEP); }
        else if (e.key === "-") { e.preventDefault(); s.zoomBy(1 / ZOOM_STEP); }
        else if (e.key === "0") { e.preventDefault(); s.resetZoom(); }
        return;
      }
      if (e.key !== "Escape") return;
      if (s.arrowSourceId) s.setArrowSource(null);
      else if (s.connectionMode) s.setConnectionMode(null);
      else if (s.arrowMode) s.setArrowMode(false);
      else if (s.ropeMode) s.setRopeMode(false);
      else if (s.drawingMode) s.setDrawingMode(false);
      else if (s.eraserMode) s.setEraserMode(false);
      else if (s.badgeMode) s.setBadgeMode(null);
      else if (s.selectionMode !== "import" && !isTyping(e.target)) s.clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ctrl+V outside a text field: image → photo, text → note (first line becomes the title).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const file = items.find((it) => it.type.startsWith("image/"))?.getAsFile();
      if (file) {
        e.preventDefault();
        void handlePhotoUpload(file);
        return;
      }
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;
      e.preventDefault();
      const lines = text.split(/\r?\n/);
      const multi = lines.length > 1;
      useNotesStore.getState().addNoteWithContent({
        title: multi ? lines[0].trim() : "",
        body: multi ? lines.slice(1).join("\n").trimStart() : text,
      });
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [handlePhotoUpload]);

  // A saved folder may have been deleted on another device.
  useEffect(() => {
    if (!activeFolderId || notes.length === 0) return;
    if (!notes.some((item) => item.id === activeFolderId && item.type === "folder")) {
      useNotesStore.getState().setActiveFolderId(null);
    }
  }, [activeFolderId, notes]);

  // Seed the demo wall on a first visit — synchronously as sync becomes ready,
  // so the empty-state card never flashes first.
  useEffect(() => {
    const trySeed = () => {
      const s = useNotesStore.getState();
      try {
        if (localStorage.getItem(DEMO_SHOWN_KEY)) return;
        localStorage.setItem(DEMO_SHOWN_KEY, "1");
      } catch { return; }
      if (s.notes.length === 0 && !s.activeFolderId) s.seedFullDemo(DEMO_SPEC);
    };
    if (useNotesStore.getState().syncReady) trySeed();
    return useNotesStore.subscribe((s, prev) => { if (s.syncReady && !prev.syncReady) trySeed(); });
  }, []);

  const view = useMemo(() => {
    const notesOut: CanvasItem[] = [], folders: CanvasItem[] = [], photos: CanvasItem[] = [], strokes: CanvasItem[] = [];
    for (const item of notes) {
      if (item.parentId !== activeFolderId) continue;
      if (badgeFilter && (item.type === "folder" || item.type === "stroke" || !item.badges.includes(badgeFilter))) continue;
      if (item.type === "note") notesOut.push(item);
      else if (item.type === "photo") photos.push(item);
      else if (item.type === "folder") folders.push(item);
      else strokes.push(item);
    }
    return { notes: notesOut, folders, photos, strokes: strokes.length ? strokes : EMPTY, linkable: [...notesOut, ...photos] };
  }, [notes, activeFolderId, badgeFilter]);

  // ── Pointer gestures on empty canvas: pan, draw, erase, two-finger pinch ──

  const toWorld = (x: number, y: number) => {
    const { panX, panY, zoom } = useNotesStore.getState().canvas;
    return { x: (x - panX) / (zoom || 1), y: (y - panY) / (zoom || 1) };
  };

  const eraseAt = (clientX: number, clientY: number) => {
    const s = useNotesStore.getState();
    const p = toWorld(clientX, clientY);
    const tolerance = Math.max(8, 10 / (s.canvas.zoom || 1));
    for (const item of s.notes) {
      if (item.type !== "stroke" || item.parentId !== s.activeFolderId) continue;
      if (distanceToStroke(p.x, p.y, item.strokePoints ?? []) <= tolerance + (item.strokeWidth ?? 4)) s.deleteNote(item.id);
    }
  };

  const setLivePath = (d: string) => {
    gesture.current.path = d;
    livePathRef.current?.setAttribute("d", d);
  };

  const beginPinch = () => {
    const g = gesture.current;
    const [a, b] = [...g.pointers.values()];
    const { panX, panY, zoom } = useNotesStore.getState().canvas;
    g.mode = "pinch";
    g.points = [];
    setLivePath("");
    g.start = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, panX, panY, zoom: zoom || 1, dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  };

  const beginPan = (x: number, y: number) => {
    const { panX, panY, zoom } = useNotesStore.getState().canvas;
    gesture.current.mode = "pan";
    gesture.current.start = { x, y, panX, panY, zoom, dist: 1 };
    surfaceRef.current?.setAttribute("data-panning", "true");
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).classList.contains("canvas-pan-layer")) return;
    if (e.button !== 0 && e.button !== 1) return;
    const g = gesture.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pointers.size === 2) { beginPinch(); return; }
    if (g.pointers.size > 2) return;

    const s = useNotesStore.getState();
    if (s.eraserMode) {
      g.mode = "erase";
      eraseAt(e.clientX, e.clientY);
    } else if (s.drawingMode && e.button === 0) {
      g.mode = "draw";
      const p = toWorld(e.clientX, e.clientY);
      g.points = [p];
      setLivePath(`M${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    } else {
      if (s.selectionMode !== "import") s.clearSelection();
      if (s.connectionMode && !s.ropeMode) s.setConnectionMode(null);
      beginPan(e.clientX, e.clientY);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.pointers.has(e.pointerId)) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = useNotesStore.getState();

    if (g.mode === "pinch" && g.pointers.size >= 2) {
      const [a, b] = [...g.pointers.values()];
      const st = g.start;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, st.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / st.dist)));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const wx = (st.x - st.panX) / st.zoom, wy = (st.y - st.panY) / st.zoom;
      s.setView({ panX: mid.x - wx * zoom, panY: mid.y - wy * zoom, zoom });
    } else if (g.mode === "pan") {
      s.setPan(g.start.panX + e.clientX - g.start.x, g.start.panY + e.clientY - g.start.y);
    } else if (g.mode === "draw") {
      const p = toWorld(e.clientX, e.clientY);
      const prev = g.points[g.points.length - 1];
      if (Math.hypot(p.x - prev.x, p.y - prev.y) > 2 / (s.canvas.zoom || 1)) {
        g.points.push(p);
        setLivePath(`${g.path} L${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
      }
    } else if (g.mode === "erase") {
      eraseAt(e.clientX, e.clientY);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.pointers.delete(e.pointerId)) return;
    if (g.mode === "draw") {
      const s = useNotesStore.getState();
      s.addStroke(g.points, s.strokeColor, 4);
      g.points = [];
      setLivePath("");
    }
    if (g.mode === "pinch" && g.pointers.size === 1) {
      const [rest] = [...g.pointers.values()];
      beginPan(rest.x, rest.y);
      return;
    }
    if (g.pointers.size === 0) {
      g.mode = "idle";
      surfaceRef.current?.removeAttribute("data-panning");
    }
  };

  return (
    <>
      <div
        ref={surfaceRef}
        className="canvas-surface"
        data-tool={drawingMode ? "draw" : eraserMode ? "erase" : undefined}
        data-badge-mode={badgeMode || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => { if ((e.target as HTMLElement).classList.contains("canvas-pan-layer")) e.preventDefault(); }}
      >
        <DotGrid />
        {/* Receives presses on empty space; items sit above it in the world layer. */}
        <div className="canvas-pan-layer" style={{ position: "absolute", inset: 0, zIndex: 1 }} />
        <div ref={worldRef} className="canvas-world" style={{ zIndex: 2 }}>
          <ConnectionLayer items={view.linkable} />
          <StrokeLayer strokes={view.strokes} livePathRef={livePathRef} liveColor={strokeColor} />
          {view.notes.map((note) => <Note key={note.id} note={note} />)}
          {view.folders.map((folder) => <FolderItem key={folder.id} folder={folder} />)}
          {view.photos.map((photo) => <PhotoItem key={photo.id} photo={photo} />)}
        </div>
      </div>

      <CanvasHud isEmpty={view.notes.length + view.photos.length + view.folders.length === 0} />
      <Dock />
      <UniversalSearch />
      <SyncManager />
      {SHOW_PERF_HUD && <ResourceMonitor />}
    </>
  );
}
