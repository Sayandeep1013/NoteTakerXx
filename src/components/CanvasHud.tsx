"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useNotesStore } from "@/store/notes";
import { useAllBadges } from "@/lib/badges";
import { ZOOM_STEP } from "@/lib/constants";
import CoffeeButton from "./CoffeeButton";
import { ArrowLeftIcon, CheckIcon, CloseIcon, FolderIcon, ImportIcon, MinusIcon, PlusIcon } from "./ui/icons";

export default function CanvasHud({ isEmpty }: { isEmpty: boolean }) {
  const activeFolderId = useNotesStore((s) => s.activeFolderId);
  const syncReady = useNotesStore((s) => s.syncReady);
  const badgeFilter = useNotesStore((s) => s.badgeFilter);
  const coffeeVisible = useNotesStore((s) => s.coffeeVisible);
  const [importTarget, setImportTarget] = useState<string | null>(null);

  return (
    <>
      <ZoomHud />

      <div className="hud fab-stack">
        {coffeeVisible && <CoffeeButton />}
        <button className="fab fab--primary" onClick={() => useNotesStore.getState().addNote()} title="New note" aria-label="New note">
          <PlusIcon size={24} />
        </button>
      </div>

      {activeFolderId && !importTarget && (
        <FolderNavigation
          folderId={activeFolderId}
          onImport={() => {
            const s = useNotesStore.getState();
            const parentId = s.notes.find((n) => n.id === activeFolderId)?.parentId ?? null;
            s.clearSelection();
            setImportTarget(activeFolderId);
            s.setSelectionMode("import");
            s.setActiveFolderId(parentId);
          }}
        />
      )}

      {importTarget ? (
        <ImportBar
          folderId={importTarget}
          onDone={(move) => {
            const s = useNotesStore.getState();
            if (move) s.moveItemsToFolder(s.selectedItemIds, importTarget);
            else s.clearSelection();
            s.setSelectionMode("normal");
            s.setActiveFolderId(importTarget);
            setImportTarget(null);
          }}
        />
      ) : (
        <ModeBanner />
      )}

      {!syncReady && (
        <div className="hud top-right">
          <div className="surface pill" role="status" style={{ paddingRight: 14 }}>
            <span className="loader-dots"><span /><span /><span /></span>
            Loading your notes
          </div>
        </div>
      )}

      {syncReady && isEmpty && !activeFolderId && !badgeFilter && <EmptyState />}
    </>
  );
}

function ZoomHud() {
  const zoom = useNotesStore((s) => s.canvas.zoom || 1);
  const { zoomBy, resetZoom } = useNotesStore.getState();
  return (
    <div className="hud zoom-hud surface" role="group" aria-label="Zoom">
      <button className="icon-btn icon-btn--sm icon-btn--muted" onClick={() => zoomBy(1 / ZOOM_STEP)} title="Zoom out (Ctrl −)" aria-label="Zoom out"><MinusIcon size={16} /></button>
      <button className="zoom-value" onClick={resetZoom} title="Reset to 100% (Ctrl 0)">{Math.round(zoom * 100)}%</button>
      <button className="icon-btn icon-btn--sm icon-btn--muted" onClick={() => zoomBy(ZOOM_STEP)} title="Zoom in (Ctrl +)" aria-label="Zoom in"><PlusIcon size={16} /></button>
    </div>
  );
}

function FolderNavigation({ folderId, onImport }: { folderId: string; onImport: () => void }) {
  const name = useNotesStore((s) => {
    const f = s.notes.find((n) => n.id === folderId);
    return f?.folderName ?? f?.title ?? "Folder";
  });
  return (
    <div className="hud top-left surface pill" style={{ padding: 4, gap: 4, animation: "none" }}>
      <button className="icon-btn icon-btn--sm icon-btn--round" onClick={() => useNotesStore.getState().goToParentFolder()} title="Back" aria-label="Back to parent canvas">
        <ArrowLeftIcon size={17} />
      </button>
      <FolderIcon size={15} style={{ opacity: 0.6, flexShrink: 0 }} />
      <span className="pill-text" style={{ maxWidth: "min(240px, 40vw)", fontWeight: 700 }}>{name}</span>
      <button className="icon-btn icon-btn--sm icon-btn--round" onClick={onImport} title="Bring items into this folder" aria-label="Bring items into this folder">
        <ImportIcon size={17} />
      </button>
    </div>
  );
}

