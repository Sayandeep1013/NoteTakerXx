"use client";

import { memo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useNotesStore, type Note as CanvasItem } from "@/store/notes";
import { NOTE_COLOR_KEYS, noteColorVar } from "@/lib/colors";
import { handleItemModePointer } from "@/lib/items";
import { GRID } from "@/lib/constants";
import { useItemDrag } from "@/hooks/useItemDrag";
import NoteContextMenu from "./NoteContextMenu";
import { ConfirmDialog } from "./ui/Modal";

function FolderItem({ folder }: { folder: CanvasItem }) {
  const selected = useNotesStore((s) => s.selectedItemIds.includes(folder.id));
  const highlighted = useNotesStore((s) => s.highlightedNoteId === folder.id);
  // [count, ...first four children] — shallow-compared, so unrelated edits don't re-render.
  const [count, ...preview] = useNotesStore(useShallow((s) => {
    const kids: (number | CanvasItem)[] = [0];
    for (const n of s.notes) {
      if (n.parentId !== folder.id || n.type === "stroke") continue;
      kids[0] = (kids[0] as number) + 1;
      if (kids.length < 5) kids.push(n);
    }
    return kids;
  })) as [number, ...CanvasItem[]];

  const name = folder.folderName ?? folder.title ?? "Untitled Folder";
  const [title, setTitle] = useState<string | null>(null); // non-null while renaming
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const { bind, dragPos, dragging } = useItemDrag(folder, { threshold: 6 });

  const commitTitle = () => {
    if (title === null) return;
    const next = title.trim() || "Untitled Folder";
    if (next !== name) useNotesStore.getState().updateNote(folder.id, { title: next, folderName: next });
    setTitle(null);
  };

  const size = Math.max(76, folder.w * GRID);

  return (
    <>
      <div
        data-item={folder.id}
        data-selected={selected}
        data-highlighted={highlighted}
        data-dragging={dragging}
        tabIndex={-1}
        className="item folder"
        onPointerDownCapture={(e) => {
          if (handleItemModePointer(folder.id, e, { connectable: false })) { e.preventDefault(); e.stopPropagation(); }
        }}
        onPointerDown={() => useNotesStore.getState().bringToFront(folder.id)}
        onDoubleClick={() => { if (title === null) useNotesStore.getState().openFolder(folder.id); }}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
        style={{ left: dragPos?.x ?? folder.x * GRID, top: dragPos?.y ?? folder.y * GRID, width: size, zIndex: folder.zIndex }}
      >
        <div {...bind()} className="drag-handle" title="Drag to move, double-click to open" style={{ position: "relative", width: size, height: size }}>
          {[3, 2, 1, 0].map((layer) => {
            const item = preview[layer];
            const isPhoto = item?.type === "photo";
            return (
              <div
                key={layer}
                className="folder-sheet"
                style={{
                  inset: 11 - layer * 3,
                  background: isPhoto ? "#fff" : noteColorVar(item?.color ?? NOTE_COLOR_KEYS[layer]),
                  border: isPhoto ? "4px solid #fff" : undefined,
                  transform: `rotate(${(layer - 1.5) * 4}deg) translate(${layer * 2}px, ${-layer}px)`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {isPhoto && item.imageUrl && <img src={item.imageUrl} alt="" draggable={false} loading="lazy" decoding="async" />}
              </div>
            );
          })}
          <span className="folder-count" aria-label={`${count} items`}>{count}</span>
        </div>

        <div style={{ marginTop: 8, display: "flex", justifyContent: "center", width: size }}>
          {title !== null ? (
            <input
              className="folder-label"
              value={title}
              autoFocus
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") setTitle(null);
              }}
              style={{ width: Math.max(150, size + 40), flexShrink: 0 }}
            />
          ) : (
            <button
              className="folder-label"
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onClick={() => setTitle(name)}
              title="Click to rename"
              style={{ maxWidth: Math.max(170, size + 60), cursor: "text", flexShrink: 0 }}
            >
              {name}
            </button>
          )}
        </div>
      </div>

      {menu && (
        <NoteContextMenu
          x={menu.x} y={menu.y} item={folder}
          onEdit={() => setTitle(name)}
          onDelete={() => setConfirmDelete(true)}
          onClose={() => setMenu(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this folder?"
          message={`“${name}” and everything inside it will be permanently removed.`}
          confirmLabel="Delete folder"
          danger
          onConfirm={() => { setConfirmDelete(false); useNotesStore.getState().deleteItemTree(folder.id); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

export default memo(FolderItem);
