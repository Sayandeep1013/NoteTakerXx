"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGesture } from "@use-gesture/react";
import { Note as CanvasItem, useNotesStore } from "@/store/notes";
import { useTheme } from "@/hooks/useTheme";
import { DEFAULT_BADGES } from "@/lib/badges";
import DeleteConfirm from "./DeleteConfirm";
import NoteContextMenu from "./NoteContextMenu";

interface Props {
  photo: CanvasItem;
  gridUnit: number;
}

const PIN_COLORS = ["#e85d75", "#4f8cff", "#35b779", "#f0a02b", "#8e62d9"];

function pinColorFor(id: string) {
  const total = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return PIN_COLORS[total % PIN_COLORS.length];
}

export default function PhotoItem({ photo, gridUnit: G }: Props) {
  const theme = useTheme();
  const {
    updateNote,
    bringToFront,
    badgeMode,
    setBadgeMode,
    toggleNoteBadge,
    customBadges,
    selectedItemIds,
    toggleSelectedItem,
    moveItemsByGrid,
    highlightedNoteId,
    selectionMode,
  } = useNotesStore();
  const panX = useNotesStore((s) => s.canvas.panX);
  const panY = useNotesStore((s) => s.canvas.panY);
  const zoom = useNotesStore((s) => s.canvas.zoom || 1);
  const [caption, setCaption] = useState(photo.caption ?? photo.body ?? "");
  const [editingCaption, setEditingCaption] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [resizeDims, setResizeDims] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dragStart = useRef({ pixelX: 0, pixelY: 0 });

  const selected = selectedItemIds.includes(photo.id);
  const highlighted = highlightedNoteId === photo.id;
  const allBadges = [
    ...DEFAULT_BADGES,
    ...customBadges.map((cb) => ({
      id: cb.id,
      label: cb.label,
      color: "#888",
      ring: "#666",
      Icon: ({ size = 28 }: { size?: number }) => (
        <img src={cb.url} alt={cb.label} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />
      ),
    })),
  ];
  const visualX = dragPos?.x ?? resizeDims?.x ?? photo.x * G;
  const visualY = dragPos?.y ?? resizeDims?.y ?? photo.y * G;
  const visualW = resizeDims?.w ?? photo.w * G;
  const visualH = resizeDims?.h ?? photo.h * G;
  const originX = visualX * zoom + panX + (visualW * zoom) / 2;
  const originY = visualY * zoom + panY + (visualH * zoom) / 2;

  const bindDrag = useGesture({
    onDragStart: () => {
      if (photo.locked) return;
      bringToFront(photo.id);
      dragStart.current = { pixelX: photo.x * G, pixelY: photo.y * G };
    },
    onDrag: ({ movement: [mx, my] }) => {
      if (photo.locked) return;
      setDragPos({ x: dragStart.current.pixelX + mx / zoom, y: dragStart.current.pixelY + my / zoom });
    },
    onDragEnd: ({ movement: [mx, my] }) => {
      if (photo.locked) return;
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) {
        setDragPos(null);
        return;
      }
      const nextX = Math.round((dragStart.current.pixelX + mx / zoom) / G);
      const nextY = Math.round((dragStart.current.pixelY + my / zoom) / G);
      const dx = nextX - photo.x;
      const dy = nextY - photo.y;
      if (selected && selectedItemIds.length > 1) moveItemsByGrid(selectedItemIds, dx, dy);
      else updateNote(photo.id, { x: nextX, y: nextY });
      setDragPos(null);
    },
  }, { drag: { filterTaps: true, threshold: 6 } });

  const commitCaption = () => {
    updateNote(photo.id, { caption, body: caption });
    setEditingCaption(false);
  };

  const handlePointerDownCapture = (e: React.PointerEvent) => {
    if (selectionMode === "import" || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      toggleSelectedItem(photo.id);
      return;
    }
    if (badgeMode) {
      e.preventDefault();
      e.stopPropagation();
      toggleNoteBadge(photo.id, badgeMode);
      setBadgeMode(null);
      return;
    }
    bringToFront(photo.id);
  };

  const keepControlsVisible = () => {
    clearTimeout(hoverTimer.current);
    setHovered(true);
  };

  const hideControlsSoon = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(false), 900);
  };

  const fitDefaultFrameToImage = (image: HTMLImageElement) => {
    if (photo.w !== 4 || photo.h !== 5) return;
    const aspect = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 0;
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    if (aspect >= 1.25) updateNote(photo.id, { w: Math.min(8, Math.max(5, Math.round(4 * aspect))), h: 4 });
    else if (aspect <= 0.8) updateNote(photo.id, { w: 4, h: Math.min(9, Math.max(5, Math.round(4 / aspect) + 1)) });
  };

  return (
    <>
      <div
        onPointerDownCapture={handlePointerDownCapture}
        onMouseEnter={keepControlsVisible}
        onMouseLeave={hideControlsSoon}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setShowLightbox(true);
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
          width: visualW,
          height: visualH,
          zIndex: photo.zIndex,
          transform: `rotate(${photo.rotation}deg)`,
          pointerEvents: "auto",
          cursor: "default",
          background: "#fff",
          padding: "28px 12px 46px",
          borderRadius: 8,
          boxSizing: "border-box",
          boxShadow: hovered ? "0 14px 34px rgba(0,0,0,0.24)" : "0 5px 16px rgba(0,0,0,0.18)",
          outline: selected || highlighted ? "2.5px dashed var(--accent)" : undefined,
          outlineOffset: selected || highlighted ? 6 : undefined,
          transition: "box-shadow 160ms, transform 180ms",
        }}
      >
        <div
          {...bindDrag()}
          title="Drag photo"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: photo.locked ? "default" : "grab",
            zIndex: 6,
            borderRadius: "8px 8px 0 0",
            touchAction: "none",
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {hovered && !photo.locked && (
            <div style={{ display: "flex", gap: 4, opacity: 0.44, pointerEvents: "none" }}>
              {[0, 1, 2].map((dot) => (
                <span key={dot} style={{ width: 4, height: 4, borderRadius: "50%", background: "#222", display: "block" }} />
              ))}
            </div>
          )}
        </div>
        <PhotoPin color={pinColorFor(photo.id)} />
        {hovered && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setShowDelete(true);
            }}
            title="Delete photo"
            style={{
              position: "absolute",
              top: 6,
              right: 8,
              width: 20,
              height: 20,
              borderRadius: "50%",
              border: "none",
              background: "#ff453a",
              color: "#fff",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              zIndex: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.22)",
            }}
          >
            <TrashMiniIcon />
          </button>
        )}
        <div style={{ width: "100%", height: "100%", background: "#f1f1f1", overflow: "hidden", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {photo.imageUrl ? (
            <img
              src={photo.imageUrl}
              alt={caption || "Photo"}
              onLoad={(e) => fitDefaultFrameToImage(e.currentTarget)}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : null}
        </div>
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 8,
            minHeight: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {editingCaption ? (
            <input
              value={caption}
              autoFocus
              onChange={(e) => setCaption(e.target.value)}
              onBlur={commitCaption}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCaption();
                if (e.key === "Escape") {
                  setCaption(photo.caption ?? photo.body ?? "");
                  setEditingCaption(false);
                }
              }}
              style={{
                width: "100%",
                border: "none",
                borderBottom: "1px solid rgba(0,0,0,0.25)",
                outline: "none",
                fontFamily: "var(--font-note-hand), system-ui, sans-serif",
                fontSize: 15,
                color: "#222",
                textAlign: "center",
                background: "transparent",
              }}
            />
          ) : (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setEditingCaption(true)}
              title="Edit caption"
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                color: caption ? "#222" : "rgba(0,0,0,0.38)",
                fontFamily: "var(--font-note-hand), system-ui, sans-serif",
                fontSize: 15,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                cursor: "text",
              }}
            >
              {caption || "Add caption"}
            </button>
          )}
        </div>
        {!photo.locked && hovered && (
          <>
            <PhotoResizeHandle
              photo={photo}
              G={G}
              zoom={zoom}
              accent={theme.accent}
              onPixelUpdate={setResizeDims}
              onGridCommit={(patch) => {
                updateNote(photo.id, patch);
                setResizeDims(null);
              }}
              onStayHovered={keepControlsVisible}
            />
            <PhotoRotationHandle
              photo={photo}
              G={G}
              panX={panX}
              panY={panY}
              zoom={zoom}
              accent={theme.accent}
              onRotate={(rotation) => updateNote(photo.id, { rotation })}
              onStayHovered={keepControlsVisible}
            />
          </>
        )}
        {photo.badges.length > 0 && (
          <div style={{ position: "absolute", bottom: -16, right: 8, display: "flex", gap: 2, zIndex: 16, pointerEvents: "auto" }}>
            {photo.badges.map((badgeId) => {
              const badge = allBadges.find((item) => item.id === badgeId);
              if (!badge) return null;
              const { Icon } = badge;
              return (
                <div key={badgeId} title={badge.label} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))", transition: "transform 120ms" }}>
                  <Icon size={28} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {contextMenu && createPortal(
        <NoteContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          noteId={photo.id}
          noteBadges={photo.badges}
          itemType="photo"
          onEdit={() => setEditingCaption(true)}
          onDelete={() => setShowDelete(true)}
          onClose={() => setContextMenu(null)}
        />,
        document.body
      )}
      {showDelete && createPortal(
        <DeleteConfirm
          noteTitle={caption || "This photo"}
          itemType="photo"
          detail="This photo card will be permanently removed."
          onConfirm={() => {
            useNotesStore.getState().deleteItemTree(photo.id);
            setShowDelete(false);
          }}
          onCancel={() => setShowDelete(false)}
        />,
        document.body
      )}
      {showLightbox && createPortal(
        <PhotoLightbox
          photo={photo}
          caption={caption}
          originX={originX}
          originY={originY}
          originW={visualW * zoom}
          originH={visualH * zoom}
          onCaption={setCaption}
          onSaveCaption={commitCaption}
          onClose={() => setShowLightbox(false)}
        />,
        document.body
      )}
    </>
  );
}

function PhotoResizeHandle({ photo, G, zoom, accent, onPixelUpdate, onGridCommit, onStayHovered }: {
  photo: CanvasItem;
  G: number;
  zoom: number;
  accent: string;
  onPixelUpdate: (d: { x: number; y: number; w: number; h: number }) => void;
  onGridCommit: (p: Partial<CanvasItem>) => void;
  onStayHovered: () => void;
}) {
  const start = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const bind = useGesture({
    onDragStart: () => {
      start.current = { x: photo.x * G, y: photo.y * G, w: photo.w * G, h: photo.h * G };
    },
    onDrag: ({ movement: [mx, my] }) => {
      const s = start.current;
      const dx = mx / zoom;
      const dy = my / zoom;
      const w = Math.max(3 * G, s.w - dx);
      const h = Math.max(3 * G, s.h + dy);
      onPixelUpdate({ x: s.x + (s.w - w), y: s.y, w, h });
    },
    onDragEnd: ({ movement: [mx, my] }) => {
      const s = start.current;
      const dx = mx / zoom;
      const dy = my / zoom;
      const w = Math.max(3 * G, s.w - dx);
      const h = Math.max(3 * G, s.h + dy);
      onGridCommit({
        x: Math.round((s.x + (s.w - w)) / G),
        y: Math.round(s.y / G),
        w: Math.max(3, Math.round(w / G)),
        h: Math.max(3, Math.round(h / G)),
      });
    },
  }, { drag: { filterTaps: true } });
  return (
    <div {...bind()} onMouseEnter={onStayHovered} title="Resize photo" style={{ position: "absolute", left: -34, bottom: -34, width: 36, height: 36, display: "grid", placeItems: "center", cursor: "sw-resize", zIndex: 20 }}>
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: accent, display: "grid", placeItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.22)" }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="2" y1="11" x2="11" y2="2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/><polyline points="2,7 2,11 6,11" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><polyline points="11,6 11,2 7,2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
    </div>
  );
}

function PhotoRotationHandle({ photo, G, panX, panY, zoom, accent, onRotate, onStayHovered }: {
  photo: CanvasItem;
  G: number;
  panX: number;
  panY: number;
  zoom: number;
  accent: string;
  onRotate: (rotation: number) => void;
  onStayHovered: () => void;
}) {
  const startRef = useRef({ startAngle: 0, startRotation: 0 });
  const draggedRef = useRef(false);
  const [active, setActive] = useState(false);
  const [display, setDisplay] = useState(photo.rotation);
  const cx = () => (photo.x * G + photo.w * G / 2) * zoom + panX;
  const cy = () => (photo.y * G + photo.h * G / 2) * zoom + panY;
  const bind = useGesture({
    onDragStart: ({ xy: [mx, my] }) => {
      setActive(true);
      draggedRef.current = false;
      startRef.current = { startAngle: Math.atan2(my - cy(), mx - cx()), startRotation: photo.rotation };
    },
    onDrag: ({ xy: [mx, my] }) => {
      draggedRef.current = true;
      const ca = Math.atan2(my - cy(), mx - cx());
      const delta = (ca - startRef.current.startAngle) * (180 / Math.PI);
      const raw = startRef.current.startRotation + delta;
      const n = ((raw % 360) + 360) % 360;
      const snapped = Math.round((n > 180 ? n - 360 : n) * 2) / 2;
      setDisplay(snapped);
      onRotate(snapped);
    },
    onDragEnd: () => setActive(false),
  }, { drag: { filterTaps: true } });
  return (
    <div
      {...bind()}
      onMouseEnter={onStayHovered}
      onClick={(e) => {
        e.stopPropagation();
        if (draggedRef.current) {
          draggedRef.current = false;
          return;
        }
        onRotate(0);
        setDisplay(0);
      }}
      title={`${display.toFixed(1)} deg - drag to rotate, click to reset`}
      style={{ position: "absolute", right: -34, bottom: -34, width: 36, height: 36, display: "grid", placeItems: "center", cursor: active ? "grabbing" : "grab", zIndex: 20 }}
    >
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: active ? accent : "rgba(92,107,192,0.86)", display: "grid", placeItems: "center", boxShadow: active ? `0 0 0 3px ${accent}44` : "0 2px 8px rgba(0,0,0,0.22)" }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M10.5 6.5A4 4 0 012.5 6.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><polyline points="10.5,4 10.5,6.5 8,6.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
    </div>
  );
}

