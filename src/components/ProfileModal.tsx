"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useNotesStore } from "@/store/notes";
import { DEFAULT_BADGES } from "@/lib/badges";
import { NOTE_COLOR_KEYS, type NoteColor } from "@/lib/colors";

interface Props { user: User; onClose: () => void; }

function fmtDate(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(iso: string | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function ProfileModal({ user, onClose }: Props) {
  const theme = useTheme();
  const isDark = theme.isDark;
  const { profile, updateUsername, uploadAvatar } = useProfile(user);
  const { signOut } = useAuth();
  const notes  = useNotesStore((s) => s.notes);
  const setPan = useNotesStore((s) => s.setPan);
  const setActiveFolderId = useNotesStore((s) => s.setActiveFolderId);
  const bringToFront = useNotesStore((s) => s.bringToFront);
  const setHighlightedNoteId = useNotesStore((s) => s.setHighlightedNoteId);
  const customBadges = useNotesStore((s) => s.customBadges);
  const coffeeVisible = useNotesStore((s) => s.coffeeVisible);
  const setCoffeeVisible = useNotesStore((s) => s.setCoffeeVisible);
  const G = 80;

  const [username, setUsername]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [badgeFilter, setBadgeFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [paperColor] = useState<NoteColor>(() => NOTE_COLOR_KEYS[Math.floor(Math.random() * NOTE_COLOR_KEYS.length)]);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) { setUsername(profile.username ?? ""); setAvatarUrl(profile.avatar_url); }
  }, [profile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

  const saveName = async () => {
    setSaving(true);
    await updateUsername(username);
    setSaving(false);
    setEditingName(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadAvatar(file);
    if (url) setAvatarUrl(url);
    setUploading(false);
  };

  const handleSignOut = async () => { await signOut(); onClose(); };

  const initial = (username?.[0] ?? user.email?.[0] ?? "?").toUpperCase();

  const navigateToNote = (n: typeof notes[0]) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = n.x * G + n.w * G / 2;
    const cy = n.y * G + n.h * G / 2;
    setActiveFolderId(n.parentId ?? null);
    setPan(vw / 2 - cx, vh / 2 - cy);
    bringToFront(n.id);
    setHighlightedNoteId(n.id);
    onClose();
  };

  const sorted = [...notes]
    .filter((n) => {
      const q = search.toLowerCase();
      return !q || itemLabel(n).toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || (n.caption ?? "").toLowerCase().includes(q);
    })
    .filter((n) => !badgeFilter || n.badges.includes(badgeFilter))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const allBadges = [
    ...DEFAULT_BADGES,
    ...customBadges.map((cb) => ({
      id: cb.id, label: cb.label, color: "#888",
      Icon: ({ size = 28 }: { size?: number }) => (
        <img src={cb.url} alt={cb.label} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />
      ),
    })),
  ];

  // Theme tokens
  const paper = theme.noteColors[paperColor] ?? theme.noteColors.yellow;
  const line = isDark ? "rgba(0,0,0,0.20)" : "rgba(0,0,0,0.085)";
  const bdr     = isDark ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.10)";
  const text    = theme.noteText;
  const muted   = isDark ? "rgba(240,234,216,0.58)" : "rgba(26,26,26,0.52)";
  const inp     = isDark ? "#111119" : "#fffdf8";
  const panelBg = theme.sidebarBg;
  const panelBgStrong = isDark ? "#2b2b36" : "#fffdf8";
  const panelBorder = isDark ? "#3a3a46" : "#d8c8b9";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: isDark ? "rgba(0,0,0,0.62)" : "rgba(20,18,24,0.34)",
        zIndex: 400,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(860px, 94vw)", height: "min(660px, 92vh)",
          position: "relative",
          background: paper,
          backgroundImage: `repeating-linear-gradient(transparent, transparent 23px, ${line} 23px, ${line} 24.5px)`,
          backgroundSize: "100% 24.5px",
          borderRadius: 16,
          display: "flex",
          overflow: "visible",
          transform: "rotate(-0.35deg)",
          boxShadow: isDark
            ? "0 42px 120px rgba(0,0,0,0.76)"
            : "0 42px 100px rgba(0,0,0,0.25)",
          animation: "pmIn 220ms cubic-bezier(0.34,1.4,0.64,1)",
        }}
      >
        <div style={{
          position: "absolute",
          top: -10,
          left: "50%",
          transform: "translateX(-50%)",
          width: 68,
          height: 22,
          borderRadius: 3,
          background: isDark ? "rgba(255,250,200,0.24)" : "rgba(255,253,200,0.68)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          zIndex: 6,
          pointerEvents: "none",
        }} />
        {/* ── Left: Profile card ── */}
        <div style={{
          width: 260, flexShrink: 0,
          display: "flex", flexDirection: "column",
          borderRight: `1px solid ${bdr}`,
          borderTopLeftRadius: 16,
          borderBottomLeftRadius: 16,
          padding: "28px 20px 20px",
          gap: 4,
        }}>
          {/* Avatar */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  width: 88, height: 106, borderRadius: 8, padding: "8px 8px 24px",
                  background: "#fff",
                  border: `1px solid ${bdr}`,
                  cursor: "pointer", overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 30, color: "#fff", fontWeight: 700,
                  boxShadow: `0 4px 20px ${theme.accent}44`,
                  transform: "rotate(-2deg)",
                }}
              >
                {avatarUrl
                  ? <img src={avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 3 }} alt="" />
                  : <span style={{ width: "100%", height: "100%", borderRadius: 3, background: `linear-gradient(135deg, ${theme.accent}dd, ${theme.accent}77)`, display: "grid", placeItems: "center" }}>{initial}</span>
                }
              </button>
              {/* Camera badge */}
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  position: "absolute", bottom: 2, right: 2,
                  width: 22, height: 22, borderRadius: "50%",
                  background: isDark ? "#2a2a3c" : "#fff",
                  border: `1.5px solid ${bdr}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: 11,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                }}
              >
                {uploading ? "…" : "✎"}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
            </div>

            {/* Name — click to edit */}
            {editingName ? (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
                <input
                  ref={nameRef}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                  style={{
                    width: "100%", padding: "8px 10px", borderRadius: 9,
                    background: inp, border: `1.5px solid ${theme.accent}`,
                    color: text, fontSize: 14, fontFamily: "inherit", outline: "none",
                    textAlign: "center", boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setEditingName(false)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, background: inp, border: `1px solid ${bdr}`, color: muted, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Cancel</button>
                  <button onClick={saveName} disabled={saving} style={{ flex: 1, padding: "6px 0", borderRadius: 8, background: theme.accent, border: "none", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>{saving ? "…" : "Save"}</button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 10, padding: "6px 8px", width: "100%" }}>
                <button
                  onClick={() => setEditingName(true)}
                  title="Click to edit name"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 6, maxWidth: "100%" }}
                >
                  <div style={{ fontSize: 17, fontWeight: 700, color: text, letterSpacing: "-0.02em" }}>
                    {username || <span style={{ opacity: 0.32 }}>Add name</span>}
                  </div>
                </button>
                <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{user.email}</div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { label: "Notes", value: notes.length },
              { label: "Account", value: new Date(user.created_at ?? "").toLocaleDateString(undefined, { month: "short", year: "numeric" }) },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", borderRadius: 9,
                background: panelBg, border: `1px solid ${panelBorder}`,
              }}>
                <span style={{ fontSize: 12, color: muted }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: text }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 8,
            padding: "9px 12px",
            borderRadius: 9,
            background: panelBg,
            border: `1px solid ${panelBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}>
            <span style={{ fontSize: 12, color: muted }}>Buy me a coffee button</span>
            <button
              onClick={() => setCoffeeVisible(!coffeeVisible)}
              aria-pressed={coffeeVisible}
              title={coffeeVisible ? "Hide coffee button" : "Show coffee button"}
              style={{
                width: 34,
                height: 30,
                borderRadius: 10,
                border: `1px solid ${coffeeVisible ? theme.accent : panelBorder}`,
                background: coffeeVisible ? `${theme.accent}26` : panelBg,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: coffeeVisible ? theme.accent : muted,
                transition: "background 160ms, border-color 160ms, transform 160ms",
                flexShrink: 0,
              }}
            >
              {coffeeVisible ? <HandCheckIcon /> : <HandCrossIcon />}
            </button>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            style={{
              width: "100%", padding: "9px 0", borderRadius: 9,
              background: panelBg, border: `1px solid ${panelBorder}`,
              color: isDark ? "rgba(240,90,90,0.85)" : "#c83333",
              cursor: "pointer", fontSize: 13, fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              transition: "background 150ms, border-color 150ms",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(200,50,50,0.09)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(200,50,50,0.3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = panelBg;
              (e.currentTarget as HTMLElement).style.borderColor = panelBorder;
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 12H3a1 1 0 01-1-1V3a1 1 0 011-1h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Sign out
          </button>
        </div>

        {/* ── Right: Notes list ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderTopRightRadius: 16, borderBottomRightRadius: 16 }}>
          {/* Search bar */}
          <div style={{ padding: "24px 24px 14px", flexShrink: 0 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 15, fontWeight: 700, color: text, marginBottom: 12, background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 10, padding: "6px 10px" }}>
              All items <span style={{ fontWeight: 400, fontSize: 12, color: muted, marginLeft: 4 }}>{notes.length}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.4, pointerEvents: "none" }} width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="5.5" cy="5.5" r="4" stroke={text} strokeWidth="1.3"/>
                  <line x1="8.5" y1="8.5" x2="11.5" y2="11.5" stroke={text} strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notes..."
                  style={{
                    width: "100%", padding: "8px 10px 8px 30px",
                    borderRadius: 10, background: panelBg,
                    border: `1px solid ${panelBorder}`,
                    color: text, fontSize: 13, fontFamily: "inherit", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <button
                onClick={() => setFilterOpen((v) => !v)}
                title="Filter"
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: badgeFilter ? `${theme.accent}22` : panelBg,
                  border: `1px solid ${badgeFilter ? theme.accent : panelBorder}`,
                  color: text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 3h11L9 7.6v3.2l-3 1.4V7.6L2 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
            {filterOpen && (
              <div style={{ marginTop: 8, padding: 9, borderRadius: 10, background: panelBg, border: `1px solid ${panelBorder}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: text }}>Filter by badge</span>
                  {badgeFilter && <button onClick={() => setBadgeFilter(null)} style={{ background: "transparent", border: "none", color: muted, fontSize: 11, cursor: "pointer" }}>Clear</button>}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {allBadges.map((badge) => {
                    const active = badgeFilter === badge.id;
                    const { Icon } = badge;
                    return (
                      <button
                        key={badge.id}
                        title={badge.label}
                        onClick={() => setBadgeFilter(active ? null : badge.id)}
                        style={{
                          width: 32, height: 32, padding: 3, borderRadius: 8,
                          background: active ? `${badge.color}22` : "transparent",
                          border: `1.5px solid ${active ? badge.color : "transparent"}`,
                          opacity: badgeFilter && !active ? 0.3 : 1,
                          cursor: "pointer",
                        }}
                      >
                        <Icon size={24} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px" }}>
            {sorted.length === 0 ? (
              <div style={{ textAlign: "center", marginTop: 60, color: muted, fontSize: 14 }}>
                {search || badgeFilter ? "No items match" : "No items yet - click + to create one"}
              </div>
            ) : sorted.map((n) => {
              const noteColor = theme.noteColors[n.color] ?? "#ccc";
              return (
                <div
                  key={n.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "9px 12px", borderRadius: 10, marginBottom: 8,
                    background: panelBg, cursor: "pointer",
                    transition: "background 100ms, border-color 100ms, box-shadow 100ms",
                    border: `1px solid ${panelBorder}`,
                    boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.10)" : "0 4px 14px rgba(0,0,0,0.05)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = panelBgStrong;
                    (e.currentTarget as HTMLElement).style.borderColor = `${theme.accent}88`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = panelBg;
                    (e.currentTarget as HTMLElement).style.borderColor = panelBorder;
                  }}
                  onClick={() => navigateToNote(n)}
                  title="Click to navigate to this note"
                >
                  {/* Color swatch */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                    background: noteColor,
                    boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.08)`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: text, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", lineHeight: 1.3 }}>
                      {itemLabel(n) || <span style={{ opacity: 0.3 }}>Untitled</span>}
                    </div>
                    {(n.type === "photo" ? n.caption : n.body) && (
                      <div style={{ fontSize: 12, color: muted, marginTop: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {n.type === "photo" ? n.caption : n.body}
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: muted, fontWeight: 500 }}>{fmtDate(n.createdAt)}</div>
                    <div style={{ fontSize: 11, color: muted, opacity: 0.6 }}>{fmtTime(n.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pmIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

function HandCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M3.6 9.4c1.2 1.1 2.4 2.5 3.4 3.4 1.7-2.9 4.2-5.7 7.3-8.1"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.2 9.1c1.1 1 2 2.1 2.8 2.8"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

function HandCrossIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M4.4 4.8c2.8 2.5 5.6 5.5 8.9 8.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M13.1 4.5c-2.4 2.8-5.6 5.5-8.4 8.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function itemLabel(item: ReturnType<typeof useNotesStore.getState>["notes"][number]) {
  if (item.type === "folder") return item.folderName || item.title || "Untitled Folder";
  if (item.type === "photo") return item.caption || item.body || "Untitled Photo";
  return item.title || item.body || "Untitled";
}
