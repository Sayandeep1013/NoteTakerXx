"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNotesStore } from "@/store/notes";
import Note from "./Note";
import FolderItem from "./FolderItem";
import PhotoItem from "./PhotoItem";
import DotGrid from "./DotGrid";
import Sidebar from "./Sidebar";
import ResourceMonitor from "./ResourceMonitor";
import ConnectionLayer from "./ConnectionLayer";
import UniversalSearch from "./UniversalSearch";
import { useHudScale } from "@/hooks/useHudScale";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { usePhotoAdd } from "@/hooks/usePhotoAdd";
import { NOTE_COLOR_KEYS, type NoteColor } from "@/lib/colors";
import type { FullDemoSpec } from "@/store/notes";
import upiQr from "../../images/upi qr.jpeg";

const SHOW_COFFEE_BUTTON = true;
const ACTIVE_FOLDER_KEY = "nxtaker_active_folder_id";
const FOLDER_PAN_KEY = "nxtaker_folder_pan";
const CANVAS_VIEW_KEY = "nxtaker_canvas_view";
const CONNECTIONS_KEY = "nxtaker_connections";
const ZOOM_STEP = 1.15;

function randomNoteColor(): NoteColor {
  return NOTE_COLOR_KEYS[Math.floor(Math.random() * NOTE_COLOR_KEYS.length)];
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distanceToStroke(point: { x: number; y: number }, points: { x: number; y: number }[]) {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return Math.hypot(point.x - points[0].x, point.y - points[0].y);
  let best = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    best = Math.min(best, distanceToSegment(point.x, point.y, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y));
  }
  return best;
}