type LightboxPhase = "entering" | "visible" | "exiting";

function PhotoLightbox({ photo, caption, originX, originY, originW, originH, onCaption, onSaveCaption, onClose }: {
  photo: CanvasItem;
  caption: string;
  originX: number;
  originY: number;
  originW: number;
  originH: number;
  onCaption: (caption: string) => void;
  onSaveCaption: () => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<LightboxPhase>("entering");
  const triggerClose = useCallback(() => {
    onSaveCaption();
    setPhase("exiting");
  }, [onSaveCaption]);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("visible")));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") triggerClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [triggerClose]);

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const sourceAspect = originW > 0 && originH > 0 ? originW / originH : 0.78;
  const targetW = Math.min(760, vw * 0.88);
  const targetH = Math.min(vh * 0.88, Math.max(360, targetW / sourceAspect));
  const startRect = {
    left: originX - originW / 2,
    top: originY - originH / 2,
    width: originW,
    height: originH,
  };
  const targetRect = {
    left: vw / 2 - targetW / 2,
    top: vh / 2 - targetH / 2,
    width: targetW,
    height: targetH,
  };
  const rect = phase === "visible" ? targetRect : startRect;

  return (
    <div
      onClick={triggerClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 850,
        background: phase === "visible" ? "rgba(0,0,0,0.58)" : "rgba(0,0,0,0)",
        transition: "background 280ms ease",
        pointerEvents: phase === "exiting" ? "none" : "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={() => {
          if (phase === "exiting") onClose();
        }}
        style={{
          position: "fixed",
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          background: "#fff",
          padding: "18px 18px 72px",
          borderRadius: 10,
          boxShadow: phase === "visible" ? "0 34px 110px rgba(0,0,0,0.45)" : "0 5px 18px rgba(0,0,0,0.22)",
          transform: phase === "visible" ? "rotate(-0.6deg)" : `rotate(${photo.rotation}deg)`,
          opacity: 1,
          transition: "left 320ms cubic-bezier(0.22,1,0.36,1), top 320ms cubic-bezier(0.22,1,0.36,1), width 320ms cubic-bezier(0.22,1,0.36,1), height 320ms cubic-bezier(0.22,1,0.36,1), transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 220ms ease, box-shadow 260ms ease",
          overflow: "hidden",
        }}
      >
        <PhotoPin color={pinColorFor(photo.id)} large />
        <div style={{ width: "100%", height: "100%", background: "#f1f1f1", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, overflow: "hidden" }}>
          {photo.imageUrl && <img src={photo.imageUrl} alt={caption || "Photo"} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />}
        </div>
        <input
          value={caption}
          onChange={(e) => onCaption(e.target.value)}
          onBlur={onSaveCaption}
          placeholder="Add caption"
          style={{ position: "absolute", left: 22, right: 22, bottom: 20, border: "none", outline: "none", borderBottom: "1px solid rgba(0,0,0,0.22)", textAlign: "center", fontFamily: "var(--font-note-hand), system-ui, sans-serif", fontSize: 22, color: "#222", background: "transparent" }}
        />
      </div>
    </div>
  );
}

function PhotoPin({ color, large = false }: { color: string; large?: boolean }) {
  const size = large ? 21 : 16;
  return (
    <div
      style={{
        position: "absolute",
        top: large ? -7 : -8,
        left: "50%",
        transform: "translateX(-50%)",
        width: size,
        height: size,
        pointerEvents: "none",
        zIndex: 7,
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: "inset -3px -3px 0 rgba(0,0,0,0.12), 0 2px 5px rgba(0,0,0,0.28)",
          border: "2px solid rgba(255,255,255,0.78)",
        }}
      />
    </div>
  );
}

function TrashMiniIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M2 3h7M4 3V2h3v1M3 3.5l.4 5.2h4.2L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
