"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNotesStore } from "@/store/notes";
import { DEFAULT_BADGES } from "@/lib/badges";
import { useTheme } from "@/hooks/useTheme";
import { THEMES, type ThemeName } from "@/lib/themes";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNoteSync } from "@/hooks/useNoteSync";
import ProfileModal from "./ProfileModal";
import type { BadgeDef } from "@/lib/badges";
import { NOTE_COLOR_KEYS, type NoteColor } from "@/lib/colors";
import { useHudScale } from "@/hooks/useHudScale";

const DOCK_KEY = "nxtaker_dock_position";
const COFFEE_KEY = "nxtaker_coffee_visible";
const GUEST_BADGES_KEY = "nxtaker_custom_badges";
const PHOTOS_BUCKET_DISABLED_KEY = "nxtaker_photos_bucket_disabled";
const DOCK_W = 768;
const DOCK_H = 70;
const MINI = 52;
const HUD_BOTTOM = 32;
const CREATE_BUTTON_SIZE = 52;
const HUD_GAP = 14;

export default function Sidebar() {
  const {
    notes, setPan,
    sidebarOpen, setSidebarOpen,
    theme: themeName, setTheme,
    badgeMode, setBadgeMode,
    customBadges, addCustomBadge, deleteCustomBadge, setCustomBadges,
    badgeFilter, setBadgeFilter,
    noteSearch, setNoteSearch,
    coffeeVisible, setCoffeeVisible,
    bringToFront, setHighlightedNoteId,
    addFolder, addPhoto, activeFolderId, setActiveFolderId,
  } = useNotesStore();
  const customBadgeRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const customBadgesReady = useRef(false);
  const currentTheme = useTheme();
  const isDark = currentTheme.isDark;
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const { profile } = useProfile(user);
  const { showMergePrompt, cachedCount, mergeLocalToCloud, discardLocal, dbError } = useNoteSync(user, loading);
  const [showProfile, setShowProfile] = useState(false);
  const [panel, setPanel] = useState<"theme" | "search" | "filter" | null>(null);
  const [deleteBadge, setDeleteBadge] = useState<{ id: string; label: string; count: number } | null>(null);
  const hudScale = useHudScale();

  const width = sidebarOpen ? DOCK_W : MINI;
  const height = sidebarOpen ? DOCK_H : MINI;

  const allBadges = useMemo<BadgeDef[]>(() => [
    ...DEFAULT_BADGES,
    ...customBadges.map(cb => ({
      id: cb.id, label: cb.label, color: "#888", ring: "#666",
      Icon: ({ size = 28 }: { size?: number }) => (
        <img src={cb.url} alt={cb.label} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />
      ),
    })),
  ], [customBadges]);

  const visibleList = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    return notes
      .filter((note) => note.parentId === activeFolderId)
      .filter((note) => !badgeFilter || note.badges.includes(badgeFilter))
      .filter((note) => {
        const label = itemLabel(note).toLowerCase();
        return !q || label.includes(q) || note.body.toLowerCase().includes(q) || (note.caption ?? "").toLowerCase().includes(q);
      })
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [activeFolderId, badgeFilter, noteSearch, notes]);

  useEffect(() => {
    try {
      localStorage.removeItem(DOCK_KEY);
      const coffee = localStorage.getItem(COFFEE_KEY);
      if (coffee !== null) setCoffeeVisible(coffee === "true");
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { localStorage.setItem(COFFEE_KEY, String(coffeeVisible)); } catch {}
  }, [coffeeVisible]);

  useEffect(() => {
    customBadgesReady.current = false;
    if (!user) {
      try {
        const saved = localStorage.getItem(GUEST_BADGES_KEY);
        setCustomBadges(saved ? JSON.parse(saved) : []);
      } catch {
        setCustomBadges([]);
      }
      customBadgesReady.current = true;
      return;
    }
    const sb = createClient();
    sb.from("profiles").select("custom_badges").eq("id", user.id).single().then(({ data, error }) => {
      if (error) {
        console.warn("[Dock] custom_badges load:", error.message);
        customBadgesReady.current = true;
        return;
      }
      if (Array.isArray(data?.custom_badges)) setCustomBadges(data.custom_badges);
      customBadgesReady.current = true;
    });
  }, [setCustomBadges, user]);

  useEffect(() => {
    if (!customBadgesReady.current) return;
    if (!user) {
      try { localStorage.setItem(GUEST_BADGES_KEY, JSON.stringify(customBadges)); } catch {}
      return;
    }
    const sb = createClient();
    sb.from("profiles").upsert({ id: user.id, custom_badges: customBadges }, { onConflict: "id" }).then(({ error }) => {
      if (error) console.warn("[Dock] custom_badges save:", error.message);
    });
  }, [customBadges, user]);

  const collapseDock = () => {
    setSidebarOpen(false);
    setPanel(null);
  };

  const navigateToNote = (note: typeof notes[number]) => {
    const G = 80;
    setActiveFolderId(note.parentId ?? null);
    setPan(window.innerWidth / 2 - (note.x * G + note.w * G / 2), window.innerHeight / 2 - (note.y * G + note.h * G / 2));
    bringToFront(note.id);
    setHighlightedNoteId(note.id);
    setPanel(null);
  };

  const handlePhotoUpload = async (file: File) => {
    const resized = await resizeImageFile(file);
    let url = resized.dataUrl;
    let path: string | null = null;
    if (user && localStorage.getItem(PHOTOS_BUCKET_DISABLED_KEY) !== "1") {
      const sb = createClient();
      path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from("photos").upload(path, resized.blob, { upsert: true, contentType: "image/jpeg" });
      if (!error) {
        const { data } = sb.storage.from("photos").getPublicUrl(path);
        url = data.publicUrl;
      } else {
        if (error.message.toLowerCase().includes("bucket not found")) {
          localStorage.setItem(PHOTOS_BUCKET_DISABLED_KEY, "1");
        } else {
          console.warn("[Dock] photo upload:", error.message);
        }
        path = null;
      }
    }
    addPhoto(url, path, file.name.replace(/\.[^.]+$/, ""), resized.width, resized.height);
  };

  const createCustomBadge = (file: File, url: string) => {
    addCustomBadge({ id: `custom_${Date.now()}`, label: file.name.replace(/\.[^.]+$/, ""), url });
  };

  const requestDeleteBadge = (badge: BadgeDef) => {
    if (!badge.id.startsWith("custom_")) return;
    const count = notes.filter((note) => note.badges.includes(badge.id)).length;
    setDeleteBadge({ id: badge.id, label: badge.label, count });
  };

  const confirmDeleteBadge = () => {
    if (!deleteBadge) return;
    deleteCustomBadge(deleteBadge.id);
    setDeleteBadge(null);
  };

  const glass = currentTheme.sidebarBg;
  const border = currentTheme.sidebarBorder;

  return (
    <>
      <div
        onClick={() => {
          if (!sidebarOpen) {
            setSidebarOpen(true);
          }
        }}
        style={{
          position: "fixed",
          left: sidebarOpen ? "50%" : "auto",
          right: sidebarOpen ? "auto" : HUD_BOTTOM + CREATE_BUTTON_SIZE + HUD_GAP,
          bottom: HUD_BOTTOM,
          width,
          height,
          borderRadius: sidebarOpen ? 18 : 16,
          background: glass,
          border: `1.5px solid ${border}`,
          boxShadow: isDark ? "0 8px 40px rgba(0,0,0,0.5)" : "0 8px 40px rgba(0,0,0,0.12)",
          zIndex: 505,
          display: "flex",
          alignItems: "center",
          justifyContent: sidebarOpen ? "flex-start" : "center",
          gap: 8,
          padding: sidebarOpen ? "9px 12px" : 0,
          cursor: sidebarOpen ? "default" : "pointer",
          transform: sidebarOpen ? `translateX(-50%) scale(${hudScale})` : `scale(${hudScale})`,
          transformOrigin: sidebarOpen ? "bottom center" : "bottom right",
          transition: "width 300ms cubic-bezier(0.18,1.35,0.28,1), height 300ms cubic-bezier(0.18,1.35,0.28,1), border-radius 300ms cubic-bezier(0.18,1.35,0.28,1), transform 180ms ease",
          overflow: "hidden",
        }}
        title={sidebarOpen ? "Dock" : "Open dock"}
      >
        {!sidebarOpen ? (
          <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "var(--text-ui)" }}>
            <DockIcon />
          </div>
        ) : (
          <>
            <DockButton onClick={collapseDock} title="Compact dock">
              <DockCollapseIcon />
            </DockButton>
            <div style={{ width: 1, height: 34, background: border, margin: "0 2px" }} />
            <DockButton onClick={() => setPanel(panel === "theme" ? null : "theme")} title={`Theme: ${THEMES[themeName].label}`}>
              <ThemeSwatch current={themeName} />
            </DockButton>
            <DockButton onClick={() => setPanel(panel === "search" ? null : "search")} title="Search notes">
              <SearchIcon />
            </DockButton>
            <DockButton active={!!badgeFilter || panel === "filter"} onClick={() => setPanel(panel === "filter" ? null : "filter")} title="Filter notes">
              <FilterIcon />
            </DockButton>
            <DockButton onClick={() => addFolder()} title="Create folder">
              <FolderDockIcon />
            </DockButton>
            <DockButton onClick={() => photoRef.current?.click()} title="Add photo">
              <ImageDockIcon />
            </DockButton>
            <div style={{
              display: "flex",
              gap: 6,
              flex: "1 1 auto",
              minWidth: 210,
              overflowX: "auto",
              overflowY: "hidden",
              alignItems: "center",
              padding: "0 1px",
              scrollbarWidth: "none",
            }} className="dock-badge-strip">
              {allBadges.map((badge) => {
                const active = badgeMode === badge.id;
                const { Icon } = badge;
                const isCustom = badge.id.startsWith("custom_");
                return (
                  <button
                    key={badge.id}
                    onPointerDown={(e) => e.stopPropagation()}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      requestDeleteBadge(badge);
                    }}
                    onClick={() => setBadgeMode(active ? null : badge.id)}
                    title={isCustom ? `${active ? "Cancel" : "Place"} ${badge.label} badge. Right-click to delete.` : active ? `Cancel ${badge.label} mode` : `Place ${badge.label} badge`}
                    style={{
                      width: 38, height: 38, borderRadius: 11, padding: 4,
                      background: active ? `${badge.color}22` : "transparent",
                      border: `1.5px solid ${active ? badge.color : "transparent"}`,
                      boxShadow: active ? `0 0 0 2px ${badge.color}33` : "none",
                      cursor: "pointer", flex: "0 0 auto",
                    }}
                  >
                    <Icon size={28} />
                  </button>
                );
              })}
              <DockButton onClick={() => customBadgeRef.current?.click()} title="Upload badge" compact>
                <PlusTiny />
              </DockButton>
            </div>
            <div style={{ width: 1, height: 34, background: border, margin: "0 2px 0 0", flexShrink: 0 }} />
            {user ? (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setShowProfile(true)}
                title="Profile"
                style={{
                  width: 42, height: 42, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: profile?.avatar_url ? "transparent" : "var(--accent)",
                  color: "#fff", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, fontWeight: 700, marginLeft: 0, flexShrink: 0,
                }}
              >
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (profile?.username?.[0] ?? user.email?.[0] ?? "?").toUpperCase()}
              </button>
            ) : (
              <DockButton onClick={loading ? () => {} : signInWithGoogle} title="Sign in with Google" disabled={loading}>
                <GoogleIcon />
              </DockButton>
            )}
          </>
        )}
      </div>

      {panel && sidebarOpen && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: "50%",
            bottom: HUD_BOTTOM + DOCK_H + 10,
            transform: "translateX(-50%)",
            width: panel === "search" ? 310 : 230,
            maxHeight: "min(390px, calc(100vh - 116px))",
            overflow: "auto",
            padding: 10,
            borderRadius: 14,
            background: glass,
            border: `1px solid ${border}`,
            boxShadow: isDark ? "0 14px 50px rgba(0,0,0,0.5)" : "0 14px 40px rgba(0,0,0,0.13)",
            zIndex: 506,
          }}
        >
          {panel === "theme" && <ThemePanel current={themeName} onChange={(t) => { setTheme(t); setPanel(null); }} />}
          {panel === "filter" && (
            <FilterPanel
              allBadges={allBadges}
              noteBadgeCounts={new Map(allBadges.map((badge) => [badge.id, notes.filter((note) => note.parentId === activeFolderId && note.badges.includes(badge.id)).length]))}
              badgeFilter={badgeFilter}
              setBadgeFilter={setBadgeFilter}
              onDeleteBadge={requestDeleteBadge}
            />
          )}
          {panel === "search" && (
            <SearchPanel
              isDark={isDark}
              currentTheme={currentTheme}
              noteSearch={noteSearch}
              setNoteSearch={setNoteSearch}
              visibleList={visibleList}
              navigateToNote={navigateToNote}
            />
          )}
        </div>
      )}

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
            createCustomBadge(file, url);
          };
          reader.readAsDataURL(file);
        }}
      />
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (!file) return;
          void handlePhotoUpload(file);
        }}
      />

      {showProfile && user && createPortal(
        <ProfileModal user={user} onClose={() => setShowProfile(false)} />,
        document.body
      )}

      {showMergePrompt && createPortal(
        <MergePrompt
          count={cachedCount}
          onSave={mergeLocalToCloud}
          onDiscard={discardLocal}
        />,
        document.body
      )}

      {dbError && createPortal(<DbToast message={dbError} />, document.body)}
      {deleteBadge && createPortal(
        <DeleteBadgeConfirm
          label={deleteBadge.label}
          count={deleteBadge.count}
          bg={currentTheme.noteColors.lavender}
          text={currentTheme.noteText}
          isDark={isDark}
          onCancel={() => setDeleteBadge(null)}
          onConfirm={confirmDeleteBadge}
        />,
        document.body
      )}
      {user && !showProfile && createPortal(
        <button
          onClick={signOut}
          title="Sign out"
          style={{ position: "fixed", left: -9999, top: -9999 }}
        />,
        document.body
      )}

      <style>{`
        .dock-badge-strip::-webkit-scrollbar {
          display: none;
        }
        @keyframes dockJiggleA {
          0% { opacity: 0.94; }
          100% { opacity: 1; }
        }
        @keyframes dockJiggleB {
          0% { opacity: 0.94; }
          100% { opacity: 1; }
        }
      `}</style>
    </>
  );
}