export default function Canvas() {
  const {
    notes, canvas, folderPan, connections, setPan, setZoom, zoomBy, resetZoom, addNote, addNoteWithContent, addStroke, deleteNote,
    connectionMode, setConnectionMode, badgeFilter,
    coffeeVisible, setCoffeeVisible, activeFolderId, goToParentFolder, setActiveFolderId,
    selectedItemIds, clearSelection, moveItemsToFolder, setSelectionMode,
    drawingMode, eraserMode, strokeColor, setDrawingMode, setEraserMode,
    arrowMode, setArrowMode, ropeMode, setRopeMode,
    syncReady, seedFullDemo,
  } = useNotesStore();
  const { user } = useAuth();
  const { handlePhotoUpload } = usePhotoAdd(user);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const demoSeeded = useRef(false);
  const panState = useRef({ active: false, startX: 0, startY: 0, panX: 0, panY: 0 });
  const panRef = useRef({ x: canvas.panX, y: canvas.panY, zoom: canvas.zoom || 1 });
  panRef.current = { x: canvas.panX, y: canvas.panY, zoom: canvas.zoom || 1 };
  const drawingRef = useRef<{ active: boolean; points: { x: number; y: number }[] }>({ active: false, points: [] });
  const [liveStroke, setLiveStroke] = useState<{ x: number; y: number }[] | null>(null);
  const [cursor, setCursor] = useState<"default" | "grabbing">("default");
  const [importTargetFolderId, setImportTargetFolderId] = useState<string | null>(null);
  const hudScale = useHudScale();
  const activeFolder = activeFolderId ? notes.find((item) => item.id === activeFolderId) : null;

  const screenToWorld = (clientX: number, clientY: number) => {
    const { x, y, zoom } = panRef.current;
    return { x: (clientX - x) / zoom, y: (clientY - y) / zoom };
  };

  // Load initial pan position
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CANVAS_VIEW_KEY) ?? localStorage.getItem("canvas-pan");
      if (saved) {
        const { panX, panY, zoom } = JSON.parse(saved);
        if (typeof panX === "number" && typeof panY === "number") {
          useNotesStore.setState((state) => {
            const canvas = { panX, panY, zoom: typeof zoom === "number" ? zoom : state.canvas.zoom || 1 };
            return { canvas, folderPan: { ...state.folderPan, root: canvas } };
          });
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FOLDER_PAN_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== "object") return;
      const normalized = Object.fromEntries(Object.entries(parsed).map(([key, value]) => {
        const view = value as { panX?: number; panY?: number; zoom?: number };
        return [key, {
          panX: typeof view.panX === "number" ? view.panX : 320,
          panY: typeof view.panY === "number" ? view.panY : 240,
          zoom: typeof view.zoom === "number" ? view.zoom : 1,
        }];
      }));
      useNotesStore.setState((state) => ({ folderPan: { ...state.folderPan, ...normalized } }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const savedFolderId = localStorage.getItem(ACTIVE_FOLDER_KEY);
      if (savedFolderId) setActiveFolderId(savedFolderId);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (activeFolderId) localStorage.setItem(ACTIVE_FOLDER_KEY, activeFolderId);
      else localStorage.removeItem(ACTIVE_FOLDER_KEY);
    } catch {}
  }, [activeFolderId]);

  useEffect(() => {
    if (!activeFolderId || notes.length === 0) return;
    const folderExists = notes.some((item) => item.id === activeFolderId && item.type === "folder");
    if (!folderExists) setActiveFolderId(null);
  }, [activeFolderId, notes, setActiveFolderId]);

  // Load saved connections
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONNECTIONS_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        useNotesStore.setState({ connections: parsed });
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save pan position + connections when they change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("canvas-pan", JSON.stringify(canvas));
        localStorage.setItem(CANVAS_VIEW_KEY, JSON.stringify(canvas));
        localStorage.setItem(FOLDER_PAN_KEY, JSON.stringify(folderPan));
        localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(connections));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [canvas, folderPan, connections]);

  // Non-passive wheel to preventDefault and pan
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        zoomBy(factor, { x: e.clientX, y: e.clientY });
        return;
      }
      setPan(panRef.current.x - e.deltaX, panRef.current.y - e.deltaY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPan, zoomBy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (editing) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(ZOOM_STEP); }
      if (e.key === "-") { e.preventDefault(); zoomBy(1 / ZOOM_STEP); }
      if (e.key === "0") { e.preventDefault(); resetZoom(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resetZoom, zoomBy]);

  // Escape cancels connection/arrow/rope mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (connectionMode) setConnectionMode(null);
      if (arrowMode) setArrowMode(false);
      if (ropeMode && connectionMode) setConnectionMode(null); // cancel mid-rope
      else if (ropeMode) setRopeMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectionMode, setConnectionMode, arrowMode, setArrowMode, ropeMode, setRopeMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedItemIds.length > 0 && !importTargetFolderId) clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection, importTargetFolderId, selectedItemIds.length]);

  // Ctrl+V paste: text → new note, image → new photo
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      // Don't intercept paste inside inputs/textareas/contenteditable
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) return;

      const items = Array.from(e.clipboardData?.items ?? []);

      // Image takes priority over text
      const imageItem = items.find((it) => it.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          e.preventDefault();
          await handlePhotoUpload(file);
          return;
        }
      }

      // Plain text → new note
      const textItem = items.find((it) => it.type === "text/plain");
      if (textItem) {
        e.preventDefault();
        textItem.getAsString((raw) => {
          const text = raw.trim();
          if (!text) return;
          // If multiple lines, first line becomes title, rest becomes body
          const lines = text.split(/\r?\n/);
          const title = lines.length > 1 ? lines[0].trim() : "";
          const body = lines.length > 1 ? lines.slice(1).join("\n").trimStart() : text;
          addNoteWithContent({ title, body });
        });
      }
    };

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlePhotoUpload, addNoteWithContent]);

  // Seed demo content on first ever visit (once syncReady, canvas is empty, flag not set)
  useEffect(() => {
    if (!syncReady || demoSeeded.current) return;
    if (activeFolderId) return; // only on root canvas
    demoSeeded.current = true;
    const alreadyShown = typeof localStorage !== "undefined" && localStorage.getItem("nxtaker_demo_shown");
    if (alreadyShown || notes.length > 0) return;
    localStorage.setItem("nxtaker_demo_shown", "1");
    seedFullDemo(DEMO_SPEC);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncReady]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only activate pan on the backdrop (canvas-pan-layer), not on notes
    const target = e.target as HTMLElement;
    if (!target.classList.contains("canvas-pan-layer")) return;
    if (eraserMode) {
      const point = screenToWorld(e.clientX, e.clientY);
      const zoom = panRef.current.zoom || 1;
      const hitThreshold = Math.max(10 / zoom, 8);
      const hit = notes
        .filter((item) => item.parentId === activeFolderId && item.type === "stroke")
        .map((stroke) => ({
          stroke,
          distance: distanceToStroke(point, stroke.strokePoints ?? []),
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (hit && hit.distance <= hitThreshold + (hit.stroke.strokeWidth ?? 4)) {
        e.preventDefault();
        e.stopPropagation();
        deleteNote(hit.stroke.id);
      }
      return;
    }
    if (drawingMode) {
      const point = screenToWorld(e.clientX, e.clientY);
      drawingRef.current = { active: true, points: [point] };
      setLiveStroke([point]);
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      return;
    }
    if (!importTargetFolderId) clearSelection();
    panState.current = { active: true, startX: e.clientX, startY: e.clientY, panX: canvas.panX, panY: canvas.panY };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setCursor("grabbing");
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drawingRef.current.active) {
      const point = screenToWorld(e.clientX, e.clientY);
      const prev = drawingRef.current.points.at(-1);
      if (!prev || Math.hypot(point.x - prev.x, point.y - prev.y) > 2) {
        drawingRef.current.points = [...drawingRef.current.points, point];
        setLiveStroke(drawingRef.current.points);
      }
      return;
    }
    if (!panState.current.active) return;
    setPan(panState.current.panX + e.clientX - panState.current.startX, panState.current.panY + e.clientY - panState.current.startY);
  };

  const onPointerUp = () => {
    if (drawingRef.current.active) {
      addStroke(drawingRef.current.points, strokeColor, 4);
      drawingRef.current = { active: false, points: [] };
      setLiveStroke(null);
    }
    panState.current.active = false;
    setCursor("default");
  };
  const visibleItems = notes.filter((item) => item.parentId === activeFolderId);
  const visibleNotes = (badgeFilter ? visibleItems.filter((note) => note.badges.includes(badgeFilter)) : visibleItems)
    .filter((item) => item.type === "note");
  const visibleFolders = badgeFilter ? [] : visibleItems.filter((item) => item.type === "folder");
  const visiblePhotos = badgeFilter ? visibleItems.filter((item) => item.type === "photo" && item.badges.includes(badgeFilter)) : visibleItems.filter((item) => item.type === "photo");
  const visibleStrokes = badgeFilter ? [] : visibleItems.filter((item) => item.type === "stroke");

  return (
    <div
      ref={surfaceRef}
      className="canvas-surface"
      style={{ cursor: drawingMode ? "crosshair" : eraserMode ? "cell" : cursor, userSelect: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* SVG noise filter */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id="paper-noise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
      </svg>

      {/* Reactive dot grid — always covers full viewport */}
      <DotGrid />

      {/* Pan backdrop — sits above dot grid, BELOW canvas-world.
          Receives pointer events only when no note is under cursor
          (notes have pointer-events: auto and stop propagation) */}
      <div
        className="canvas-pan-layer"
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
      />

      {/* World — pointer-events: none; notes re-enable with inline pointerEvents: auto */}
      <div
        className="canvas-world"
        style={{ transform: `translate(${canvas.panX}px, ${canvas.panY}px) scale(${canvas.zoom || 1})`, zIndex: 2 }}
      >
        <ConnectionLayer notes={[...visibleNotes, ...visiblePhotos]} gridUnit={80} />
        <StrokeLayer strokes={visibleStrokes} liveStroke={liveStroke} liveColor={strokeColor} eraserMode={eraserMode} />
        {visibleNotes.map((note) => (
          <Note key={note.id} note={note} gridUnit={80} />
        ))}
        {visibleFolders.map((folder) => (
          <FolderItem key={folder.id} folder={folder} items={notes} gridUnit={80} />
        ))}
        {visiblePhotos.map((photo) => (
          <PhotoItem key={photo.id} photo={photo} gridUnit={80} />
        ))}
      </div>

      {/* Vignette — subtle depth at canvas edges */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3,
        background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.07) 100%)",
      }} />

      {/* Photo FAB — stacked above the note FAB */}
      <div
        style={{
          position: "fixed",
          bottom: 96,
          right: 36,
          zIndex: 509,
        }}
      >
        <button
          onClick={() => photoInputRef.current?.click()}
          title="Add photo"
          style={{
            width: 46, height: 46, borderRadius: "50%",
            background: "var(--bg-sidebar)",
            border: "1.5px solid var(--sidebar-border)",
            color: "var(--text-ui)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 150ms, box-shadow 150ms",
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget as HTMLElement;
            b.style.transform = "scale(1.08)";
            b.style.boxShadow = "0 6px 24px rgba(0,0,0,0.26)";
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget as HTMLElement;
            b.style.transform = "scale(1)";
            b.style.boxShadow = "0 4px 16px rgba(0,0,0,0.18)";
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="2" y="4" width="16" height="13" rx="2.2" stroke="currentColor" strokeWidth="1.7"/>
            <path d="M2.5 8.5l3-3 3 3 3.5-4 4.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="14.5" cy="7" r="1.3" fill="currentColor"/>
          </svg>
        </button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.currentTarget.value = "";
            if (!file) return;
            void handlePhotoUpload(file);
          }}
        />
      </div>

      {/* Note FAB */}
      <div
        style={{
          position: "fixed",
          bottom: 32,
          right: 32,
          zIndex: 510,
          transform: `scale(${hudScale})`,
          transformOrigin: "bottom right",
        }}
      >
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "var(--accent)",
          animation: "pulse-ring 2.4s ease-out infinite",
          pointerEvents: "none",
        }} />
        <button
          onClick={addNote}
          title="New note"
          style={{
            position: "relative",
            width: 52, height: 52, borderRadius: "50%",
            background: "var(--accent)",
            border: "none",
            color: "#fff",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 150ms, box-shadow 150ms",
            boxShadow: "0 4px 20px rgba(92,107,192,0.45)",
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget as HTMLElement;
            b.style.transform = "scale(1.08)";
            b.style.boxShadow = "0 6px 28px rgba(92,107,192,0.6)";
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget as HTMLElement;
            b.style.transform = "scale(1)";
            b.style.boxShadow = "0 4px 20px rgba(92,107,192,0.45)";
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M11 4.5v13M4.5 11h13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <ZoomHud
        zoom={canvas.zoom || 1}
        onZoomOut={() => zoomBy(1 / ZOOM_STEP)}
        onZoomIn={() => zoomBy(ZOOM_STEP)}
        onReset={resetZoom}
        onDisableDrawing={() => setDrawingMode(false)}
        onDisableEraser={() => setEraserMode(false)}
        drawingMode={drawingMode}
        eraserMode={eraserMode}
      />

      {SHOW_COFFEE_BUTTON && coffeeVisible && <CoffeeButton onHide={() => setCoffeeVisible(false)} />}

      {activeFolderId && !importTargetFolderId && (
        <FolderNavigation
          title={activeFolder?.folderName ?? activeFolder?.title ?? "Folder"}
          onBack={goToParentFolder}
          onImport={() => {
            const targetId = activeFolderId;
            const parentId = activeFolder?.parentId ?? null;
            clearSelection();
            setImportTargetFolderId(targetId);
            setSelectionMode("import");
            setActiveFolderId(parentId);
          }}
        />
      )}

      {importTargetFolderId && (
        <ImportBar
          count={selectedItemIds.length}
          onCancel={() => {
            const target = importTargetFolderId;
            clearSelection();
            setSelectionMode("normal");
            setImportTargetFolderId(null);
            setActiveFolderId(target);
          }}
          onConfirm={() => {
            const target = importTargetFolderId;
            moveItemsToFolder(selectedItemIds, target);
            setSelectionMode("normal");
            setImportTargetFolderId(null);
            setActiveFolderId(target);
          }}
        />
      )}

      {ropeMode && !connectionMode && (
        <ModeBanner onClick={() => setRopeMode(false)} color="#c0392b" shadow="rgba(192,57,43,0.45)">
          Rope mode — click a note to start, click another to connect · Esc to exit
        </ModeBanner>
      )}
      {connectionMode && (
        <ModeBanner onClick={() => setConnectionMode(null)} color="#d84a42" shadow="rgba(231,76,60,0.4)">
          {ropeMode
            ? "Click another note to connect with a rope · click here to cancel"
            : "Shift+click another note to connect · click here or Esc to cancel"}
        </ModeBanner>
      )}
      {arrowMode && (
        <ModeBanner onClick={() => setArrowMode(false)} color="var(--accent)" shadow="rgba(92,107,192,0.45)">
          Arrow mode — click an edge dot on a note, then another note&apos;s edge dot · Esc to cancel
        </ModeBanner>
      )}

      <Sidebar />
      <UniversalSearch />
      <ResourceMonitor />

      {/* Subtle loader while notes are being fetched — prevents FirstRunGuide flash */}
      {!syncReady && <CanvasLoader />}

      {/* Empty-canvas guide — only after sync is done and demo is not being seeded */}
      {syncReady && notes.length === 0 && !activeFolderId && (
        typeof localStorage !== "undefined" && localStorage.getItem("nxtaker_demo_shown")
          ? <FirstRunGuide onAddNote={addNote} />
          : null
      )}
    </div>
  );
}

