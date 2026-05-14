"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGesture } from "@use-gesture/react";
import { Note as CanvasItem, useNotesStore } from "@/store/notes";
import { useTheme } from "@/hooks/useTheme";
import DeleteConfirm from "./DeleteConfirm";
import NoteContextMenu from "./NoteContextMenu";

interface Props {
  folder: CanvasItem;
  items: CanvasItem[];
  gridUnit: number;
}

export default function FolderItem({ folder, items, gridUnit: G }: Props) {
  const theme = useTheme();
  const {
    updateNote,
    openFolder,
    bringToFront,
    selectedItemIds,
    toggleSelectedItem,
    moveItemsByGrid,
    highlightedNoteId,
    selectionMode,
  } = useNotesStore();
  const zoom = useNotesStore((s) => s.canvas.zoom || 1);
  const children = useMemo(() => items.filter((item) => item.parentId === folder.id), [folder.id, items]);
  const preview = children.slice(0, 4);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(folder.folderName ?? folder.title ?? "Untitled Folder");
  const [showDelete, setShowDelete] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const dragStart = useRef({ pixelX: 0, pixelY: 0 });
  const dragActive = useRef(false);

  const selected = selectedItemIds.includes(folder.id);
  const highlighted = highlightedNoteId === folder.id;
  const visualX = dragPos?.x ?? folder.x * G;
  const visualY = dragPos?.y ?? folder.y * G;
  const size = Math.max(76, folder.w * G);
  const labelBg = theme.folderLabelBg;
  const labelText = theme.folderLabelText;
  const labelBorder = theme.folderLabelBorder;

  const bindDrag = useGesture({
    onDragStart: () => {
      bringToFront(folder.id);
      dragStart.current = { pixelX: folder.x * G, pixelY: folder.y * G };
      dragActive.current = true;
    },
    onDrag: ({ movement: [mx, my] }) => {
      if (!dragActive.current) return;
      setDragPos({ x: dragStart.current.pixelX + mx / zoom, y: dragStart.current.pixelY + my / zoom });
    },
    onDragEnd: ({ movement: [mx, my] }) => {
      if (!dragActive.current) return;
      dragActive.current = false;
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) { setDragPos(null); return; }
      const nextX = Math.round((dragStart.current.pixelX + mx / zoom) / G);
      const nextY = Math.round((dragStart.current.pixelY + my / zoom) / G);
      const dx = nextX - folder.x;
      const dy = nextY - folder.y;
      if (selected && selectedItemIds.length > 1) moveItemsByGrid(selectedItemIds, dx, dy);
      else updateNote(folder.id, { x: nextX, y: nextY });
      setDragPos(null);
    },
  }, { drag: { filterTaps: true, threshold: 6 } });

  const commitTitle = () => {
    const next = title.trim() || "Untitled Folder";
    setTitle(next);
    updateNote(folder.id, { title: next, folderName: next });
    setEditing(false);
  };

  const handlePointerDownCapture = (e: React.PointerEvent) => {
    if (selectionMode === "import" || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      toggleSelectedItem(folder.id);
      return;
    }
    bringToFront(folder.id);
  };

  return (
    <>
      <div
        onPointerDownCapture={handlePointerDownCapture}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!editing) openFolder(folder.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
        style={{
          position: "absolute",
          left: visualX,
          top: visualY,
          width: size,
          minHeight: size + 30,
          zIndex: folder.zIndex,
          pointerEvents: "auto",
          cursor: "default",
          outline: selected || highlighted ? "2.5px dashed var(--accent)" : undefined,
          outlineOffset: selected || highlighted ? 6 : undefined,
          borderRadius: 16,
          color: "var(--text-ui)",
          animation: "folderPop 180ms cubic-bezier(0.2,1.2,0.35,1)",
        }}
      >
        <div
          title="Open folder"
          style={{ position: "relative", width: size, height: size }}
        >
          <div
            {...bindDrag()}
            title="Drag folder"
            onDoubleClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: -12,
              left: "50%",
              transform: "translateX(-50%)",
              width: Math.min(54, size * 0.72),
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "grab",
              touchAction: "none",
              zIndex: 8,
            }}
          >
            {hovered && (
              <span style={{ display: "flex", gap: 4, opacity: 0.46, pointerEvents: "none" }}>
                {[0, 1, 2].map((dot) => (
                  <span key={dot} style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--text-ui)", display: "block" }} />
                ))}
              </span>
            )}
          </div>
          {[3, 2, 1, 0].map((layer) => {
            const item = preview[layer];
            const colors = Object.values(theme.noteColors);
            const bg = item?.type === "photo" ? "#fff" : item ? theme.noteColors[item.color] : colors[layer % colors.length];
            return (
              <div
                key={layer}
                style={{
                  position: "absolute",
                  inset: 11 - layer * 3,
                  borderRadius: 10,
                  background: bg,
                  transform: `rotate(${(layer - 1.5) * 4}deg) translate(${layer * 2}px, ${-layer}px)`,
                  boxShadow: "0 5px 14px rgba(0,0,0,0.20)",
                  border: item?.type === "photo" ? "5px solid #fff" : "1px solid rgba(0,0,0,0.08)",
                  overflow: "hidden",
                }}
              >
                {item?.type === "photo" && item.imageUrl && (
                  <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </div>
            );
          })}
          <div style={{
            position: "absolute",
            right: 1,
            bottom: 2,
            minWidth: 23,
            height: 23,
            padding: "0 7px",
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            background: theme.accent,
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            boxShadow: "0 4px 12px rgba(0,0,0,0.26)",
          }}>
            {children.length}
          </div>
        </div>
        <div style={{ marginTop: 6, display: "flex", justifyContent: "center" }}>
          {editing ? (
            <input
              value={title}
              autoFocus
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setTitle(folder.folderName ?? folder.title ?? "Untitled Folder");
                  setEditing(false);
                }
              }}
              style={{
                width: Math.max(126, size + 18),
                border: "none",
                outline: `1.5px solid ${labelBorder}`,
                background: labelBg,
                color: labelText,
                borderRadius: 8,
                padding: "5px 7px",
                textAlign: "center",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 700,
              }}
            />
          ) : (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              title="Click to rename folder"
              style={{
                maxWidth: Math.max(136, size + 28),
                border: `1px solid ${labelBorder}`,
                background: labelBg,
                color: labelText,
                boxShadow: "0 4px 12px rgba(0,0,0,0.22)",
                borderRadius: 9,
                padding: "5px 9px",
                fontSize: 12,
                fontWeight: 800,
                fontFamily: "inherit",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                cursor: "text",
              }}
            >
              {folder.folderName ?? folder.title ?? "Untitled Folder"}
            </button>
          )}
        </div>
      </div>

      {contextMenu && createPortal(
        <NoteContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          noteId={folder.id}
          noteBadges={folder.badges}
          itemType="folder"
          onEdit={() => setEditing(true)}
          onDelete={() => setShowDelete(true)}
          onClose={() => setContextMenu(null)}
        />,
        document.body
      )}
      {showDelete && createPortal(
        <DeleteConfirm
          noteTitle={folder.folderName ?? folder.title}
          itemType="folder"
          detail="This folder and everything inside it will be permanently removed."
          onConfirm={() => {
            useNotesStore.getState().deleteItemTree(folder.id);
            setShowDelete(false);
          }}
          onCancel={() => setShowDelete(false)}
        />,
        document.body
      )}
      <style>{`
        @keyframes folderPop {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
