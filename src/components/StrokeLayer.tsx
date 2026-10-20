"use client";

import { memo } from "react";
import { useNotesStore, type Note, type StrokePoint } from "@/store/notes";

/** Smooth polyline through the midpoints of each segment (quadratic curves). */
export function strokePath(points: StrokePoint[]) {
  if (points.length === 0) return "";
  const f = (n: number) => n.toFixed(1);
  if (points.length < 3) return points.map((p, i) => `${i ? "L" : "M"}${f(p.x)} ${f(p.y)}`).join(" ");
  let d = `M${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i], next = points[i + 1];
    d += ` Q${f(p.x)} ${f(p.y)} ${f((p.x + next.x) / 2)} ${f((p.y + next.y) / 2)}`;
  }
  const last = points[points.length - 1];
  return `${d} L${f(last.x)} ${f(last.y)}`;
}

const Stroke = memo(function Stroke({ stroke, selected }: { stroke: Note; selected: boolean }) {
  const points = stroke.strokePoints ?? [];
  if (points.length < 2) return null;
  const d = strokePath(points);
  const width = stroke.strokeWidth ?? 4;
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const s = useNotesStore.getState();
    if (s.eraserMode) { s.deleteNote(stroke.id); return; }
    if (!e.ctrlKey && !e.metaKey) s.clearSelection();
    s.toggleSelectedItem(stroke.id);
  };
  return (
    <g className="stroke-g">
      {selected && <path d={d} style={{ stroke: "var(--accent)" }} strokeWidth={width + 8} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.25} />}
      <path d={d} stroke={stroke.strokeColor ?? "#7c8fd8"} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      <path
        d={d}
        stroke="transparent"
        strokeWidth={Math.max(16, width + 10)}
        fill="none"
        strokeLinecap="round"
        onClick={onClick}
        onDoubleClick={(e) => { e.stopPropagation(); useNotesStore.getState().deleteNote(stroke.id); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); useNotesStore.getState().deleteNote(stroke.id); }}
      >
        <title>Click to select, double-click or right-click to delete</title>
      </path>
    </g>
  );
});

function StrokeLayer({ strokes, livePathRef, liveColor }: {
  strokes: Note[];
  livePathRef: React.RefObject<SVGPathElement | null>;
  liveColor: string;
}) {
  const selectedIds = useNotesStore((s) => s.selectedItemIds);
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none", zIndex: 4 }}>
      {strokes.map((stroke) => (
        <Stroke key={stroke.id} stroke={stroke} selected={selectedIds.includes(stroke.id)} />
      ))}
      {/* The in-progress stroke is written straight to this element (no React renders while drawing). */}
      <path ref={livePathRef} stroke={liveColor} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} style={{ pointerEvents: "none" }} />
    </svg>
  );
}

export default memo(StrokeLayer);
