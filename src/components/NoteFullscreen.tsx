"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useGesture } from "@use-gesture/react";
import { Note } from "@/store/notes";
import { ThemeConfig } from "@/hooks/useTheme";

type Phase = "entering" | "visible" | "exiting";
type ResizeDir = "n"|"s"|"e"|"w"|"nw"|"ne"|"sw"|"se";

interface Props {
  note: Note;
  theme: ThemeConfig;
  originX: number;
  originY: number;
  onClose: () => void;
}

const INIT_W = 860;
const INIT_H = 580;
const MIN_W  = 400;
const MIN_H  = 280;

export default function NoteFullscreen({ note, theme, originX, originY, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("entering");
  const [dims, setDims] = useState({ w: INIT_W, h: INIT_H });

  const vCX = typeof window !== "undefined" ? window.innerWidth  / 2 : 0;
  const vCY = typeof window !== "undefined" ? window.innerHeight / 2 : 0;

  // Offset from viewport center to note center — used for origin animation
  const dx = originX - vCX;
  const dy = originY - vCY;

  const enteringTransform  = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.08)`;
  const visibleTransform   = `translate(-50%, -50%) scale(1)`;

  // Play open animation after mount
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setPhase("visible"))
    );
    return () => cancelAnimationFrame(id);
  }, []);

  // Escape key triggers close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") triggerClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerClose = useCallback(() => {
    setPhase("exiting");
  }, []);

  const onTransitionEnd = () => {
    if (phase === "exiting") onClose();
  };

  const windowTransform =
    phase === "visible" ? visibleTransform : enteringTransform;
  const windowOpacity = phase === "visible" ? 1 : 0;

  const bg        = theme.noteColors[note.color] ?? "#fff176";
  const textColor = theme.noteText;
  const phColor   = theme.notePlaceholder;

  return (
    <div
      onClick={triggerClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
        zIndex: 200,
        opacity: phase === "visible" ? 1 : 0,
        transition: "opacity 300ms ease",
        pointerEvents: phase === "exiting" ? "none" : "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={onTransitionEnd}
        style={{
          position: "fixed",
          left: "50%", top: "50%",
          width: dims.w, height: dims.h,
          background: bg,
          borderRadius: 16,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          transform: windowTransform,
          opacity: windowOpacity,
          transition: "transform 360ms cubic-bezier(0.34,1.56,0.64,1), opacity 300ms ease",
          zIndex: 210,
          boxShadow: "0 32px 80px rgba(0,0,0,0.28)",
          minWidth: MIN_W, minHeight: MIN_H,
        }}
      >
        {/* Noise overlay */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 16,
          opacity: 0.07, filter: "url(#paper-noise)",
          pointerEvents: "none", mixBlendMode: "multiply",
          background: "transparent",
        }} />

        {/* Header / title bar */}
        <div style={{
          display: "flex", alignItems: "center",
          height: 40, padding: "0 14px", gap: 10,
          background: "rgba(0,0,0,0.08)",
          flexShrink: 0, position: "relative",
          userSelect: "none",
        }}>
          {/* Close button — X only, no Mac dots */}
          <button
            onClick={triggerClose}
            title="Return to canvas"
            style={{
              width: 26, height: 26, borderRadius: "50%",
              background: "rgba(0,0,0,0.12)", border: "none",
              cursor: "pointer", color: textColor, fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, opacity: 0.7, transition: "opacity 150ms",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
          >×</button>

          <span style={{
            marginLeft: 8, fontSize: 13, fontWeight: 600,
            color: textColor, opacity: 0.7,
            overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
          }}>
            {note.title || "Untitled"}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "24px 32px", overflow: "auto" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 24, fontWeight: 700, color: textColor }}>
            {note.title || <span style={{ color: phColor }}>Title</span>}
          </h2>
          <div style={{ fontSize: 15, color: textColor, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
            {note.body || <span style={{ color: phColor }}>No content yet. Press the Edit button to start writing.</span>}
          </div>
        </div>

        {/* Resize handles on all 8 edges */}
        {(["nw","n","ne","e","se","s","sw","w"] as ResizeDir[]).map((dir) => (
          <WindowResizeHandle
            key={dir}
            dir={dir}
            dims={dims}
            onDimsUpdate={setDims}
          />
        ))}
      </div>
    </div>
  );
}

function WindowResizeHandle({ dir, dims, onDimsUpdate }: {
  dir: ResizeDir;
  dims: { w: number; h: number };
  onDimsUpdate: (d: { w: number; h: number }) => void;
}) {
  const start = useRef({ w: 0, h: 0 });

  const calc = (mx: number, my: number) => {
    const s = start.current;
    let w = s.w, h = s.h;
    if (dir.includes("e"))  w = Math.max(MIN_W, s.w + mx);
    if (dir.includes("w"))  w = Math.max(MIN_W, s.w - mx);
    if (dir.includes("s"))  h = Math.max(MIN_H, s.h + my);
    if (dir.includes("n"))  h = Math.max(MIN_H, s.h - my);
    return { w, h };
  };

  const bind = useGesture(
    {
      onDragStart: () => { start.current = { w: dims.w, h: dims.h }; },
      onDrag: ({ movement: [mx, my] }) => { onDimsUpdate(calc(mx, my)); },
    },
    { drag: { filterTaps: true } }
  );

  const cursorMap: Record<ResizeDir, string> = {
    nw: "nw-resize", n: "n-resize", ne: "ne-resize",
    e: "e-resize",   se: "se-resize", s: "s-resize",
    sw: "sw-resize", w: "w-resize",
  };

  const posStyle: React.CSSProperties = {
    position: "absolute", zIndex: 10,
    background: "transparent",
    cursor: cursorMap[dir],
  };

  const size = 8;
  const half = size / 2;

  // Corner vs edge sizing
  const isCorner = dir.length === 2;
  const cornerSize = 16;

  if (isCorner) {
    const s: React.CSSProperties = { ...posStyle, width: cornerSize, height: cornerSize };
    if (dir === "nw") { s.top = -half; s.left = -half; }
    if (dir === "ne") { s.top = -half; s.right = -half; }
    if (dir === "se") { s.bottom = -half; s.right = -half; }
    if (dir === "sw") { s.bottom = -half; s.left = -half; }
    return <div {...bind()} style={s} />;
  }

  const e: React.CSSProperties = { ...posStyle };
  if (dir === "n")  { e.top = -half; e.left = cornerSize; e.right = cornerSize; e.height = size; }
  if (dir === "s")  { e.bottom = -half; e.left = cornerSize; e.right = cornerSize; e.height = size; }
  if (dir === "e")  { e.right = -half; e.top = cornerSize; e.bottom = cornerSize; e.width = size; }
  if (dir === "w")  { e.left = -half; e.top = cornerSize; e.bottom = cornerSize; e.width = size; }
  return <div {...bind()} style={e} />;
}
