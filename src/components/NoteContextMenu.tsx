"use client";

import { createPortal } from "react-dom";
import { useState, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import { DEFAULT_BADGES } from "@/lib/badges";
import { useNotesStore } from "@/store/notes";

interface Props {
  x: number; y: number;
  noteId: string; noteBadges: string[];
  itemType?: "note" | "folder" | "photo";
  onEdit: () => void; onDelete: () => void; onClose: () => void;
}

export default function NoteContextMenu({ x, y, noteId, noteBadges, itemType = "note", onEdit, onDelete, onClose }: Props) {
  const theme = useTheme();
  const isDark = theme.isDark;
  const { notes, toggleNoteBadge, customBadges, moveItemsToFolder, isDescendantFolder } = useNotesStore();
  const [badgesOpen, setBadgesOpen]       = useState(false);
  const [folderPicker, setFolderPicker] = useState<"add" | "move" | null>(null);
  const badgesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const item = notes.find((n) => n.id === noteId);
  const isInFolder = !!item?.parentId;
  const containingFolder = item?.parentId ? notes.find((n) => n.id === item.parentId) : null;

  const openBadges = () => {
    if (badgesTimer.current) clearTimeout(badgesTimer.current);
    setBadgesOpen(true);
  };
  const closeBadges = () => {
    badgesTimer.current = setTimeout(() => setBadgesOpen(false), 250);
  };

  // Clamp so menu never clips viewport
  const menuW = 192;
  const vw = typeof window !== "undefined" ? window.innerWidth  : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cx = Math.min(x, vw - menuW - 8);
  const cy = y + 140 > vh - 8 ? Math.max(8, y - 140) : y;

  const bg   = theme.sidebarBg;
  const bdr  = theme.sidebarBorder;
  const txt  = theme.textUi;
  const muted = theme.textMuted;
  const sep  = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const hov  = theme.btnHover;
  const red  = "#e05050";

  const allBadges = [
    ...DEFAULT_BADGES,
    ...customBadges.map(cb => ({
      id: cb.id, label: cb.label,
      Icon: ({ size = 28 }: { size?: number }) =>
        <img src={cb.url} alt={cb.label} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />,
    })),
  ];

  return (
    <>
      {/* Full-screen backdrop — most reliable way to detect outside click */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 597 }}
        onPointerDown={onClose}
      />

      {/* Menu */}
      <div
        style={{
          position: "fixed", left: cx, top: cy, zIndex: 598,
          background: bg,
          border: `1px solid ${bdr}`,
          borderRadius: 12,
          boxShadow: isDark
            ? "0 2px 8px rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.55)"
            : "0 2px 6px rgba(0,0,0,0.10), 0 12px 28px rgba(0,0,0,0.12)",
          minWidth: menuW, overflow: "visible",
          padding: "4px 0",
          animation: "ctxPop 100ms cubic-bezier(0.2,0,0,1.2)",
          transformOrigin: "top left",
        }}
      >
        <Item label={itemType === "folder" ? "Rename" : itemType === "photo" ? "Edit caption" : "Edit"} icon={<IcoEdit />} txt={txt} hov={hov} onClick={() => { onEdit(); onClose(); }} />

        <Sep color={sep} />

        {/* Add badge — click to open, hover the row also opens */}
        <div
          style={{ position: "relative" }}
          onMouseEnter={openBadges}
          onMouseLeave={closeBadges}
        >
          <Item
            label="Add badge"
            icon={<IcoBadge />}
            txt={txt} hov={hov}
            suffix={
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M2 1.5l3.5 3-3.5 3" stroke={muted} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            onClick={() => setBadgesOpen(v => !v)}
          />

          {/* Side submenu */}
          {badgesOpen && (
            <div
              style={{
                position: "absolute", left: "calc(100% + 6px)", top: -4,
                background: bg,
                border: `1px solid ${bdr}`,
                borderRadius: 12,
                boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.5), 0 12px 30px rgba(0,0,0,0.5)" : "0 2px 6px rgba(0,0,0,0.10), 0 10px 24px rgba(0,0,0,0.10)",
                padding: 8, display: "flex", flexWrap: "wrap", gap: 5,
                width: 136, zIndex: 599,
                animation: "ctxPop 80ms cubic-bezier(0.2,0,0,1.2)",
              }}
              onMouseEnter={openBadges}
              onMouseLeave={closeBadges}
            >
              {allBadges.length === 0 && (
                <div style={{ color: muted, fontSize: 12, padding: "4px 2px" }}>No badges yet</div>
              )}
              {allBadges.map(({ id, label, Icon }) => {
                const active = noteBadges.includes(id);
                return (
                  <button
                    key={id}
                    title={active ? `Remove "${label}"` : label}
                    onClick={(e) => { e.stopPropagation(); toggleNoteBadge(noteId, id); onClose(); }}
                    style={{
                      width: 38, height: 38, borderRadius: 9, padding: 4, border: "none",
                      background: active ? (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)") : "transparent",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      outline: active ? `1.5px solid ${isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)"}` : "1.5px solid transparent",
                      transition: "all 80ms",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hov; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = active ? (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)") : "transparent"; }}
                  >
                    <Icon size={28} />
                  </button>
                );
              })}
              {noteBadges.length > 0 && (
                <div style={{ width: "100%", fontSize: 10, color: muted, textAlign: "center", marginTop: 2 }}>
                  click badge to remove
                </div>
              )}
            </div>
          )}
        </div>

        <Sep color={sep} />

        <Item
          label={isInFolder ? "Move to different folder" : "Add to folder"}
          icon={<IcoFolder />}
          txt={txt}
          hov={hov}
          onClick={() => setFolderPicker(isInFolder ? "move" : "add")}
        />
        {isInFolder && (
          <Item
            label="Remove from this folder"
            icon={<IcoFolderOut />}
            txt={txt}
            hov={hov}
            onClick={() => {
              moveItemsToFolder([noteId], containingFolder?.parentId ?? null);
              onClose();
            }}
          />
        )}

        <Sep color={sep} />

        <Item label="Delete" icon={<IcoTrash />} txt={red} hov="rgba(220,50,50,0.09)" onClick={() => { onDelete(); onClose(); }} />

        <style>{`
          @keyframes ctxPop {
            from { opacity:0; transform:scale(0.92); }
            to   { opacity:1; transform:scale(1); }
          }
        `}</style>
      </div>

      {folderPicker && (
        <FolderPicker
          itemId={noteId}
          itemType={itemType}
          folders={notes.filter((n) => n.type === "folder")}
          currentParentId={item?.parentId ?? null}
          canMoveTo={(folderId) => itemType !== "folder" || (folderId !== noteId && !isDescendantFolder(noteId, folderId))}
          onPick={(folderId) => {
            moveItemsToFolder([noteId], folderId);
            setFolderPicker(null);
            onClose();
          }}
          onCancel={() => setFolderPicker(null)}
        />
      )}
    </>
  );
}

function FolderPicker({ itemId, itemType, folders, currentParentId, canMoveTo, onPick, onCancel }: {
  itemId: string;
  itemType: "note" | "folder" | "photo";
  folders: ReturnType<typeof useNotesStore.getState>["notes"];
  currentParentId: string | null;
  canMoveTo: (folderId: string) => boolean;
  onPick: (folderId: string) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const filtered = folders.filter((folder) => (folder.folderName ?? folder.title ?? "Untitled Folder").toLowerCase().includes(query.toLowerCase()));
  return createPortal(
    <div onPointerDown={onCancel} style={{ position: "fixed", inset: 0, zIndex: 720, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.34)" }}>
      <div onPointerDown={(e) => e.stopPropagation()} style={{ width: "min(360px, 92vw)", maxHeight: "70vh", overflow: "hidden", borderRadius: 16, background: theme.sidebarBg, color: theme.textUi, border: `1px solid ${theme.sidebarBorder}`, boxShadow: "0 28px 90px rgba(0,0,0,0.32)", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <IcoFolder />
          <strong style={{ fontSize: 14 }}>Choose folder</strong>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder={`Move ${itemType} to...`}
          style={{ width: "100%", height: 34, borderRadius: 10, border: `1px solid ${theme.sidebarBorder}`, background: theme.isDark ? "#101018" : "#fffdf8", color: theme.textUi, padding: "0 10px", outline: "none", fontFamily: "inherit", marginBottom: 9 }}
        />
        <div style={{ maxHeight: 310, overflow: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.length === 0 && <div style={{ color: theme.textMuted, fontSize: 12, padding: 10 }}>No folders found</div>}
          {filtered.map((folder) => {
            const disabled = folder.id === currentParentId || folder.id === itemId || !canMoveTo(folder.id);
            return (
              <button
                key={folder.id}
                disabled={disabled}
                onClick={() => onPick(folder.id)}
                title={disabled ? "Unavailable destination" : `Move to ${folder.folderName ?? folder.title}`}
                style={{
                  height: 38,
                  border: "none",
                  borderRadius: 10,
                  background: disabled ? "transparent" : "var(--btn-hover)",
                  color: theme.textUi,
                  opacity: disabled ? 0.35 : 1,
                  cursor: disabled ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "0 10px",
                  textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                <IcoFolder />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.folderName ?? folder.title ?? "Untitled Folder"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Sep({ color }: { color: string }) {
  return <div style={{ height: "0.5px", background: color, margin: "3px 0" }} />;
}

function Item({ label, icon, txt, hov, onClick, suffix }: {
  label: string; icon: React.ReactNode; txt: string; hov: string;
  onClick: () => void; suffix?: React.ReactNode;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: "calc(100% - 8px)", margin: "1px 4px",
        padding: "0 10px", height: 28,
        background: h ? hov : "transparent",
        border: "none", borderRadius: 7,
        color: txt, fontSize: 13, fontFamily: "inherit",
        textAlign: "left", cursor: "pointer",
        transition: "background 70ms",
        justifyContent: "space-between",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: 0.7 }}>{icon}</span>
        {label}
      </span>
      {suffix}
    </button>
  );
}

function IcoEdit()  { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 1.5L10.5 4 3.5 11H1v-2.5L8 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IcoBadge() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.2"/><rect x="4.5" y="0.5" width="3" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="1.2"/></svg>; }
function IcoFolder() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 4h3.2l1-1.2h5.8v7.4a1 1 0 01-1 1h-8a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>; }
function IcoFolderOut() { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 4h3.2l1-1.2h5.8v7.4a1 1 0 01-1 1h-8a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M8.2 8.5H4M5.5 7.1L4 8.5l1.5 1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IcoTrash() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="1" y1="3" x2="11" y2="3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M3.5 3V2a.5.5 0 01.5-.5h4a.5.5 0 01.5.5v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><rect x="2" y="3" width="8" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.2"/><line x1="4.5" y1="5.5" x2="4.5" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="7.5" y1="5.5" x2="7.5" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>; }
