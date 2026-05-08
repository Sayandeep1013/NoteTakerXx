"use client";

import { useRef, useState, useEffect } from "react";
import { useNotesStore } from "@/store/notes";
import Note from "./Note";
import DotGrid from "./DotGrid";
import Sidebar from "./Sidebar";
import ResourceMonitor from "./ResourceMonitor";
import ConnectionLayer from "./ConnectionLayer";

export default function Canvas() {
  const { notes, canvas, setPan, addNote, connectionMode, setConnectionMode, badgeFilter } = useNotesStore();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const panState = useRef({ active: false, startX: 0, startY: 0, panX: 0, panY: 0 });
  const panRef = useRef({ x: canvas.panX, y: canvas.panY });
  panRef.current = { x: canvas.panX, y: canvas.panY };
  const [cursor, setCursor] = useState<"default" | "grabbing">("default");

  // Non-passive wheel to preventDefault and pan
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setPan(panRef.current.x - e.deltaX, panRef.current.y - e.deltaY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape cancels connection mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && connectionMode) setConnectionMode(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectionMode, setConnectionMode]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only activate pan on the backdrop (canvas-pan-layer), not on notes
    const target = e.target as HTMLElement;
    if (!target.classList.contains("canvas-pan-layer")) return;
    panState.current = { active: true, startX: e.clientX, startY: e.clientY, panX: canvas.panX, panY: canvas.panY };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setCursor("grabbing");
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panState.current.active) return;
    setPan(panState.current.panX + e.clientX - panState.current.startX, panState.current.panY + e.clientY - panState.current.startY);
  };

  const onPointerUp = () => { panState.current.active = false; setCursor("default"); };
  const visibleNotes = badgeFilter ? notes.filter((note) => note.badges.includes(badgeFilter)) : notes;

  return (
    <div
      ref={surfaceRef}
      className="canvas-surface"
      style={{ cursor, userSelect: "none" }}
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
        style={{ transform: `translate(${canvas.panX}px, ${canvas.panY}px)`, zIndex: 2 }}
      >
        <ConnectionLayer notes={visibleNotes} gridUnit={80} />
        {visibleNotes.map((note) => (
          <Note key={note.id} note={note} gridUnit={80} />
        ))}
      </div>

      {/* Vignette — subtle depth at canvas edges */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3,
        background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.07) 100%)",
      }} />

      {/* + button with pulse ring */}
      <div style={{ position: "fixed", bottom: 32, right: 32, zIndex: 500 }}>
        {/* Pulse ring */}
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
            color: "#fff", fontSize: 26,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 150ms, box-shadow 150ms",
            fontWeight: 300,
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
          +
        </button>
      </div>

      {/* Connection mode indicator */}
      {connectionMode && (
        <div
          onClick={() => setConnectionMode(null)}
          style={{
            position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
            background: "rgba(231,76,60,0.92)",
            backdropFilter: "blur(12px)",
            color: "#fff", fontSize: 12, fontWeight: 600,
            padding: "7px 18px", borderRadius: 20,
            zIndex: 490, cursor: "pointer",
            boxShadow: "0 4px 16px rgba(231,76,60,0.4)",
            letterSpacing: "0.02em",
          }}
        >
          Shift+click another note to connect — click here or press Esc to cancel
        </div>
      )}

      <Sidebar />
      <ResourceMonitor />
    </div>
  );
}
