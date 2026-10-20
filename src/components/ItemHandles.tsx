"use client";

import { useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import type { Note } from "@/store/notes";
import { useNotesStore } from "@/store/notes";
import { setLivePosition } from "@/lib/livePositions";
import { GRID } from "@/lib/constants";
import { ResizeIcon, RotateIcon } from "./ui/icons";

export interface PixelRect { x: number; y: number; w: number; h: number }

/**
 * Bottom-left resize handle (anchored at the top-right corner). Shows live
 * pixel size while dragging and commits a grid-snapped size on release.
 */
export function ResizeHandle({ item, minSize, onLive }: {
  item: Note;
  minSize: number;
  onLive: (rect: PixelRect | null) => void;
}) {
  const start = useRef({ x: 0, y: 0, w: 0, h: 0, zoom: 1 });
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const rectFor = (mx: number, my: number): PixelRect => {
    const s = start.current;
    const min = minSize * GRID;
    const w = Math.max(min, s.w - mx / s.zoom);
    const h = Math.max(min, s.h + my / s.zoom);
    return { x: s.x + (s.w - w), y: s.y, w, h };
  };

  const bind = useGesture({
    onDragStart: () => {
      start.current = { x: item.x * GRID, y: item.y * GRID, w: item.w * GRID, h: item.h * GRID, zoom: useNotesStore.getState().canvas.zoom || 1 };
    },
    onDrag: ({ movement: [mx, my] }) => {
      const r = rectFor(mx, my);
      onLive(r);
      setLivePosition(item.id, { px: r.x, py: r.y, pw: r.w, ph: r.h });
      setSize({ w: Math.round(r.w / GRID), h: Math.round(r.h / GRID) });
    },
    onDragEnd: ({ movement: [mx, my] }) => {
      const r = rectFor(mx, my);
      setLivePosition(item.id, null);
      setSize(null);
      onLive(null);
      useNotesStore.getState().updateNote(item.id, {
        x: Math.round(r.x / GRID),
        y: Math.round(r.y / GRID),
        w: Math.max(minSize, Math.round(r.w / GRID)),
        h: Math.max(minSize, Math.round(r.h / GRID)),
      });
    },
  }, { drag: { filterTaps: true } });

  return (
    <div {...bind()} className="handle handle--resize reveal" data-active={size !== null} title="Drag to resize">
      <i><ResizeIcon size={13} /></i>
      {size && <span className="handle-readout">{size.w} × {size.h}</span>}
    </div>
  );
}

/**
 * Bottom-right rotate handle. Rotation is local while dragging and saved once
 * on release; a click without dragging resets to 0°.
 */
export function RotateHandle({ item, onLive }: {
  item: Note;
  onLive: (rotation: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef({ cx: 0, cy: 0, angle: 0, rotation: 0, moved: false });
  const [angle, setAngle] = useState<number | null>(null);

  const angleAt = (x: number, y: number) => {
    const s = start.current;
    const delta = (Math.atan2(y - s.cy, x - s.cx) - s.angle) * (180 / Math.PI);
    const n = (((s.rotation + delta) % 360) + 360) % 360;
    return Math.round((n > 180 ? n - 360 : n) * 2) / 2;
  };

  const bind = useGesture({
    onDragStart: ({ xy: [x, y] }) => {
      // Rotation centre = centre of the item's on-screen box (works at any pan/zoom).
      const box = ref.current?.closest("[data-item]")?.getBoundingClientRect();
      if (!box) return;
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      start.current = { cx, cy, angle: Math.atan2(y - cy, x - cx), rotation: item.rotation, moved: false };
    },
    onDrag: ({ xy: [x, y], tap }) => {
      if (tap) return;
      start.current.moved = true;
      const a = angleAt(x, y);
      setAngle(a);
      onLive(a);
    },
    onDragEnd: ({ xy: [x, y], tap }) => {
      const a = tap || !start.current.moved ? 0 : angleAt(x, y);
      setAngle(null);
      onLive(null);
      if (a !== item.rotation) useNotesStore.getState().updateNote(item.id, { rotation: a });
    },
  }, { drag: { filterTaps: true } });

  return (
    <div ref={ref} {...bind()} className="handle handle--rotate reveal" data-active={angle !== null} title={`${item.rotation.toFixed(1)}° — drag to rotate, click to straighten`}>
      <i><RotateIcon size={13} /></i>
      {angle !== null && <span className="handle-readout">{angle.toFixed(1)}°</span>}
    </div>
  );
}
