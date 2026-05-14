"use client";

import { useEffect, useState, useReducer } from "react";
import { useNotesStore, type Connection, type Note, type AnchorSide } from "@/store/notes";
import { getLivePosition, subscribeLivePositions } from "@/lib/livePositions";

interface Props {
  notes: Note[];
  gridUnit: number;
}

type Pt = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };
type Dir = { dx: number; dy: number };

// ── Geometry helpers ──────────────────────────────────────────────

function anchorToDir(a: AnchorSide): Dir {
  switch (a) {
    case "top":    return { dx: 0,  dy: -1 };
    case "bottom": return { dx: 0,  dy:  1 };
    case "left":   return { dx: -1, dy:  0 };
    case "right":  return { dx:  1, dy:  0 };
  }
}

function noteRect(n: Note, G: number, livePx?: { px: number; py: number }): Rect {
  return { x: livePx?.px ?? n.x * G, y: livePx?.py ?? n.y * G, w: n.w * G, h: n.h * G };
}

function noteAnchorPt(r: Rect, a: AnchorSide): Pt {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  switch (a) {
    case "top":    return { x: cx,       y: r.y };
    case "bottom": return { x: cx,       y: r.y + r.h };
    case "left":   return { x: r.x,      y: cy };
    case "right":  return { x: r.x + r.w, y: cy };
  }
}

function noteCenter(r: Rect): Pt {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

// Does an axis-aligned segment (p1→p2) intersect rect (with padding)?
function segmentHitsRect(p1: Pt, p2: Pt, rect: Rect, pad = 6): boolean {
  const rx = rect.x - pad, ry = rect.y - pad;
  const rx2 = rect.x + rect.w + pad, ry2 = rect.y + rect.h + pad;
  if (Math.abs(p1.y - p2.y) < 0.5) {
    // Horizontal segment
    const y = p1.y;
    if (y <= ry || y >= ry2) return false;
    const minX = Math.min(p1.x, p2.x), maxX = Math.max(p1.x, p2.x);
    return maxX > rx && minX < rx2;
  }
  // Vertical segment
  const x = p1.x;
  if (x <= rx || x >= rx2) return false;
  const minY = Math.min(p1.y, p2.y), maxY = Math.max(p1.y, p2.y);
  return maxY > ry && minY < ry2;
}

// Score a candidate path against obstacle list
// Returns [total hits, hits against hard obstacles]
function scoreCandidate(pts: Pt[], soft: Rect[], hard: Rect[]): [number, number] {
  let s = 0, h = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    for (const r of soft) if (segmentHitsRect(p1, p2, r)) s++;
    for (const r of hard) if (segmentHitsRect(p1, p2, r)) h++;
  }
  return [s + h * 20, h];
}

// ── Orthogonal routing ────────────────────────────────────────────

const STUB = 32; // px to exit perpendicularly from anchor edge

function buildCandidates(sExit: Pt, srcDir: Dir, tEntry: Pt, tgtDir: Dir): Pt[][] {
  // sExit = srcAnchor + srcDir*STUB
  // tEntry = tgtAnchor + tgtDir*STUB (note: tgtDir points AWAY from target note)
  // The path must go: srcAnchor → sExit → [waypoints] → tEntry → tgtAnchor

  const mx = (sExit.x + tEntry.x) / 2;
  const my = (sExit.y + tEntry.y) / 2;

  const candidates: Pt[][] = [];

  // L-shape A: horizontal from exit, then vertical to entry
  candidates.push([sExit, { x: tEntry.x, y: sExit.y }, tEntry]);
  // L-shape B: vertical from exit, then horizontal to entry
  candidates.push([sExit, { x: sExit.x, y: tEntry.y }, tEntry]);

  // Z-shape via midX (two horizontal + one vertical)
  candidates.push([sExit, { x: mx, y: sExit.y }, { x: mx, y: tEntry.y }, tEntry]);
  // Z-shape via midY (two vertical + one horizontal)
  candidates.push([sExit, { x: sExit.x, y: my }, { x: tEntry.x, y: my }, tEntry]);

  // Offset Z-shapes: push the intermediate segment to avoid obstacles
  const offsets = [80, 160, 260];
  for (const off of offsets) {
    // Push vertically up/down
    candidates.push([sExit, { x: sExit.x, y: sExit.y - off }, { x: tEntry.x, y: sExit.y - off }, tEntry]);
    candidates.push([sExit, { x: sExit.x, y: sExit.y + off }, { x: tEntry.x, y: sExit.y + off }, tEntry]);
    // Push horizontally left/right
    candidates.push([sExit, { x: sExit.x - off, y: sExit.y }, { x: sExit.x - off, y: tEntry.y }, tEntry]);
    candidates.push([sExit, { x: sExit.x + off, y: sExit.y }, { x: sExit.x + off, y: tEntry.y }, tEntry]);
  }

  // U-shape: extend further in stub direction before routing (for same-direction anchors)
  const bigStub = 80;
  if (srcDir.dy !== 0) {
    const ey = sExit.y + srcDir.dy * bigStub;
    candidates.push([sExit, { x: sExit.x, y: ey }, { x: tEntry.x, y: ey }, tEntry]);
  }
  if (srcDir.dx !== 0) {
    const ex = sExit.x + srcDir.dx * bigStub;
    candidates.push([sExit, { x: ex, y: sExit.y }, { x: ex, y: tEntry.y }, tEntry]);
  }

  return candidates;
}

