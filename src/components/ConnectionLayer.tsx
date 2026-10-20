"use client";

import { memo, useEffect, useMemo, useReducer, useState } from "react";
import { useNotesStore, type Note, type AnchorSide } from "@/store/notes";
import { getLivePosition, subscribeLivePositions } from "@/lib/livePositions";
import { GRID } from "@/lib/constants";

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

/** Item rect in world px, preferring live drag/resize geometry. */
function itemRect(n: Note): Rect {
  const live = getLivePosition(n.id);
  return { x: live?.px ?? n.x * GRID, y: live?.py ?? n.y * GRID, w: live?.pw ?? n.w * GRID, h: live?.ph ?? n.h * GRID };
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

function buildCandidates(sExit: Pt, srcDir: Dir, tEntry: Pt): Pt[][] {
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

  const candidates = buildCandidates(sExit, srcDir, tEntry);

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

function ConnectionLayer({ items }: { items: Note[] }) {
  const connections = useNotesStore((s) => s.connections);
  const connectionMode = useNotesStore((s) => s.connectionMode);
  const arrowMode = useNotesStore((s) => s.arrowMode);
  const arrowSourceId = useNotesStore((s) => s.arrowSourceId);
  const arrowSourceAnchor = useNotesStore((s) => s.arrowSourceAnchor);
  const [mousePos, setMousePos] = useState<Pt | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Re-render while an item is being dragged/resized (module-level map, no store writes).
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeLivePositions(forceUpdate), []);

  const tracking = !!connectionMode || arrowMode;
  useEffect(() => {
    if (!tracking) return;
    const onMove = (e: PointerEvent) => {
      const { panX, panY, zoom } = useNotesStore.getState().canvas;
      setMousePos({ x: (e.clientX - panX) / (zoom || 1), y: (e.clientY - panY) / (zoom || 1) });
    };
    window.addEventListener("pointermove", onMove);
    return () => { window.removeEventListener("pointermove", onMove); setMousePos(null); };
  }, [tracking]);

  const byId = useMemo(() => new Map(items.map((n) => [n.id, n])), [items]);
  const rects = new Map(items.map((n) => [n.id, itemRect(n)]));
  const obstaclesExcept = (a: string, b: string | null) => {
    const out: Rect[] = [];
    rects.forEach((r, id) => { if (id !== a && id !== b) out.push(r); });
    return out;
  };

  function handleAnchorClick(noteId: string, anchor: AnchorSide, e: React.MouseEvent) {
    e.stopPropagation();
    const s = useNotesStore.getState();
    if (!s.arrowMode) return;
    if (!s.arrowSourceId) { s.setArrowSource(noteId, anchor); return; }
    if (s.arrowSourceId === noteId) { s.setArrowSource(null); return; }
    s.addConnection(s.arrowSourceId, noteId, "var(--accent)", "arrow", s.arrowSourceAnchor ?? "bottom", anchor);
    s.setArrowSource(null);
  }

  const ropeSource = connectionMode ? rects.get(connectionMode) : undefined;
  const deleteConnection = (id: string) => useNotesStore.getState().deleteConnection(id);

  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none", zIndex: 5 }}>
      <defs>
        <marker id="arr-end" markerWidth="9" markerHeight="7" refX="8.5" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" style={{ fill: "var(--accent)" }} />
        </marker>
        <marker id="arr-preview" markerWidth="9" markerHeight="7" refX="8.5" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill="#e74c3c" opacity="0.7" />
        </marker>
      </defs>

      {connections.map((conn) => {
        const srcR = rects.get(conn.sourceId);
        const tgtR = rects.get(conn.targetId);
        if (!srcR || !tgtR) return null;

        if (conn.connectionType === "arrow") {
          const sa = conn.sourceAnchor ?? "bottom";
          const ta = conn.targetAnchor ?? "top";
          const pts = orthogonalRoute(noteAnchorPt(srcR, sa), sa, noteAnchorPt(tgtR, ta), ta, obstaclesExcept(conn.sourceId, conn.targetId), [srcR, tgtR]);
          const d = pointsToPath(pts, 10);
          return (
            <g key={conn.id} className="conn" onClick={() => deleteConnection(conn.id)}>
              <title>Click to remove arrow</title>
              <path d={d} stroke="rgba(0,0,0,0.16)" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(1,2)" />
              <path className="conn-main" d={d} style={{ stroke: conn.color }} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#arr-end)" />
              <path d={d} stroke="transparent" strokeWidth="14" fill="none" />
            </g>
          );
        }

        const sc = noteCenter(srcR);
        const tc = noteCenter(tgtR);
        const d = ropeD(sc.x, sc.y, tc.x, tc.y);
        return (
          <g key={conn.id} className="conn" onClick={() => deleteConnection(conn.id)}>
            <title>Click to remove rope</title>
            <path d={d} stroke="rgba(0,0,0,0.25)" strokeWidth="5" fill="none" strokeLinecap="round" transform="translate(1,2)" />
            <path d={d} stroke="#8b1a1a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path className="conn-main" d={d} style={{ stroke: conn.color }} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.9" />
            <path d={d} stroke="rgba(255,180,180,0.35)" strokeWidth="0.8" fill="none" strokeLinecap="round" strokeDasharray="4 3" />
            <path d={d} stroke="transparent" strokeWidth="14" fill="none" />
          </g>
        );
      })}

      {ropeSource && mousePos && (() => {
        const sc = noteCenter(ropeSource);
        const d = ropeD(sc.x, sc.y, mousePos.x, mousePos.y);
        return (
          <g style={{ pointerEvents: "none" }}>
            <path d={d} stroke="rgba(0,0,0,0.15)" strokeWidth="4" fill="none" strokeLinecap="round" transform="translate(1,2)" />
            <path d={d} stroke="#e74c3c" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="6 4" opacity="0.75" />
          </g>
        );
      })()}

      {arrowMode && items.map((note) => {
        const r = rects.get(note.id)!;
        return ANCHORS.map((anchor) => {
          const pt = noteAnchorPt(r, anchor);
          const active = note.id === arrowSourceId && arrowSourceAnchor === anchor;
          const hot = note.id === hoveredId;
          return (
            <circle
              key={`${note.id}-${anchor}`}
              className="anchor-dot"
              data-active={active}
              data-hot={hot}
              cx={pt.x} cy={pt.y}
              r={active ? 9 : hot ? 7 : 5.5}
              onMouseEnter={() => setHoveredId(note.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={(e) => handleAnchorClick(note.id, anchor, e)}
            />
          );
        });
      })}

      {arrowMode && arrowSourceId && arrowSourceAnchor && mousePos && (() => {
        const srcR = rects.get(arrowSourceId);
        if (!srcR) return null;
        const sp = noteAnchorPt(srcR, arrowSourceAnchor);
        const hoverR = hoveredId && hoveredId !== arrowSourceId && byId.has(hoveredId) ? rects.get(hoveredId) : undefined;
        let d: string;
        if (hoverR) {
          const nearest = ANCHORS
            .map((a) => ({ a, pt: noteAnchorPt(hoverR, a) }))
            .sort((p, q) => Math.hypot(mousePos.x - p.pt.x, mousePos.y - p.pt.y) - Math.hypot(mousePos.x - q.pt.x, mousePos.y - q.pt.y))[0];
          d = pointsToPath(orthogonalRoute(sp, arrowSourceAnchor, nearest.pt, nearest.a, obstaclesExcept(arrowSourceId, hoveredId), [srcR]), 10);
        } else {
          d = `M ${sp.x} ${sp.y} L ${mousePos.x} ${mousePos.y}`;
        }
        return (
          <g style={{ pointerEvents: "none" }}>
            <path d={d} stroke="rgba(0,0,0,0.12)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(1,2)" />
            <path d={d} stroke="#e74c3c" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4" opacity="0.8" markerEnd="url(#arr-preview)" />
          </g>
        );
      })()}
    </svg>
  );
}

export default memo(ConnectionLayer);
