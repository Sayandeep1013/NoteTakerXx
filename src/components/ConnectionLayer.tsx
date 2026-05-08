"use client";

import { useEffect, useRef, useState } from "react";
import { useNotesStore, type Connection, type Note } from "@/store/notes";

interface Props {
  notes: Note[];
  gridUnit: number;
}

function noteCenter(n: Note, G: number) {
  return {
    x: n.x * G + n.w * G / 2,
    y: n.y * G + n.h * G / 2,
  };
}

function ropeD(sx: number, sy: number, tx: number, ty: number): string {
  // Catenary-style droop: control points pull downward
  const dx = tx - sx, dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const droop = Math.min(160, dist * 0.28 + 30);
  const midX  = (sx + tx) / 2;
  const midY  = (sy + ty) / 2 + droop;
  // Two-point cubic bezier for natural rope shape
  return `M ${sx} ${sy} C ${midX - dx * 0.1} ${midY} ${midX + dx * 0.1} ${midY} ${tx} ${ty}`;
}

export default function ConnectionLayer({ notes, gridUnit: G }: Props) {
  const { connections, deleteConnection, connectionMode, addConnection } = useNotesStore();
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Track mouse for preview cord
  useEffect(() => {
    if (!connectionMode) { setMousePos(null); return; }
    const onMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      // The SVG is inside canvas-world which is translated by pan
      // We need to subtract the world's translate offset
      // The parent div's transform is already applied, so we get coords in world space
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [connectionMode]);

  const sourceNote = connectionMode ? notes.find((n) => n.id === connectionMode) : null;

  return (
    <svg
      ref={svgRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      {/* Existing connections */}
      {connections.map((conn) => {
        const src = notes.find((n) => n.id === conn.sourceId);
        const tgt = notes.find((n) => n.id === conn.targetId);
        if (!src || !tgt) return null;
        const s = noteCenter(src, G);
        const t = noteCenter(tgt, G);
        const d = ropeD(s.x, s.y, t.x, t.y);

        return (
          <g key={conn.id} style={{ pointerEvents: "stroke", cursor: "pointer" }}
            onClick={() => deleteConnection(conn.id)}>
            {/* Shadow */}
            <path d={d} stroke="rgba(0,0,0,0.25)" strokeWidth="5" fill="none"
              strokeLinecap="round" transform="translate(1,2)" />
            {/* Dark base rope */}
            <path d={d} stroke="#8b1a1a" strokeWidth="3.5" fill="none"
              strokeLinecap="round" />
            {/* Bright top highlight */}
            <path d={d} stroke={conn.color} strokeWidth="2" fill="none"
              strokeLinecap="round" opacity="0.9" />
            {/* Subtle sheen */}
            <path d={d} stroke="rgba(255,180,180,0.35)" strokeWidth="0.8" fill="none"
              strokeLinecap="round" strokeDasharray="4 3" />
            {/* Invisible fat hit area for easy clicking */}
            <path d={d} stroke="transparent" strokeWidth="14" fill="none" style={{ pointerEvents: "stroke" }} />
          </g>
        );
      })}

      {/* Preview cord while connecting */}
      {connectionMode && sourceNote && mousePos && (
        (() => {
          const s = noteCenter(sourceNote, G);
          const d = ropeD(s.x, s.y, mousePos.x, mousePos.y);
          return (
            <g style={{ pointerEvents: "none" }}>
              <path d={d} stroke="rgba(0,0,0,0.15)" strokeWidth="4" fill="none" strokeLinecap="round" transform="translate(1,2)" />
              <path d={d} stroke="#e74c3c" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="6 4" opacity="0.75" />
            </g>
          );
        })()
      )}
    </svg>
  );
}