function orthogonalRoute(
  srcPt: Pt, srcAnchor: AnchorSide,
  tgtPt: Pt, tgtAnchor: AnchorSide,
  softObstacles: Rect[],
  hardObstacles: Rect[], // source + target rects
): Pt[] {
  const srcDir = anchorToDir(srcAnchor);
  const tgtDir = anchorToDir(tgtAnchor);

  const sExit  = { x: srcPt.x + srcDir.dx * STUB, y: srcPt.y + srcDir.dy * STUB };
  const tEntry = { x: tgtPt.x + tgtDir.dx * STUB, y: tgtPt.y + tgtDir.dy * STUB };

  const candidates = buildCandidates(sExit, srcDir, tEntry, tgtDir);

  let bestPts = candidates[0];
  let bestScore = Infinity;

  for (const mid of candidates) {
    const full = [srcPt, ...mid, tgtPt];
    const [score] = scoreCandidate(full, softObstacles, hardObstacles);
    if (score < bestScore) { bestScore = score; bestPts = mid; }
  }

  return [srcPt, ...bestPts, tgtPt];
}

// ── SVG path with rounded corners ────────────────────────────────

function pointsToPath(pts: Pt[], r = 10): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], curr = pts[i], next = pts[i + 1];
    const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
    const ar = Math.min(r, d1 / 2, d2 / 2);
    if (ar < 1) { d += ` L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`; continue; }

    const ratio1 = (d1 - ar) / d1;
    const p1 = { x: prev.x + (curr.x - prev.x) * ratio1, y: prev.y + (curr.y - prev.y) * ratio1 };
    const ratio2 = ar / d2;
    const p2 = { x: curr.x + (next.x - curr.x) * ratio2, y: curr.y + (next.y - curr.y) * ratio2 };

    d += ` L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${curr.x} ${curr.y} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

// ── Catenary rope (unchanged visual) ─────────────────────────────

function ropeD(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx, dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const droop = Math.min(160, dist * 0.28 + 30);
  const midX = (sx + tx) / 2, midY = (sy + ty) / 2 + droop;
  return `M ${sx} ${sy} C ${midX - dx * 0.1} ${midY} ${midX + dx * 0.1} ${midY} ${tx} ${ty}`;
}

// ── Anchor dots ───────────────────────────────────────────────────

const ANCHORS: AnchorSide[] = ["top", "bottom", "left", "right"];

// ── Main component ────────────────────────────────────────────────

export default function ConnectionLayer({ notes, gridUnit: G }: Props) {
  const connections     = useNotesStore((s) => s.connections);
  const deleteConnection = useNotesStore((s) => s.deleteConnection);
  const connectionMode  = useNotesStore((s) => s.connectionMode);
  const addConnection   = useNotesStore((s) => s.addConnection);
  const arrowMode       = useNotesStore((s) => s.arrowMode);
  const arrowSourceId   = useNotesStore((s) => s.arrowSourceId);
  const arrowSourceAnchor = useNotesStore((s) => s.arrowSourceAnchor);
  const setArrowSource  = useNotesStore((s) => s.setArrowSource);
  const panX = useNotesStore((s) => s.canvas.panX);
  const panY = useNotesStore((s) => s.canvas.panY);
  const zoom = useNotesStore((s) => s.canvas.zoom || 1);
  const [mousePos, setMousePos] = useState<Pt | null>(null);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);

  // Re-render when any live drag position changes (module-level map, no store writes)
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeLivePositions(forceUpdate), []);

  useEffect(() => {
    if (!connectionMode && !arrowMode) { setMousePos(null); return; }
    const onMove = (e: MouseEvent) => {
      setMousePos({ x: (e.clientX - panX) / zoom, y: (e.clientY - panY) / zoom });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [connectionMode, arrowMode, panX, panY, zoom]);

  useEffect(() => {
    if (!arrowMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setArrowSource(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [arrowMode, setArrowSource]);

  // Build obstacle rects from all visible notes (reads from module-level live map)
  const allRects = notes.map((n) => noteRect(n, G, getLivePosition(n.id)));

  function getRect(n: Note): Rect {
    return noteRect(n, G, getLivePosition(n.id));
  }

  function handleAnchorClick(noteId: string, anchor: AnchorSide, e: React.MouseEvent) {
    e.stopPropagation();
    if (!arrowMode) return;
    if (!arrowSourceId) { setArrowSource(noteId, anchor); return; }
    if (arrowSourceId === noteId) { setArrowSource(null); return; }
    addConnection(arrowSourceId, noteId, "var(--accent)", "arrow", arrowSourceAnchor ?? "bottom", anchor);
    setArrowSource(null);
  }

  const sourceNote = connectionMode ? notes.find((n) => n.id === connectionMode) : null;

  return (
    <svg
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        overflow: "visible", pointerEvents: "none", zIndex: 5,
      }}
    >
      <defs>
        <marker id="arr-end" markerWidth="9" markerHeight="7" refX="8.5" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill="var(--accent)" opacity="0.9" />
        </marker>
        <marker id="arr-preview" markerWidth="9" markerHeight="7" refX="8.5" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill="#e74c3c" opacity="0.7" />
        </marker>
      </defs>

      {/* ── Existing connections ── */}
      {connections.map((conn) => {
        const src = notes.find((n) => n.id === conn.sourceId);
        const tgt = notes.find((n) => n.id === conn.targetId);
        if (!src || !tgt) return null;
        const srcR = getRect(src);
        const tgtR = getRect(tgt);

        if (conn.connectionType === "arrow") {
          const sa = conn.sourceAnchor ?? "bottom";
          const ta = conn.targetAnchor ?? "top";
          const sp = noteAnchorPt(srcR, sa);
          const tp = noteAnchorPt(tgtR, ta);

          // Obstacles: all other notes/photos except src and tgt
          const softObs = allRects.filter((_, i) => notes[i].id !== conn.sourceId && notes[i].id !== conn.targetId);
          const hardObs = [srcR, tgtR];
          const pts = orthogonalRoute(sp, sa, tp, ta, softObs, hardObs);
          const d = pointsToPath(pts, 10);

          return (
            <g key={conn.id} style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onClick={() => deleteConnection(conn.id)}>
              {/* Shadow */}
              <path d={d} stroke="rgba(0,0,0,0.16)" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(1,2)" />
              {/* Main line */}
              <path d={d} stroke={conn.color} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#arr-end)" />
              {/* Fat invisible hit area */}
              <path d={d} stroke="transparent" strokeWidth="14" fill="none" style={{ pointerEvents: "stroke" }} />
            </g>
          );
        }

        // Rope connection
        const sc = noteCenter(srcR);
        const tc = noteCenter(tgtR);
        const d = ropeD(sc.x, sc.y, tc.x, tc.y);
        return (
          <g key={conn.id} style={{ pointerEvents: "stroke", cursor: "pointer" }}
            onClick={() => deleteConnection(conn.id)}>
            <path d={d} stroke="rgba(0,0,0,0.25)" strokeWidth="5" fill="none" strokeLinecap="round" transform="translate(1,2)" />
            <path d={d} stroke="#8b1a1a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d={d} stroke={conn.color} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.9" />
            <path d={d} stroke="rgba(255,180,180,0.35)" strokeWidth="0.8" fill="none" strokeLinecap="round" strokeDasharray="4 3" />
            <path d={d} stroke="transparent" strokeWidth="14" fill="none" style={{ pointerEvents: "stroke" }} />
          </g>
        );
      })}

      {/* ── Rope preview while connecting ── */}
      {connectionMode && sourceNote && mousePos && (() => {
        const sc = noteCenter(getRect(sourceNote));
        const d = ropeD(sc.x, sc.y, mousePos.x, mousePos.y);
        return (
          <g style={{ pointerEvents: "none" }}>
            <path d={d} stroke="rgba(0,0,0,0.15)" strokeWidth="4" fill="none" strokeLinecap="round" transform="translate(1,2)" />
            <path d={d} stroke="#e74c3c" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="6 4" opacity="0.75" />
          </g>
        );
      })()}

      {/* ── Arrow mode: anchor dots on all notes ── */}
      {arrowMode && notes.map((note) => {
        const r = getRect(note);
        const isSource = note.id === arrowSourceId;
        const isHovered = note.id === hoveredNoteId;
        return ANCHORS.map((anchor) => {
          const pt = noteAnchorPt(r, anchor);
          const isActive = isSource && arrowSourceAnchor === anchor;
          return (
            <circle
              key={`${note.id}-${anchor}`}
              cx={pt.x} cy={pt.y}
              r={isActive ? 9 : isHovered ? 7 : 5}
              fill={isActive ? "var(--accent)" : isHovered ? "rgba(92,107,192,0.75)" : "rgba(92,107,192,0.35)"}
              stroke={isActive ? "#fff" : "rgba(255,255,255,0.85)"}
              strokeWidth={isActive ? 2 : 1.5}
              style={{ pointerEvents: "all", cursor: "crosshair", transition: "r 100ms, fill 100ms" }}
              onMouseEnter={() => setHoveredNoteId(note.id)}
              onMouseLeave={() => setHoveredNoteId(null)}
              onClick={(e) => handleAnchorClick(note.id, anchor, e)}
            />
          );
        });
      })}

      {/* ── Arrow preview while drawing ── */}
      {arrowMode && arrowSourceId && mousePos && (() => {
        const src = notes.find((n) => n.id === arrowSourceId);
        if (!src || !arrowSourceAnchor) return null;
        const srcR = getRect(src);
        const sp = noteAnchorPt(srcR, arrowSourceAnchor);

        let tp = mousePos;
        let targetAnchor: AnchorSide | null = null;
        const hovered = hoveredNoteId ? notes.find((n) => n.id === hoveredNoteId) : null;
        if (hovered && hoveredNoteId !== arrowSourceId) {
          const hr = getRect(hovered);
          const nearest = ANCHORS.map((a) => ({ a, pt: noteAnchorPt(hr, a) }))
            .sort((x, y) => Math.hypot(mousePos.x - x.pt.x, mousePos.y - x.pt.y) - Math.hypot(mousePos.x - y.pt.x, mousePos.y - y.pt.y))[0];
          targetAnchor = nearest.a;
          tp = nearest.pt;
        }

        let d: string;
        if (targetAnchor) {
          const softObs = allRects.filter((_, i) => notes[i].id !== arrowSourceId && notes[i].id !== hoveredNoteId);
          const pts = orthogonalRoute(sp, arrowSourceAnchor, tp, targetAnchor, softObs, [srcR]);
          d = pointsToPath(pts, 10);
        } else {
          d = `M ${sp.x} ${sp.y} L ${tp.x} ${tp.y}`;
        }

        return (
          <g style={{ pointerEvents: "none" }}>
            <path d={d} stroke="rgba(0,0,0,0.12)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(1,2)" />
            <path d={d} stroke="#e74c3c" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="6 4" opacity="0.8" markerEnd="url(#arr-preview)" />
          </g>
        );
      })()}
    </svg>
  );
}