function StrokeLayer({
  strokes,
  liveStroke,
  liveColor,
  eraserMode,
}: {
  strokes: ReturnType<typeof useNotesStore.getState>["notes"];
  liveStroke: { x: number; y: number }[] | null;
  liveColor: string;
  eraserMode: boolean;
}) {
  const deleteNote = useNotesStore((s) => s.deleteNote);
  const selectedItemIds = useNotesStore((s) => s.selectedItemIds);
  const toggleSelectedItem = useNotesStore((s) => s.toggleSelectedItem);
  const clearSelection = useNotesStore((s) => s.clearSelection);

  const pathFor = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  };

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 4,
      }}
    >
      {strokes.map((stroke) => {
        const points = stroke.strokePoints ?? [];
        if (points.length < 2) return null;
        const selected = selectedItemIds.includes(stroke.id);
        return (
          <g key={stroke.id} style={{ pointerEvents: "stroke", cursor: eraserMode ? "cell" : "pointer" }}>
            <path
              d={pathFor(points)}
              stroke={stroke.strokeColor ?? "#7c8fd8"}
              strokeWidth={stroke.strokeWidth ?? 4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
            {selected && (
              <path
                d={pathFor(points)}
                stroke="var(--accent)"
                strokeWidth={(stroke.strokeWidth ?? 4) + 8}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.22}
              />
            )}
            <path
              d={pathFor(points)}
              stroke="transparent"
              strokeWidth={Math.max(16, (stroke.strokeWidth ?? 4) + 10)}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              onClick={(e) => {
                e.stopPropagation();
                if (eraserMode) {
                  deleteNote(stroke.id);
                  return;
                }
                if (!e.ctrlKey && !e.metaKey) clearSelection();
                toggleSelectedItem(stroke.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                deleteNote(stroke.id);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteNote(stroke.id);
              }}
            />
          </g>
        );
      })}
      {liveStroke && liveStroke.length > 1 && (
        <path
          d={pathFor(liveStroke)}
          stroke={liveColor}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.78}
          style={{ pointerEvents: "none" }}
        />
      )}
    </svg>
  );
}

