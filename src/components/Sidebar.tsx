"use client";

import { createPortal } from "react-dom";
import { useState, useRef } from "react";
import { useNotesStore, SIDEBAR_W_OPEN, SIDEBAR_W_CLOSED } from "@/store/notes";
import { DEFAULT_BADGES } from "@/lib/badges";
import { useTheme } from "@/hooks/useTheme";
import { THEMES, type ThemeName } from "@/lib/themes";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNoteSync } from "@/hooks/useNoteSync";
import ProfileModal from "./ProfileModal";

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen, theme: themeName, setTheme, badgeMode, setBadgeMode, customBadges, addCustomBadge, focusedNoteId, setPendingInsert } = useNotesStore();
  const customBadgeRef = useRef<HTMLInputElement>(null);
  const currentTheme = useTheme();
  const isDark = currentTheme.isDark;
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const { profile } = useProfile(user);
  const { showMergePrompt, cachedCount, mergeLocalToCloud, discardLocal } = useNoteSync(user);
  const [showProfile, setShowProfile] = useState(false);

  const w = sidebarOpen ? SIDEBAR_W_OPEN : SIDEBAR_W_CLOSED;

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: 12, top: 12, bottom: 12,
          width: w,
          borderRadius: 16,
          background: isDark ? "rgba(18,18,22,0.82)" : "rgba(255,255,255,0.72)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1.5px solid ${isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.18)"}`,
          boxShadow: isDark ? "0 8px 40px rgba(0,0,0,0.5)" : "0 8px 40px rgba(0,0,0,0.10)",
          zIndex: 300,
          display: "flex", flexDirection: "column",
          transition: "width 220ms cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
        }}
      >
        {/* Collapse toggle */}
        <div style={{ padding: "12px 10px 4px", flexShrink: 0 }}>
          <SidebarBtn
            open={sidebarOpen}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            icon={sidebarOpen ? <ChevronLeft /> : <ChevronRight />}
            label=""
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          />
        </div>

        <Divider isDark={isDark} />

        {/* Tools */}
        <div style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Theme picker */}
          {sidebarOpen && (
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.09em", color: "var(--text-muted)", padding: "4px 6px 4px" }}>
              WALL THEME
            </span>
          )}
          <ThemePicker open={sidebarOpen} current={themeName} onChange={setTheme} isDark={isDark} />
          <Divider isDark={isDark} />
          {sidebarOpen && (
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.09em", color: "var(--text-muted)", padding: "6px 6px 2px" }}>
              FORMATTING
            </span>
          )}
          <SidebarBtn
            open={sidebarOpen}
            onClick={() => setPendingInsert("bullet")}
            icon={<BulletIcon />}
            label="Bullet list"
            title={focusedNoteId ? "Insert bullet point (Ctrl + .)" : "Select a note first"}
            disabled={!focusedNoteId}
          />
          <SidebarBtn
            open={sidebarOpen}
            onClick={() => setPendingInsert("todo")}
            icon={<TodoIcon />}
            label="To-do list"
            title={focusedNoteId ? "Insert to-do (Ctrl + /)" : "Select a note first"}
            disabled={!focusedNoteId}
          />

          <Divider isDark={isDark} />
          {sidebarOpen && (
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.09em", color: "var(--text-muted)", padding: "6px 6px 4px" }}>
              BADGES
            </span>
          )}
          {/* Badge picker */}
          <div style={{
            padding: sidebarOpen ? "2px 6px 6px" : "2px 0 6px",
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            alignItems: "center",
            justifyContent: sidebarOpen ? "flex-start" : "center",
          }}>
            {[...DEFAULT_BADGES, ...customBadges.map(cb => ({
              id: cb.id, label: cb.label, color: "#888", ring: "#666",
              Icon: ({ size = 28 }: { size?: number }) => (
                <img src={cb.url} alt={cb.label} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />
              ),
            }))].map((badge) => {
              const active = badgeMode === badge.id;
              const { Icon } = badge;
              return (
                <button
                  key={badge.id}
                  onClick={() => setBadgeMode(active ? null : badge.id)}
                  title={active ? `Cancel (${badge.label} mode)` : `Place "${badge.label}" badge on a note`}
                  style={{
                    width: 36, height: 36, borderRadius: 8, padding: 3,
                    background: active ? `${badge.color}22` : "transparent",
                    border: `1.5px solid ${active ? badge.color : "transparent"}`,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 150ms",
                    flexShrink: 0,
                    boxShadow: active ? `0 0 0 2px ${badge.color}44` : "none",
                  }}
                >
                  <Icon size={28} />
                </button>
              );
            })}
            {/* Upload custom badge */}
            <button
              onClick={() => customBadgeRef.current?.click()}
              title="Upload your own badge"
              style={{
                width: 36, height: 36, borderRadius: 8,
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                border: `1.5px dashed ${isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}`,
                cursor: "pointer", fontSize: 18, color: "var(--text-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              +
            </button>
            <input
              ref={customBadgeRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const url = ev.target?.result as string;
                  addCustomBadge({ id: `custom_${Date.now()}`, label: file.name.replace(/\.[^.]+$/, ""), url });
                };
                reader.readAsDataURL(file);
              }}
            />
          </div>
          {badgeMode && sidebarOpen && (
            <div style={{ fontSize: 11, color: "var(--accent)", padding: "0 8px 4px", fontStyle: "italic" }}>
              Click any note to place badge
            </div>
          )}
        </div>

        {/* Profile section */}
        <Divider isDark={isDark} />
        <div style={{ padding: "10px 10px 14px", flexShrink: 0 }}>
          {user ? (
            <button
              onClick={() => setShowProfile(true)}
              title="Edit profile"
              style={{
                display: "flex", alignItems: "center",
                gap: sidebarOpen ? 10 : 0,
                justifyContent: sidebarOpen ? "flex-start" : "center",
                width: "100%", padding: "7px 8px", borderRadius: 10,
                border: "none", background: "transparent",
                cursor: "pointer", textAlign: "left",
                transition: "background 130ms",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--btn-hover)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {/* Avatar */}
              <div style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                background: profile?.avatar_url ? "transparent" : "var(--accent)",
                overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "#fff",
              }}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (profile?.username?.[0] ?? user.email?.[0] ?? "?").toUpperCase()
                }
              </div>
              {/* Name + email (when open) */}
              {sidebarOpen && (
                <div style={{ overflow: "hidden", minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-ui)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {profile?.username || "Set username"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.email}
                  </div>
                </div>
              )}
            </button>
          ) : (
            <SidebarBtn
              open={sidebarOpen}
              onClick={loading ? () => {} : signInWithGoogle}
              icon={<GoogleIcon />}
              label={loading ? "…" : "Sign in with Google"}
              title="Sign in with Google"
              disabled={loading}
            />
          )}
          {/* Sign out — always visible when logged in */}
          {user && (
            <SidebarBtn
              open={sidebarOpen}
              onClick={signOut}
              icon={<SignOutIcon />}
              label="Sign out"
              title="Sign out"
            />
          )}
        </div>
      </div>

      {/* Profile modal */}
      {showProfile && user && createPortal(
        <ProfileModal user={user} onClose={() => setShowProfile(false)} />,
        document.body
      )}

      {/* Local → cloud merge prompt */}
      {showMergePrompt && createPortal(
        <MergePrompt
          count={cachedCount}
          onSave={mergeLocalToCloud}
          onDiscard={discardLocal}
        />,
        document.body
      )}
    </>
  );
}

/* ── Merge prompt ── */
function MergePrompt({ count, onSave, onDiscard }: { count: number; onSave: () => void; onDiscard: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
      zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#1e1e2a", borderRadius: 16, padding: "28px 32px", width: 360,
        border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 15, color: "#eee" }}>
          You have {count} unsaved {count === 1 ? "note" : "notes"}
        </p>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#888" }}>
          These notes were created before you signed in. Save them to your account?
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onDiscard} style={{ padding: "8px 16px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#ccc", cursor: "pointer", fontSize: 13 }}>
            Discard
          </button>
          <button onClick={onSave} style={{ padding: "8px 18px", borderRadius: 8, background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            Save to account
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Theme picker ── */
const THEME_ORDER: ThemeName[] = ["paper", "cork", "slate", "midnight", "forest", "dusk"];

function ThemePicker({ open, current, onChange, isDark }: {
  open: boolean; current: ThemeName;
  onChange: (t: ThemeName) => void; isDark: boolean;
}) {
  if (open) {
    return (
      <div style={{ padding: "4px 6px 6px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {THEME_ORDER.map((name) => {
          const cfg = THEMES[name];
          const active = current === name;
          return (
            <button
              key={name}
              onClick={() => onChange(name)}
              title={cfg.label}
              style={{
                width: "100%", aspectRatio: "1",
                borderRadius: 8, border: active ? "2px solid var(--text-ui)" : "2px solid transparent",
                background: cfg.canvasBg,
                cursor: "pointer", padding: 0,
                boxShadow: active ? "0 0 0 1px rgba(255,255,255,0.3)" : "none",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 2, overflow: "hidden",
                transition: "border-color 150ms",
              }}
            >
              {/* Mini sticky notes preview */}
              {Object.values(cfg.noteColors).slice(0, 3).map((c, i) => (
                <div key={i} style={{
                  width: 12, height: 8, borderRadius: 2,
                  background: c, opacity: 0.9,
                  transform: `rotate(${(i - 1) * 5}deg)`,
                  flexShrink: 0,
                }} />
              ))}
            </button>
          );
        })}
        <div style={{ gridColumn: "1/-1", fontSize: 10, color: "var(--text-muted)", textAlign: "center", marginTop: 2 }}>
          {THEMES[current].label}
        </div>
      </div>
    );
  }
  // Collapsed: show active swatch
  return (
    <button
      onClick={() => {
        const idx = THEME_ORDER.indexOf(current);
        onChange(THEME_ORDER[(idx + 1) % THEME_ORDER.length]);
      }}
      title={`Theme: ${THEMES[current].label} (click to cycle)`}
      style={{
        width: 28, height: 28, borderRadius: 8, margin: "0 auto 2px",
        background: THEMES[current].canvasBg,
        border: `2px solid ${isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"}`,
        cursor: "pointer", display: "block",
      }}
    />
  );
}

