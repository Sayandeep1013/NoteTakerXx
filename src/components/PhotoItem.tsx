"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNotesStore, type Note as CanvasItem } from "@/store/notes";
import { useAllBadges } from "@/lib/badges";
import { handleItemModePointer } from "@/lib/items";
import { GRID, MIN_PHOTO_SIZE } from "@/lib/constants";
import { useItemDrag } from "@/hooks/useItemDrag";
import { ResizeHandle, RotateHandle, type PixelRect } from "./ItemHandles";
import NoteContextMenu from "./NoteContextMenu";
import { ConfirmDialog } from "./ui/Modal";
import { TrashIcon } from "./ui/icons";

const PIN_COLORS = ["#e85d75", "#4f8cff", "#35b779", "#f0a02b", "#8e62d9"];

function pinColorFor(id: string) {
  let total = 0;
  for (let i = 0; i < id.length; i++) total += id.charCodeAt(i);
  return PIN_COLORS[total % PIN_COLORS.length];
}

function PhotoItem({ photo }: { photo: CanvasItem }) {
  const selected = useNotesStore((s) => s.selectedItemIds.includes(photo.id));
  const highlighted = useNotesStore((s) => s.highlightedNoteId === photo.id);
  const isConnectSource = useNotesStore((s) => s.connectionMode === photo.id);
  const badges = useAllBadges();
  const badgeById = useMemo(() => new Map(badges.map((b) => [b.id, b])), [badges]);

  const rootRef = useRef<HTMLDivElement>(null);
  const savedCaption = photo.caption ?? photo.body ?? "";
  const [caption, setCaption] = useState<string | null>(null); // non-null while editing
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightboxFrom, setLightboxFrom] = useState<DOMRect | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [liveRect, setLiveRect] = useState<PixelRect | null>(null);
  const [liveRotation, setLiveRotation] = useState<number | null>(null);
  const { bind, dragPos, dragging } = useItemDrag(photo, { disabled: photo.locked, threshold: 6 });

  useEffect(() => {
    if (!highlighted) return;
    const timer = setTimeout(() => useNotesStore.getState().setHighlightedNoteId(null), 2400);
    return () => clearTimeout(timer);
  }, [highlighted]);

  const commitCaption = (value = caption) => {
    if (value !== null && value !== savedCaption) useNotesStore.getState().updateNote(photo.id, { caption: value, body: value });
    setCaption(null);
  };

  // Photos added before their dimensions were known get a frame that fits the image.
  const fitFrameToImage = (image: HTMLImageElement) => {
    if (photo.w !== 4 || photo.h !== 5) return;
    const aspect = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 0;
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    const { updateNote } = useNotesStore.getState();
    if (aspect >= 1.25) updateNote(photo.id, { w: Math.min(8, Math.max(5, Math.round(4 * aspect))), h: 4 });
    else if (aspect <= 0.8) updateNote(photo.id, { w: 4, h: Math.min(9, Math.max(5, Math.round(4 / aspect) + 1)) });
  };

  const x = dragPos?.x ?? liveRect?.x ?? photo.x * GRID;
  const y = dragPos?.y ?? liveRect?.y ?? photo.y * GRID;
  const w = liveRect?.w ?? photo.w * GRID;
  const h = liveRect?.h ?? photo.h * GRID;
  const label = savedCaption || "Photo";

  return (
    <>
      <div
        ref={rootRef}
        data-item={photo.id}
        data-connectable="true"
        data-selected={selected}
        data-highlighted={highlighted}
        data-connect-source={isConnectSource}
        data-dragging={dragging || liveRect !== null || liveRotation !== null}
        tabIndex={-1}
        className="item photo"
        onPointerDownCapture={(e) => {
          if (handleItemModePointer(photo.id, e, { connectable: true })) { e.preventDefault(); e.stopPropagation(); }
        }}
        onPointerDown={() => useNotesStore.getState().bringToFront(photo.id)}
        onDoubleClick={() => setLightboxFrom(rootRef.current?.getBoundingClientRect() ?? null)}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
        style={{ left: x, top: y, width: w, height: h, zIndex: photo.zIndex, transform: `rotate(${liveRotation ?? photo.rotation}deg)` }}
      >
        <div
          {...bind()}
          className={photo.locked ? undefined : "drag-handle"}
          title="Drag to move · double-click to enlarge"
          onDoubleClick={(e) => e.stopPropagation()}
          style={{ position: "absolute", inset: "0 0 auto 0", height: 28, display: "grid", placeItems: "center", zIndex: 6, color: "#222" }}
        >
          {!photo.locked && <span className="grip reveal"><span /><span /><span /></span>}
        </div>
        <span className="pin" style={{ "--pin": pinColorFor(photo.id) } as React.CSSProperties} />
        <button
          className="traffic traffic--delete reveal"
          style={{ "--dot": "#ff453a", position: "absolute", top: 6, right: 8, zIndex: 12, width: 18, height: 18, color: "#fff" } as React.CSSProperties}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setConfirmDelete(true)}
          title="Delete photo"
          aria-label="Delete photo"
        >
          <TrashIcon size={11} strokeWidth={2} />
        </button>

        <div className="photo-frame">
          {photo.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.imageUrl} alt={label} draggable={false} decoding="async" loading="lazy" onLoad={(e) => fitFrameToImage(e.currentTarget)} />
          )}
        </div>

        <div onPointerDown={(e) => e.stopPropagation()} style={{ position: "absolute", left: 12, right: 12, bottom: 8, height: 30, display: "grid", placeItems: "center" }}>
          {caption !== null ? (
            <input
              className="photo-caption"
              value={caption}
              autoFocus
              placeholder="Add caption"
              onChange={(e) => setCaption(e.target.value)}
              onBlur={() => commitCaption()}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCaption();
                if (e.key === "Escape") setCaption(null);
              }}
              style={{ borderBottom: "1px solid rgba(0,0,0,0.25)", outline: "none" }}
            />
          ) : (
            <button className="photo-caption" data-empty={!savedCaption} onClick={() => setCaption(savedCaption)} title="Edit caption" style={{ cursor: "text" }}>
              {savedCaption || "Add caption"}
            </button>
          )}
        </div>

        {!photo.locked && (
          <>
            <ResizeHandle item={photo} minSize={MIN_PHOTO_SIZE} onLive={setLiveRect} />
            <RotateHandle item={photo} onLive={setLiveRotation} />
          </>
        )}

        {photo.badges.length > 0 && (
          <div className="item-badges">
            {photo.badges.map((id) => {
              const badge = badgeById.get(id);
              return badge ? <span key={id} title={badge.label}><badge.Icon size={28} /></span> : null;
            })}
          </div>
        )}
      </div>

      {menu && (
        <NoteContextMenu
          x={menu.x} y={menu.y} item={photo}
          onEdit={() => setCaption(savedCaption)}
          onDelete={() => setConfirmDelete(true)}
          onClose={() => setMenu(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this photo?"
          message="This photo card will be permanently removed."
          confirmLabel="Delete photo"
          danger
          onConfirm={() => { setConfirmDelete(false); useNotesStore.getState().deleteItemTree(photo.id); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {lightboxFrom && (
        <PhotoLightbox
          photo={photo}
          from={lightboxFrom}
          caption={savedCaption}
          onSaveCaption={(value) => commitCaption(value)}
          onClose={() => setLightboxFrom(null)}
        />
      )}
    </>
  );
}

export default memo(PhotoItem);

type Phase = "entering" | "visible" | "exiting";

function PhotoLightbox({ photo, from, caption, onSaveCaption, onClose }: {
  photo: CanvasItem;
  from: DOMRect;
  caption: string;
  onSaveCaption: (caption: string) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("entering");
  const [draft, setDraft] = useState(caption);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("visible")));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = () => {
    onSaveCaption(draft);
    setPhase("exiting");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setPhase("exiting");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const vw = window.innerWidth, vh = window.innerHeight;
  const aspect = from.width > 0 && from.height > 0 ? from.width / from.height : 0.78;
  const w = Math.min(760, vw * 0.9);
  const h = Math.min(vh * 0.88, Math.max(320, w / aspect));
  const fromTransform = `translate(${from.left + from.width / 2 - vw / 2}px, ${from.top + from.height / 2 - vh / 2}px) scale(${from.width / w}, ${from.height / h}) rotate(${photo.rotation}deg)`;
  const collapsed = phase !== "visible";

  return createPortal(
    <div
      onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{ position: "fixed", inset: 0, zIndex: 850, background: "rgba(0,0,0,0.62)", opacity: collapsed ? 0 : 1, transition: "opacity 260ms ease", pointerEvents: phase === "exiting" ? "none" : "auto" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={caption || "Photo"}
        onTransitionEnd={(e) => { if (e.propertyName === "transform" && phase === "exiting") onClose(); }}
        style={{
          position: "fixed", left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h,
          padding: "18px 18px 72px", borderRadius: 10, background: "#fff",
          boxShadow: "var(--shadow-lg)",
          transform: collapsed ? fromTransform : "rotate(-0.6deg)",
          transition: "transform 340ms var(--ease-out)",
        }}
      >
        <span className="pin" style={{ "--pin": pinColorFor(photo.id), width: 21, height: 21, top: -7 } as React.CSSProperties} />
        <div className="photo-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo.imageUrl && <img src={photo.imageUrl} alt={caption || "Photo"} draggable={false} />}
        </div>
        <input
          className="photo-caption"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onSaveCaption(draft)}
          placeholder="Add caption"
          style={{ position: "absolute", left: 22, right: 22, bottom: 20, width: "auto", outline: "none", borderBottom: "1px solid rgba(0,0,0,0.22)", fontSize: 22 }}
        />
      </div>
    </div>,
    document.body,
  );
}
