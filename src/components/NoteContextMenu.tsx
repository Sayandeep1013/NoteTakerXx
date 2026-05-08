"use client";

import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { DEFAULT_BADGES } from "@/lib/badges";
import { useNotesStore } from "@/store/notes";

interface Props {
  x: number; y: number;
  noteId: string; noteBadges: string[];
  onEdit: () => void; onDelete: () => void; onClose: () => void;
}

export default function NoteContextMenu({ x, y, noteId, noteBadges, onEdit, onDelete, onClose }: Props) {
  const theme = useTheme();
  const isDark = theme.isDark;
  const { toggleNoteBadge, customBadges } = useNotesStore();
  const [badgesOpen, setBadgesOpen]       = useState(false);

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
          backdropFilter: "blur(40px) saturate(200%)",
          WebkitBackdropFilter: "blur(40px) saturate(200%)",
          border: `0.5px solid ${bdr}`,
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
        <Item label="Edit" icon={<IcoEdit />} txt={txt} hov={hov} onClick={() => { onEdit(); onClose(); }} />

        <Sep color={sep} />

        {/* Add badge — click to open, hover the row also opens */}
        <div
          style={{ position: "relative" }}
          onMouseEnter={() => setBadgesOpen(true)}
          onMouseLeave={() => setBadgesOpen(false)}
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
                backdropFilter: "blur(40px) saturate(200%)",
                WebkitBackdropFilter: "blur(40px) saturate(200%)",
                border: `0.5px solid ${bdr}`,
                borderRadius: 12,
                boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.5), 0 12px 30px rgba(0,0,0,0.5)" : "0 2px 6px rgba(0,0,0,0.10), 0 10px 24px rgba(0,0,0,0.10)",
                padding: 8, display: "flex", flexWrap: "wrap", gap: 5,
                width: 136, zIndex: 599,
                animation: "ctxPop 80ms cubic-bezier(0.2,0,0,1.2)",
              }}
              onMouseEnter={() => setBadgesOpen(true)}
              onMouseLeave={() => setBadgesOpen(false)}
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

        <Item label="Delete" icon={<IcoTrash />} txt={red} hov="rgba(220,50,50,0.09)" onClick={() => { onDelete(); onClose(); }} />

        <style>{`
          @keyframes ctxPop {
            from { opacity:0; transform:scale(0.92); }
            to   { opacity:1; transform:scale(1); }
          }
        `}</style>
      </div>
    </>
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
function IcoTrash() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="1" y1="3" x2="11" y2="3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M3.5 3V2a.5.5 0 01.5-.5h4a.5.5 0 01.5.5v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><rect x="2" y="3" width="8" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.2"/><line x1="4.5" y1="5.5" x2="4.5" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="7.5" y1="5.5" x2="7.5" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>; }