function ThemePanel({ current, onChange }: { current: ThemeName; onChange: (t: ThemeName) => void }) {
  const order: ThemeName[] = ["paper", "cork", "slate", "midnight", "forest", "dusk"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
      {order.map((name) => {
        const cfg = THEMES[name];
        const active = current === name;
        return (
          <button key={name} onClick={() => onChange(name)} title={cfg.label}
            style={{
              aspectRatio: "1", borderRadius: 9, border: active ? "2px solid var(--text-ui)" : "2px solid transparent",
              background: cfg.canvasBg, cursor: "pointer", padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 2,
            }}
          >
            {Object.values(cfg.noteColors).slice(0, 3).map((c, i) => (
              <span key={i} style={{ width: 13, height: 10, borderRadius: 2, background: c, transform: `rotate(${(i - 1) * 5}deg)` }} />
            ))}
          </button>
        );
      })}
      <div style={{ gridColumn: "1/-1", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
        {THEMES[current].label}
      </div>
    </div>
  );
}

function FilterPanel({ allBadges, noteBadgeCounts, badgeFilter, setBadgeFilter, onDeleteBadge }: {
  allBadges: BadgeDef[];
  noteBadgeCounts: Map<string, number>;
  badgeFilter: string | null;
  setBadgeFilter: (id: string | null) => void;
  onDeleteBadge: (badge: BadgeDef) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-ui)" }}>Filter by badge</span>
        {badgeFilter && <button onClick={() => setBadgeFilter(null)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 11 }}>Clear</button>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {allBadges.map((badge) => {
          const active = badgeFilter === badge.id;
          const { Icon } = badge;
          const isCustom = badge.id.startsWith("custom_");
          const usedCount = noteBadgeCounts.get(badge.id) ?? 0;
          return (
            <div key={badge.id} style={{ position: "relative", width: 38, height: 38 }}>
              <button title={`${badge.label}${usedCount ? ` - ${usedCount} note${usedCount === 1 ? "" : "s"}` : ""}`} onClick={() => setBadgeFilter(active ? null : badge.id)}
              style={{
                width: 38, height: 38, borderRadius: 10, padding: 4,
                background: active ? `${badge.color}22` : "transparent",
                border: `1.5px solid ${active ? badge.color : "transparent"}`,
                opacity: badgeFilter && !active ? 0.28 : 1, cursor: "pointer",
              }}
            >
                <Icon size={28} />
              </button>
              {isCustom && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteBadge(badge);
                  }}
                  title={`Delete ${badge.label}`}
                  style={{
                    position: "absolute",
                    top: -5,
                    right: -5,
                    width: 17,
                    height: 17,
                    borderRadius: "50%",
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: "rgba(20,20,25,0.9)",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 11,
                    lineHeight: "15px",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.22)",
                  }}
                >
                  x
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SearchPanel({ isDark, currentTheme, noteSearch, setNoteSearch, visibleList, navigateToNote }: {
  isDark: boolean;
  currentTheme: ReturnType<typeof useTheme>;
  noteSearch: string;
  setNoteSearch: (q: string) => void;
  visibleList: ReturnType<typeof useNotesStore.getState>["notes"];
  navigateToNote: (note: ReturnType<typeof useNotesStore.getState>["notes"][number]) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ position: "relative" }}>
        <SearchIcon style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.45, pointerEvents: "none" }} />
        <input
          value={noteSearch}
          onChange={(e) => setNoteSearch(e.target.value)}
          placeholder="Search notes"
          autoFocus
          style={{
            width: "100%", height: 34, padding: "0 10px 0 32px",
            borderRadius: 10, border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
            background: isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.045)",
            color: "var(--text-ui)", outline: "none", fontSize: 13, fontFamily: "inherit",
          }}
        />
      </div>
      {(noteSearch ? visibleList : visibleList.slice(0, 8)).length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "9px 2px" }}>No matching notes</div>
      ) : (noteSearch ? visibleList : visibleList.slice(0, 8)).map((note) => (
        <button
          key={note.id}
          onClick={() => navigateToNote(note)}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8,
            padding: "7px 8px", borderRadius: 9, background: "transparent", border: "none",
            color: "var(--text-ui)", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--btn-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <span style={{ width: 18, height: 18, borderRadius: note.type === "folder" ? 6 : 5, background: note.type === "photo" ? "#fff" : currentTheme.noteColors[note.color], border: note.type === "photo" ? "3px solid #fff" : "none", flexShrink: 0, boxShadow: note.type === "photo" ? "0 1px 4px rgba(0,0,0,0.18)" : "none" }} />
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>
            {itemLabel(note)}
          </span>
        </button>
      ))}
    </div>
  );
}