function ImportBar({ folderId, onDone }: { folderId: string; onDone: (move: boolean) => void }) {
  const count = useNotesStore((s) => s.selectedItemIds.length);
  const name = useNotesStore((s) => {
    const f = s.notes.find((n) => n.id === folderId);
    return f?.folderName ?? f?.title ?? "folder";
  });
  return (
    <div className="hud top-center surface pill" role="status">
      <span className="pill-dot" />
      <span className="pill-text">{count ? `${count} selected` : `Click items to move into “${name}”`}</span>
      <button className="btn" style={{ height: 32 }} onClick={() => onDone(false)}><CloseIcon size={15} />Cancel</button>
      <button className="btn btn--primary" style={{ height: 32 }} disabled={count === 0} onClick={() => onDone(true)}><CheckIcon size={15} />Move here</button>
    </div>
  );
}

/** One banner for whichever tool mode is active, with a consistent way out. */
function ModeBanner() {
  const s = useNotesStore(useShallow((st) => ({
    rope: st.ropeMode, connecting: st.connectionMode !== null, arrow: st.arrowMode, arrowSource: st.arrowSourceId !== null,
    draw: st.drawingMode, erase: st.eraserMode, badge: st.badgeMode, strokeColor: st.strokeColor,
  })));
  const badges = useAllBadges();

  let text: string | null = null;
  let color = "var(--accent)";
  let exit = () => {};
  const store = useNotesStore.getState();
  if (s.connecting) {
    text = "Now click another note to tie the rope";
    color = "#e74c3c";
    exit = () => store.setConnectionMode(null);
  } else if (s.rope) {
    text = "Rope: click a note to start";
    color = "#e74c3c";
    exit = () => store.setRopeMode(false);
  } else if (s.arrow) {
    text = s.arrowSource ? "Now click a dot on another note" : "Arrow: click a dot on a note's edge to start";
    exit = () => store.setArrowMode(false);
  } else if (s.draw) {
    text = "Pen: drag on empty canvas to draw";
    color = s.strokeColor;
    exit = () => store.setDrawingMode(false);
  } else if (s.erase) {
    text = "Eraser: click or drag across pen strokes";
    exit = () => store.setEraserMode(false);
  } else if (s.badge) {
    text = `Click a note to add “${badges.find((b) => b.id === s.badge)?.label ?? "badge"}”`;
    exit = () => store.setBadgeMode(null);
  }
  if (!text) return null;

  return (
    <div className="hud top-center surface pill" role="status" key={text}>
      <span className="pill-dot" style={{ "--pill-color": color } as React.CSSProperties} />
      <span className="pill-text">{text}</span>
      <span className="kbd" aria-hidden="true">Esc</span>
      <button className="icon-btn icon-btn--sm icon-btn--round" onClick={exit} title="Exit" aria-label="Exit mode"><CloseIcon size={15} /></button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="hud surface" style={{ left: "50%", top: "45%", transform: "translate(-50%, -50%)", width: "min(420px, calc(100vw - 32px))", padding: "24px 24px 20px", textAlign: "center", animation: "pop-in 260ms var(--ease-out)" }}>
      <h2 style={{ margin: "0 0 6px", fontFamily: "var(--font-hand)", fontWeight: 400, fontSize: 28 }}>Your wall is empty</h2>
      <p className="muted" style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.55 }}>
        Add a note with the + button, or paste text or an image with Ctrl+V. Drag empty space to move around.
      </p>
      <button className="btn btn--primary" onClick={() => useNotesStore.getState().addNote()}><PlusIcon size={16} />New note</button>
    </div>
  );
}
