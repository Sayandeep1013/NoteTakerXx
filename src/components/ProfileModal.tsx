"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useNotesStore } from "@/store/notes";
import { DEFAULT_BADGES } from "@/lib/badges";

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
  const customBadges = useNotesStore((s) => s.customBadges);
  const G = 80;

  const [username, setUsername]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [badgeFilter, setBadgeFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
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
    setPan(vw / 2 - cx, vh / 2 - cy);
    onClose();
  };

  const sorted = [...notes]
    .filter((n) => {
      const q = search.toLowerCase();
      return !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
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
  const glass   = isDark ? "rgba(18,16,28,0.95)"  : "rgba(250,250,255,0.95)";
  const glass2  = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)";
  const bdr     = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)";
  const text    = isDark ? "#ede5f5" : "#111";
  const muted   = isDark ? "rgba(237,229,245,0.38)" : "rgba(17,17,17,0.36)";
  const inp     = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: isDark ? "rgba(0,0,0,0.7)" : "rgba(10,10,20,0.42)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: 400,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(860px, 94vw)", height: "min(660px, 92vh)",
          background: glass,
          backdropFilter: "blur(30px) saturate(140%)",
          WebkitBackdropFilter: "blur(30px) saturate(140%)",
          border: `1px solid ${bdr}`,
          borderRadius: 20,
          display: "flex",
          overflow: "hidden",
          boxShadow: isDark
            ? "0 48px 120px rgba(0,0,0,0.75), 0 0 0 0.5px rgba(255,255,255,0.07)"
            : "0 48px 100px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.05)",
          animation: "pmIn 220ms cubic-bezier(0.34,1.4,0.64,1)",
        }}
      >
        {/* ── Left: Profile card ── */}
        <div style={{
          width: 260, flexShrink: 0,
          display: "flex", flexDirection: "column",
          background: glass2,
          borderRight: `1px solid ${bdr}`,
          padding: "28px 20px 20px",
          gap: 4,
        }}>
          {/* Close */}
          <button
            onClick={onClose}
            style={{
              alignSelf: "flex-end",
              width: 26, height: 26, borderRadius: "50%",
              background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)",
              border: "none", color: muted, cursor: "pointer", fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 12, flexShrink: 0,
            }}
          >×</button>

          {/* Avatar */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  width: 80, height: 80, borderRadius: "50%", padding: 0,
                  background: avatarUrl ? "transparent" : `linear-gradient(135deg, ${theme.accent}dd, ${theme.accent}77)`,
                  border: `2.5px solid ${bdr}`,
                  cursor: "pointer", overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 30, color: "#fff", fontWeight: 700,
                  boxShadow: `0 4px 20px ${theme.accent}44`,
                }}
              >
                {avatarUrl
                  ? <img src={avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                  : initial
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
              <div style={{ textAlign: "center" }}>
                <button
                  onClick={() => setEditingName(true)}
                  title="Click to edit name"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 6 }}
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
                background: inp, border: `1px solid ${bdr}`,
              }}>
                <span style={{ fontSize: 12, color: muted }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: text }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            style={{
              width: "100%", padding: "9px 0", borderRadius: 9,
              background: "transparent", border: `1px solid ${bdr}`,
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
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.borderColor = bdr;
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Search bar */}
          <div style={{ padding: "24px 24px 14px", flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 12 }}>
              All notes <span style={{ fontWeight: 400, fontSize: 12, color: muted, marginLeft: 4 }}>{notes.length}</span>
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
                    borderRadius: 10, background: inp,
                    border: `1px solid ${bdr}`,
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
                  background: badgeFilter ? `${theme.accent}22` : inp,
                  border: `1px solid ${badgeFilter ? theme.accent : bdr}`,
                  color: text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 3h11L9 7.6v3.2l-3 1.4V7.6L2 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
            {filterOpen && (
              <div style={{ marginTop: 8, padding: 9, borderRadius: 10, background: inp, border: `1px solid ${bdr}` }}>
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
                {search || badgeFilter ? "No notes match" : "No notes yet - click + to create one"}
              </div>
            ) : sorted.map((n) => {
              const noteColor = theme.noteColors[n.color] ?? "#ccc";
              return (
                <div
                  key={n.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "9px 12px", borderRadius: 10, marginBottom: 3,
                    background: "transparent", cursor: "pointer",
                    transition: "background 100ms",
                    border: `1px solid transparent`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = glass2;
                    (e.currentTarget as HTMLElement).style.borderColor = bdr;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.borderColor = "transparent";
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
                      {n.title || <span style={{ opacity: 0.3 }}>Untitled</span>}
                    </div>
                    {n.body && (
                      <div style={{ fontSize: 12, color: muted, marginTop: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {n.body}
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