/* ── Generic sidebar button ── */
function SidebarBtn({ open, onClick, icon, label, title, disabled = false }: {
  open: boolean; onClick: () => void; icon: React.ReactNode;
  label: string; title: string; disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center",
        gap: open ? 10 : 0,
        justifyContent: open ? "flex-start" : "center",
        width: "100%", padding: "7px 8px", borderRadius: 8, border: "none",
        background: hovered && !disabled ? "var(--btn-hover)" : "transparent",
        color: disabled ? "var(--text-muted)" : "var(--text-ui)",
        cursor: disabled ? "default" : "pointer",
        fontSize: 13, fontFamily: "inherit", textAlign: "left",
        whiteSpace: "nowrap", overflow: "hidden",
        transition: "background 130ms", flexShrink: 0, opacity: disabled ? 0.4 : 1,
      }}
    >
      <span style={{ flexShrink: 0, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
      {open && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>}
    </button>
  );
}

function Divider({ isDark }: { isDark: boolean }) {
  return <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)", margin: "4px 10px", flexShrink: 0 }} />;
}

/* ── Icons ── */
function ChevronLeft() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function ChevronRight() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
      {[0,45,90,135,180,225,270,315].map((deg) => {
        const r = deg * Math.PI / 180;
        const x1 = 8 + Math.cos(r) * 4.8, y1 = 8 + Math.sin(r) * 4.8;
        const x2 = 8 + Math.cos(r) * 6.2, y2 = 8 + Math.sin(r) * 6.2;
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>;
      })}
    </svg>
  );
}
function MoonIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 10A6 6 0 016 2.5a5.5 5.5 0 100 11 6 6 0 007.5-3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function BulletIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="3" cy="5" r="1.5" fill="currentColor"/><line x1="6" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="3" cy="9" r="1.5" fill="currentColor"/><line x1="6" y1="9" x2="14" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="3" cy="13" r="1.5" fill="currentColor"/><line x1="6" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function TodoIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="3" height="3" rx="0.75" stroke="currentColor" strokeWidth="1.4"/><line x1="7" y1="5.5" x2="14" y2="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><rect x="2" y="9" width="3" height="3" rx="0.75" stroke="currentColor" strokeWidth="1.4"/><line x1="7" y1="10.5" x2="14" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 13H3a1 1 0 01-1-1V4a1 1 0 011-1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M14.5 8.18c0-.45-.04-.88-.11-1.3H8v2.46h3.65a3.12 3.12 0 01-1.35 2.05v1.7h2.18c1.28-1.18 2.02-2.91 2.02-4.91z" fill="#4285F4"/>
      <path d="M8 15c1.83 0 3.36-.6 4.48-1.63l-2.18-1.7c-.61.41-1.39.65-2.3.65-1.77 0-3.27-1.19-3.8-2.8H1.96v1.76A6.99 6.99 0 008 15z" fill="#34A853"/>
      <path d="M4.2 9.52A4.2 4.2 0 013.98 8c0-.53.09-1.04.22-1.52V4.72H1.96A6.99 6.99 0 001 8c0 1.13.27 2.2.96 3.28l2.24-1.76z" fill="#FBBC05"/>
      <path d="M8 3.68c1 0 1.9.34 2.6 1.01l1.94-1.94A6.96 6.96 0 008 1 6.99 6.99 0 001.96 4.72L4.2 6.48C4.73 4.87 6.23 3.68 8 3.68z" fill="#EA4335"/>
    </svg>
  );
}
