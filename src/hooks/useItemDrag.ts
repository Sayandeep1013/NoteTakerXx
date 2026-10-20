"use client";

import { useRef, useState } from "react";
import { useGesture } from "@use-gesture/react";
import { useNotesStore, type Note } from "@/store/notes";
import { setLivePosition } from "@/lib/livePositions";
import { GRID } from "@/lib/constants";

/**
 * Drag-to-move for any canvas item. Moves in world pixels while dragging
 * (published to livePositions so connections follow) and snaps to the grid on
 * release. Dragging a member of a multi-selection moves the whole selection.
 */
export function useItemDrag(item: Note, { disabled = false, threshold = 4 } = {}) {
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const start = useRef({ x: 0, y: 0, zoom: 1, active: false });

  const bind = useGesture(
    {
      onDragStart: () => {
        if (disabled) return;
        const store = useNotesStore.getState();
        start.current = { x: item.x * GRID, y: item.y * GRID, zoom: store.canvas.zoom || 1, active: true };
        store.bringToFront(item.id);
      },
      onDrag: ({ movement: [mx, my] }) => {
        const s = start.current;
        if (!s.active) return;
        const px = s.x + mx / s.zoom;
        const py = s.y + my / s.zoom;
        setDragPos({ x: px, y: py });
        setLivePosition(item.id, { px, py });
      },
      onDragEnd: ({ movement: [mx, my] }) => {
        const s = start.current;
        if (!s.active) return;
        s.active = false;
        setLivePosition(item.id, null);
        setDragPos(null);
        const dx = Math.round((s.x + mx / s.zoom) / GRID) - item.x;
        const dy = Math.round((s.y + my / s.zoom) / GRID) - item.y;
        if (dx === 0 && dy === 0) return;
        const store = useNotesStore.getState();
        if (store.selectedItemIds.length > 1 && store.selectedItemIds.includes(item.id)) {
          store.moveItemsByGrid(store.selectedItemIds, dx, dy);
        } else {
          store.updateNote(item.id, { x: item.x + dx, y: item.y + dy });
        }
      },
    },
    { drag: { filterTaps: true, threshold } },
  );

  return { bind, dragPos, dragging: dragPos !== null };
}