function ZoomHud({
  zoom,
  onZoomOut,
  onZoomIn,
  onReset,
  onDisableDrawing,
  onDisableEraser,
  drawingMode,
  eraserMode,
}: {
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onReset: () => void;
  onDisableDrawing: () => void;
  onDisableEraser: () => void;
  drawingMode: boolean;
  eraserMode: boolean;
}) {
  return (
    <div style={{ position: "fixed", left: 58, bottom: 18, zIndex: 999999, display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{
        height: 46,
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        borderRadius: 10,
        background: "var(--bg-sidebar)",
        border: "1px solid var(--sidebar-border)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
      }}>
        <ZoomButton label="-" title="Zoom out" onClick={onZoomOut} />
        <button
          onClick={onReset}
          title="Reset zoom"
          style={{
            width: 70,
            height: 46,
            border: "none",
            background: "transparent",
            color: "var(--text-ui)",
            fontFamily: "inherit",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <ZoomButton label="+" title="Zoom in" onClick={onZoomIn} />
      </div>
      {drawingMode && (
        <button
          onClick={onDisableDrawing}
          title="Exit drawing mode"
          style={{
            height: 36,
            padding: "0 12px",
            borderRadius: 9,
            border: "1px solid var(--sidebar-border)",
            background: "var(--bg-sidebar)",
            color: "var(--accent)",
            fontFamily: "inherit",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Pen
        </button>
      )}
      {eraserMode && (
        <button
          onClick={onDisableEraser}
          title="Exit eraser mode"
          style={{
            height: 36,
            padding: "0 12px",
            borderRadius: 9,
            border: "1px solid var(--sidebar-border)",
            background: "var(--bg-sidebar)",
            color: "var(--accent)",
            fontFamily: "inherit",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Eraser
        </button>
      )}
    </div>
  );
}

// ── Note-style notification / toast ─────────────────────────────
// Looks like a sticky note so hints feel like part of the canvas.

function ModeBanner({ children, onClick, color, shadow }: {
  children: React.ReactNode;
  onClick: () => void;
  color: string;
  shadow: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
        background: color,
        color: "#fff", fontSize: 12, fontWeight: 600,
        padding: "7px 18px", borderRadius: 20,
        zIndex: 490, cursor: "pointer",
        boxShadow: `0 4px 16px ${shadow}`,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

// ── Full demo spec seeded on first visit ──────────────────────────────────
// Grid unit = 80px. Stroke coords are world pixel coords.
// Connections use indices into the notes/photos arrays.

const DEMO_SPEC: FullDemoSpec = {
  // 2 notes
  notes: [
    {
      title: "Welcome to NoteTakerXX",
      body: "Your infinite canvas for ideas.\n\n- Drag the dots at the top of a note to move it\n- Double-click to edit\n- Ctrl+V to paste text or images\n- Right-click for more options",
      x: 0, y: 0, w: 5, h: 4, color: "yellow", rotation: -1.5,
    },
    {
      title: "Connect & Draw",
      body: "- Rope mode: strings notes together\n- Arrow mode: directed connections\n- Pen tool: sketch freehand\n- Eraser: removes strokes only",
      x: 6, y: 1, w: 4, h: 4, color: "mint", rotation: 1,
    },
  ],

  // The Berserk image from public/images
  photos: [
    {
      url: "/images/guts-5k-berserk-5120x2880-13631.jpg",
      caption: "Berserk",
      x: 11, y: 0, w: 6, h: 4, rotation: 0.5,
    },
  ],

  // Pen strokes (world pixel coords)
  strokes: [
    {
      // Wavy underline below Note 1 (note bottom edge at y=320)
      color: "#e58aa9",
      width: 3,
      points: [
        { x: 30,  y: 345 }, { x: 60,  y: 338 }, { x: 90,  y: 348 },
        { x: 120, y: 338 }, { x: 150, y: 348 }, { x: 180, y: 338 },
        { x: 210, y: 348 }, { x: 240, y: 338 }, { x: 270, y: 348 },
        { x: 300, y: 338 }, { x: 330, y: 348 }, { x: 360, y: 340 },
      ],
    },
    {
      // Short squiggle below Note 2 (note bottom edge at y=400)
      color: "#7c8fd8",
      width: 3,
      points: [
        { x: 490, y: 428 }, { x: 525, y: 420 }, { x: 560, y: 432 },
        { x: 595, y: 420 }, { x: 630, y: 432 }, { x: 665, y: 422 },
        { x: 700, y: 430 }, { x: 735, y: 420 }, { x: 770, y: 428 },
      ],
    },
  ],

  // 1 rope + 1 arrow connection
  connections: [
    {
      // Rope: Note 0 → Note 1
      sourceType: "note", sourceIdx: 0,
      targetType: "note", targetIdx: 1,
      connectionType: "rope",
      color: "#e74c3c",
    },
    {
      // Arrow: Note 1 right edge → Photo left edge
      sourceType: "note", sourceIdx: 1,
      targetType: "photo", targetIdx: 0,
      connectionType: "arrow",
      sourceAnchor: "right",
      targetAnchor: "left",
      color: "var(--accent)",
    },
  ],

  // Zoom out slightly so everything fits in the initial viewport
  initialCanvas: { panX: 80, panY: 100, zoom: 0.75 },
};

// ── Subtle canvas loader ────────────────────────────────────────────────────

function CanvasLoader() {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 18,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 480,
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "6px 14px",
        borderRadius: 999,
        background: "var(--bg-sidebar)",
        border: "1px solid var(--sidebar-border)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.14)",
        pointerEvents: "none",
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: "var(--accent)",
        display: "inline-block",
        animation: "loaderPulse 1.1s ease-in-out infinite",
      }} />
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: "var(--accent)",
        display: "inline-block",
        animation: "loaderPulse 1.1s ease-in-out infinite 0.22s",
      }} />
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: "var(--accent)",
        display: "inline-block",
        animation: "loaderPulse 1.1s ease-in-out infinite 0.44s",
      }} />
      <style>{`
        @keyframes loaderPulse {
          0%, 80%, 100% { opacity: 0.22; transform: scale(0.85); }
          40%            { opacity: 1;    transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function FirstRunGuide({ onAddNote }: { onAddNote: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        top: "46%",
        transform: "translate(-50%, -50%)",
        width: "min(560px, calc(100vw - 40px))",
        zIndex: 480,
        padding: "22px 24px",
        borderRadius: 16,
        background: "var(--bg-sidebar)",
        border: "1px solid var(--sidebar-border)",
        color: "var(--text-ui)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.20)",
        textAlign: "center",
        pointerEvents: "auto",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Start your canvas</div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-muted)", marginBottom: 16 }}>
        Press the plus button to add your first sticky note. Use the dock for search, images, folders, badges, pen, and eraser. Drag empty space to pan, and use the zoom controls at the bottom left.
      </div>
      <button
        onClick={onAddNote}
        style={{
          height: 38, padding: "0 16px", borderRadius: 10,
          border: "none", background: "var(--accent)",
          color: "#fff", fontFamily: "inherit",
          fontWeight: 850, cursor: "pointer",
        }}
      >
        Add first note
      </button>
    </div>
  );
}

function ZoomButton({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 48,
        height: 46,
        border: "none",
        borderRight: label === "-" ? "1px solid rgba(128,128,128,0.18)" : "none",
        borderLeft: label === "+" ? "1px solid rgba(128,128,128,0.18)" : "none",
        background: "transparent",
        color: "var(--text-muted)",
        fontFamily: "inherit",
        fontSize: 22,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function FolderNavigation({ title, onBack, onImport }: { title: string; onBack: () => void; onImport: () => void }) {
  return (
    <div style={{ position: "fixed", top: 16, left: 16, zIndex: 520, display: "flex", alignItems: "center", gap: 8 }}>
      <button onClick={onBack} title="Back to parent canvas" style={navButtonStyle}>
        <ArrowLeftIcon />
      </button>
      <div style={{ maxWidth: 260, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", padding: "8px 12px", borderRadius: 999, background: "var(--bg-sidebar)", border: "1px solid var(--sidebar-border)", fontSize: 12, fontWeight: 800 }}>
        {title}
      </div>
      <button onClick={onImport} title="Import items from parent canvas" style={navButtonStyle}>
        <ImportIcon />
      </button>
    </div>
  );
}

function ImportBar({ count, onCancel, onConfirm }: { count: number; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 540, display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 999, background: "#18181f", color: "#fff", boxShadow: "0 12px 42px rgba(0,0,0,0.28)" }}>
      <span style={{ fontSize: 12, fontWeight: 700, padding: "0 8px" }}>{count} selected</span>
      <button onClick={onCancel} title="Cancel import" style={{ ...navButtonStyle, background: "#2a2a34", color: "#fff", border: "1px solid #3a3a46" }}>
        <CloseIcon />
      </button>
      <button onClick={onConfirm} disabled={count === 0} title="Import selected items" style={{ ...navButtonStyle, opacity: count === 0 ? 0.45 : 1, background: "#34c759", color: "#fff" }}>
        <CheckIcon />
      </button>
    </div>
  );
}

const navButtonStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "1px solid var(--sidebar-border)",
  background: "var(--bg-sidebar)",
  color: "var(--text-ui)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

function ArrowLeftIcon() { return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5M6.5 9H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function ImportIcon() { return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3.5 5.5h4l1.2 1.4h5.8v6.6a1 1 0 01-1 1h-10a1 1 0 01-1-1v-7a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 12V8M7.3 9.7L9 8l1.7 1.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function CheckIcon() { return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3.7 9.5l3.2 3.1 7.2-7.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function CloseIcon() { return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>; }

function CoffeeButton({ onHide }: { onHide: () => void }) {
  const theme = useTheme();
  const isDark = theme.isDark;
  const [open, setOpen] = useState(false);
  const [qrMissing, setQrMissing] = useState(false);
  const [paperColor, setPaperColor] = useState<NoteColor>(() => randomNoteColor());
  const paper = theme.noteColors[paperColor] ?? theme.noteColors.yellow;
  const line = isDark ? "rgba(0,0,0,0.20)" : "rgba(0,0,0,0.085)";
  const text = theme.noteText;
  const muted = isDark ? "rgba(240,234,216,0.62)" : "rgba(26,26,26,0.56)";
  const panelBg = isDark ? "#24242d" : "#fff8ee";
  const panelBorder = isDark ? "#3a3a46" : "#d7c7b8";

  return (
    <>
      <button
        onClick={() => {
          setPaperColor(randomNoteColor());
          setOpen(true);
        }}
        title="Buy me a coffee"
        style={{
          position: "fixed",
          right: 36,
          bottom: 152,
          zIndex: 500,
          width: 44,
          height: 44,
          padding: 0,
          borderRadius: "50%",
          border: `1px solid ${theme.sidebarBorder}`,
          background: theme.sidebarBg,
          color: theme.textUi,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
          transition: "transform 150ms, box-shadow 150ms",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 10px 34px rgba(0,0,0,0.28)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,0.22)";
        }}
      >
        <CoffeeCupIcon />
      </button>

      {open && createPortal(
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0,
            zIndex: 700,
            background: isDark ? "rgba(0,0,0,0.58)" : "rgba(20,18,24,0.36)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "min(360px, 92vw)",
              borderRadius: 16,
              padding: "34px 28px 24px",
              backgroundColor: paper,
              backgroundImage: `repeating-linear-gradient(transparent, transparent 23px, ${line} 23px, ${line} 24.5px)`,
              backgroundSize: "100% 24.5px",
              color: text,
              boxShadow: isDark ? "0 42px 120px rgba(0,0,0,0.76)" : "0 36px 96px rgba(0,0,0,0.26)",
              animation: "coffeeIn 220ms cubic-bezier(0.34,1.4,0.64,1)",
              textAlign: "center",
              transform: "rotate(-0.65deg)",
            }}
          >
            <div style={{
              position: "absolute",
              top: -10,
              left: "50%",
              transform: "translateX(-50%)",
              width: 62,
              height: 21,
              borderRadius: 3,
              background: isDark ? "rgba(255,250,200,0.24)" : "rgba(255,253,200,0.68)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            }} />
            <button
              onClick={() => setOpen(false)}
              style={{
                position: "absolute",
                top: 10,
                right: 12,
                width: 26, height: 26, borderRadius: "50%",
                border: `1px solid ${panelBorder}`,
                background: panelBg,
                cursor: "pointer", color: muted,
                fontSize: 16, lineHeight: "26px",
              }}
            >
              x
            </button>
            <h2 style={{ margin: "0 0 16px", fontSize: 20, color: text }}>Buy me a coffee</h2>
            <div style={{
              width: 220,
              height: 220,
              margin: "0 auto 18px",
              borderRadius: 14,
              background: panelBg,
              border: `1px solid ${panelBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}>
              {qrMissing ? (
                <div style={{ padding: 18, fontSize: 12, lineHeight: 1.45, color: muted }}>
                  Add your UPI QR image as <strong>public/upi-qr.png</strong>
                </div>
              ) : (
                <img
                  src={upiQr.src}
                  alt="UPI QR code"
                  onError={() => setQrMissing(true)}
                  style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }}
                />
              )}
            </div>
            <div
              style={{
                width: "100%",
                minHeight: 38,
                padding: "6px 8px 6px 12px",
                borderRadius: 10,
                border: `1px solid ${panelBorder}`,
                background: panelBg,
                color: text,
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                boxSizing: "border-box",
              }}
            >
              <span style={{ fontSize: 12, color: muted }}>Hide coffee button?</span>
              <span style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => { onHide(); setOpen(false); }}
                  title="Hide coffee button"
                  style={{
                    width: 30,
                    height: 28,
                    borderRadius: 9,
                    border: `1px solid ${theme.accent}`,
                    background: `${theme.accent}26`,
                    color: theme.accent,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <HandCheckIcon />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  title="Keep coffee button"
                  style={{
                    width: 30,
                    height: 28,
                    borderRadius: 9,
                    border: `1px solid ${panelBorder}`,
                    background: panelBg,
                    color: muted,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <HandCrossIcon />
                </button>
              </span>
            </div>
          </div>
          <style>{`
            @keyframes coffeeIn {
              from { opacity: 0; transform: scale(0.95) translateY(8px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
        </div>,
        document.body
      )}
    </>
  );
}

function CoffeeCupIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9.2h9.4v4.7c0 2.5-1.8 4.1-4.7 4.1S6 16.4 6 13.9V9.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.4 10.5h1.4c1.4 0 2.3.8 2.3 1.9s-.9 2-2.3 2h-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.2 6.1c-.4-.8.5-1.2.2-2M11.2 6.1c-.4-.8.5-1.2.2-2M14.1 6.1c-.4-.8.5-1.2.2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 20h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function HandCheckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3.6 9.4c1.2 1.1 2.4 2.5 3.4 3.4 1.7-2.9 4.2-5.7 7.3-8.1" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.2 9.1c1.1 1 2 2.1 2.8 2.8" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

function HandCrossIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4.4 4.8c2.8 2.5 5.6 5.5 8.9 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M13.1 4.5c-2.4 2.8-5.6 5.5-8.4 8.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
