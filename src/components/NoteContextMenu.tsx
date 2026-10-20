"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { useNotesStore, type Note } from "@/store/notes";
import { useAllBadges } from "@/lib/badges";
import Modal from "./ui/Modal";
import { BadgeIcon, ChevronRightIcon, EditIcon, FolderIcon, FolderOutIcon, TrashIcon } from "./ui/icons";

interface Props {
  x: number;
  y: number;
  item: Note;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const MENU_W = 210;
const MENU_H = 210;
const SUBMENU_W = 150;

const EDIT_LABEL = { note: "Edit", folder: "Rename", photo: "Edit caption", stroke: "Edit" } as const;

export default function NoteContextMenu({ x, y, item, onEdit, onDelete, onClose }: Props) {
  const badges = useAllBadges();
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [pickingFolder, setPickingFolder] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const canBadge = item.type !== "folder";

  const vw = window.innerWidth, vh = window.innerHeight;
  const left = Math.max(8, Math.min(x, vw - MENU_W - 8));
  const top = y + MENU_H > vh - 8 ? Math.max(8, y - MENU_H) : y;
  const submenuLeft = left + MENU_W + SUBMENU_W + 12 > vw;

  const openBadges = () => { clearTimeout(closeTimer.current); setBadgesOpen(true); };
  const closeBadges = () => { closeTimer.current = setTimeout(() => setBadgesOpen(false), 250); };
  const run = (fn: () => void) => () => { fn(); onClose(); };

  useEffect(() => {
    if (pickingFolder) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pickingFolder, onClose]);

  if (pickingFolder) {
    return <FolderPicker item={item} onDone={onClose} />;
  }

  return createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 599 }} onPointerDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="menu surface" role="menu" style={{ left, top, width: MENU_W }}>
        <button className="menu-item" role="menuitem" onClick={run(onEdit)}><EditIcon size={15} />{EDIT_LABEL[item.type]}</button>

        {canBadge && (
          <div style={{ position: "relative" }} onMouseEnter={openBadges} onMouseLeave={closeBadges}>
            <button className="menu-item" role="menuitem" aria-haspopup="true" aria-expanded={badgesOpen} onClick={() => setBadgesOpen((v) => !v)}>
              <BadgeIcon size={15} />
              <span style={{ flex: 1 }}>Badges</span>
              <ChevronRightIcon size={13} />
            </button>
            {badgesOpen && (
              <div
                className="menu surface"
                style={{ position: "absolute", top: -4, [submenuLeft ? "right" : "left"]: "calc(100% + 8px)", width: SUBMENU_W, minWidth: 0, padding: 8, display: "flex", flexWrap: "wrap", gap: 4 }}
                onMouseEnter={openBadges}
                onMouseLeave={closeBadges}
              >
                {badges.map(({ id, label, Icon }) => {
                  const active = item.badges.includes(id);
                  return (
                    <button
                      key={id}
                      className="icon-btn"
                      data-active={active}
                      title={active ? `Remove “${label}”` : `Add “${label}”`}
                      onClick={run(() => useNotesStore.getState().toggleNoteBadge(item.id, id))}
                    >
                      <Icon size={26} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="menu-sep" />
        <button className="menu-item" role="menuitem" onClick={() => setPickingFolder(true)}>
          <FolderIcon size={15} />{item.parentId ? "Move to another folder" : "Add to folder"}
        </button>
        {item.parentId && (
          <button className="menu-item" role="menuitem" onClick={run(() => {
            const { notes, moveItemsToFolder } = useNotesStore.getState();
            moveItemsToFolder([item.id], notes.find((n) => n.id === item.parentId)?.parentId ?? null);
          })}>
            <FolderOutIcon size={15} />Move out of this folder
          </button>
        )}
        <div className="menu-sep" />
        <button className="menu-item menu-item--danger" role="menuitem" onClick={run(onDelete)}><TrashIcon size={15} />Delete</button>
      </div>
    </>,
    document.body,
  );
}

function FolderPicker({ item, onDone }: { item: Note; onDone: () => void }) {
  const folders = useNotesStore(useShallow((s) => s.notes.filter((n) => n.type === "folder")));
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = folders.filter((f) => (f.folderName ?? f.title ?? "").toLowerCase().includes(q));
  const { isDescendantFolder, moveItemsToFolder } = useNotesStore.getState();

  return (
    <Modal onClose={onDone} label="Choose folder" closeButton>
      <h2 className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><FolderIcon size={18} />Choose a folder</h2>
      <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search folders" autoFocus style={{ margin: "8px 0 10px" }} />
      <div className="scroll-y" style={{ maxHeight: 300, display: "flex", flexDirection: "column", gap: 2 }}>
        {filtered.length === 0 && <p className="muted" style={{ fontSize: 13, padding: "8px 4px", margin: 0 }}>{folders.length ? "No folders match." : "No folders yet. Create one from the dock."}</p>}
        {filtered.map((folder) => {
          const disabled = folder.id === item.parentId || folder.id === item.id || (item.type === "folder" && isDescendantFolder(item.id, folder.id));
          return (
            <button
              key={folder.id}
              className="menu-item"
              disabled={disabled}
              style={{ height: 38, opacity: disabled ? 0.4 : 1 }}
              title={disabled ? "Can't move here" : undefined}
              onClick={() => { moveItemsToFolder([item.id], folder.id); onDone(); }}
            >
              <FolderIcon size={16} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.folderName ?? folder.title ?? "Untitled Folder"}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