function DockButton({ children, onClick, title, active = false, disabled = false, compact = false }: {
  children: React.ReactNode; onClick: () => void; title: string; active?: boolean; disabled?: boolean; compact?: boolean;
}) {
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: compact ? 38 : 42,
        height: compact ? 38 : 42,
        borderRadius: compact ? 11 : 13,
        border: `1px solid ${active ? "var(--accent)" : "transparent"}`,
        background: active ? "rgba(92,107,192,0.18)" : "transparent", color: "var(--text-ui)",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
      onMouseEnter={(e) => { if (!disabled && !active) e.currentTarget.style.background = "var(--btn-hover)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

function ThemeSwatch({ current }: { current: ThemeName }) {
  return <span style={{ width: 24, height: 24, borderRadius: 8, background: THEMES[current].canvasBg, border: "1px solid rgba(128,128,128,0.35)" }} />;
}

function MergePrompt({ count, onSave, onDiscard }: { count: number; onSave: () => void; onDiscard: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#1e1e2a", borderRadius: 16, padding: "28px 32px", width: 360, border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
        <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 15, color: "#eee" }}>You have {count} unsaved {count === 1 ? "note" : "notes"}</p>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#888" }}>These notes were created before you signed in. Save them to your account?</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onDiscard} style={{ padding: "8px 16px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#ccc", cursor: "pointer", fontSize: 13 }}>Discard</button>
          <button onClick={onSave} style={{ padding: "8px 18px", borderRadius: 8, background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Save to account</button>
        </div>
      </div>
    </div>
  );
}

function DbToast({ message }: { message: string }) {
  return <div style={{ position: "fixed", left: 16, bottom: 16, zIndex: 520, maxWidth: 360, padding: "9px 12px", borderRadius: 10, background: "rgba(220,50,50,0.12)", border: "1px solid rgba(220,50,50,0.25)", color: "#e05050", fontSize: 12 }}>{message}</div>;
}

function DeleteBadgeConfirm({ label, count, bg, text, isDark, onCancel, onConfirm }: {
  label: string;
  count: number;
  bg: string;
  text: string;
  isDark: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [colorKey] = useState<NoteColor>(() => NOTE_COLOR_KEYS[Math.floor(Math.random() * NOTE_COLOR_KEYS.length)]);
  const theme = useTheme();
  const noteBg = theme.noteColors[colorKey] ?? bg;
  const line = isDark ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.10)";
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 700,
        background: isDark ? "rgba(0,0,0,0.56)" : "rgba(20,18,24,0.36)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(390px, 92vw)",
          position: "relative",
          borderRadius: 15,
          padding: "34px 28px 24px",
          background: noteBg,
          color: text,
          transform: "rotate(1.1deg)",
          boxShadow: isDark ? "0 24px 70px rgba(0,0,0,0.6)" : "0 24px 70px rgba(0,0,0,0.22)",
          backgroundImage: `repeating-linear-gradient(transparent, transparent 23px, ${line} 23px, ${line} 24.5px)`,
          backgroundSize: "100% 24.5px",
          animation: "dockJiggleA 260ms cubic-bezier(0.2,1.2,0.35,1)",
        }}
      >
        <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", width: 54, height: 20, background: isDark ? "rgba(255,250,200,0.24)" : "rgba(255,253,200,0.66)", borderRadius: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }} />
        <div style={{ fontSize: 18, fontWeight: 850, marginBottom: 8 }}>Delete badge?</div>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: text, opacity: 0.74, marginBottom: 22 }}>
          Delete <strong style={{ color: text, opacity: 1 }}>{label}</strong>? {count > 0
            ? `${count} note${count === 1 ? "" : "s"} currently use this badge. Deleting it will remove only the badge from those notes; the notes will stay.`
            : "No notes currently use this badge."}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 9,
              border: `1px solid ${text}22`,
              background: "rgba(255,255,255,0.24)",
              color: text,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              height: 34,
              padding: "0 15px",
              borderRadius: 9,
              border: "none",
              background: "rgba(210,55,55,0.88)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              fontFamily: "inherit",
            }}
          >
            Delete badge
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchIcon({ style }: { style?: React.CSSProperties }) { return <svg style={style} width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="7.4" cy="7.4" r="5.1" stroke="currentColor" strokeWidth="1.7"/><line x1="11.2" y1="11.2" x2="15.4" y2="15.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>; }
function FilterIcon() { return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 4h12l-4.4 5.1v3.8L7.4 14.4V9.1L3 4Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function FolderDockIcon() { return <svg width="19" height="19" viewBox="0 0 19 19" fill="none"><path d="M2.8 6h5l1.4-1.7h7v10.2a1.4 1.4 0 01-1.4 1.4h-12a1.4 1.4 0 01-1.4-1.4V7.4A1.4 1.4 0 012.8 6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M9.5 8.6v4.4M7.3 10.8h4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>; }
function ImageDockIcon() { return <svg width="19" height="19" viewBox="0 0 19 19" fill="none"><rect x="3" y="3.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M5.3 13l3.1-3.2 2.2 2.2 1.4-1.5 2.7 2.5" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12.8" cy="7" r="1.2" fill="currentColor"/></svg>; }
function DockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="8" r="2.2" fill="currentColor" opacity="0.9"/>
      <circle cx="16" cy="8" r="2.2" fill="currentColor" opacity="0.55"/>
      <circle cx="8" cy="16" r="2.2" fill="currentColor" opacity="0.55"/>
      <circle cx="16" cy="16" r="2.2" fill="currentColor" opacity="0.9"/>
    </svg>
  );
}
function DockCollapseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="4" y="5" width="12" height="10" rx="3" stroke="currentColor" strokeWidth="1.6" opacity="0.75"/>
      <path d="M8 8.5l2 1.5-2 1.5M12.2 8.5l-2 1.5 2 1.5" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function PlusTiny() { return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 4v10M4 9h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>; }
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

function itemLabel(note: ReturnType<typeof useNotesStore.getState>["notes"][number]) {
  if (note.type === "folder") return note.folderName || note.title || "Untitled Folder";
  if (note.type === "photo") return note.caption || note.body || "Untitled Photo";
  return note.title || note.body || "Untitled";
}

async function resizeImageFile(file: File): Promise<{ dataUrl: string; blob: Blob; width: number; height: number }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not resize image");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const resizedDataUrl = canvas.toDataURL("image/jpeg", 0.86);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not encode image")), "image/jpeg", 0.86);
  });
  return { dataUrl: resizedDataUrl, blob, width: canvas.width, height: canvas.height };
}
