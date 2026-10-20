"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useShallow } from "zustand/react/shallow";
import { useNotesStore } from "@/store/notes";
import { useAllBadges, isCustomBadge, type BadgeDef } from "@/lib/badges";
import { THEMES, THEME_ORDER } from "@/lib/themes";
import { addCustomBadge, chooseDockSide, chooseTheme, deleteCustomBadge } from "@/lib/preferences";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePhotoAdd } from "@/hooks/usePhotoAdd";
import { useDockMorph } from "@/hooks/useDockMorph";
import ProfileModal from "./ProfileModal";
import { ConfirmDialog } from "./ui/Modal";
import {
  ArrowLinkIcon, CloseIcon, CollapseIcon, DockBottomIcon, DockLeftIcon, DotsGridIcon, EraserIcon, FilterIcon,
  FolderPlusIcon, ImageIcon, PenIcon, PlusIcon, RopeIcon, SearchIcon, StarIcon, UserIcon,
} from "./ui/icons";

type Panel = "theme" | "filter" | "pen" | "badges";

const PEN_COLORS = ["#7c8fd8", "#e58aa9", "#76bfa6", "#f0bd6a", "#b997dc", "#5fb8c9", "#e0665a", "#3b3b46"];
const NARROW_QUERY = "(max-width: 720px)";

function useIsNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(NARROW_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
}

export default function Dock() {
  const s = useNotesStore(useShallow((st) => ({
    open: st.sidebarOpen, side: st.dockSide, theme: st.theme, badgeMode: st.badgeMode, badgeFilter: st.badgeFilter,
    drawing: st.drawingMode, erasing: st.eraserMode, rope: st.ropeMode, arrow: st.arrowMode, dotEffect: st.dotGridEffect,
  })));
  const store = useNotesStore.getState();
  const narrow = useIsNarrow();
  const side = narrow ? "bottom" : s.side;
  const [panel, setPanel] = useState<Panel | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [badgeToDelete, setBadgeToDelete] = useState<BadgeDef | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const badgeFileRef = useRef<HTMLInputElement>(null);
  const { user, loading, signInWithGoogle } = useAuth();
  const { username, avatarUrl } = useProfile();
  const { handlePhotoUpload } = usePhotoAdd();
  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const { navRef, wrapRef, collapse, expand, move } = useDockMorph(side);

  // Close the open panel on any press outside the toolbar.
  useEffect(() => {
    if (!panel) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setPanel(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [panel, wrapRef]);

  if (!s.open) {
    return (
      <div ref={wrapRef} className="dock-wrap" data-side={side}>
        <nav ref={navRef} className="dock dock--compact surface" aria-label="Toolbar">
          <DockButton label="Show toolbar" onClick={() => void expand(() => store.setSidebarOpen(true))}><CollapseIcon size={20} /></DockButton>
        </nav>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="dock-wrap" data-side={side}>
      <nav ref={navRef} className="dock surface" aria-label="Toolbar">
        <DockButton label="Hide toolbar" onClick={() => { setPanel(null); void collapse(() => store.setSidebarOpen(false)); }}><CollapseIcon /></DockButton>
        {!narrow && (
          <DockButton label={side === "left" ? "Move toolbar to the bottom" : "Move toolbar to the left"} onClick={() => { setPanel(null); void move(() => chooseDockSide(side === "left" ? "bottom" : "left")); }}>
            {side === "left" ? <DockBottomIcon /> : <DockLeftIcon />}
          </DockButton>
        )}
        <span className="divider divider--v" />
        <DockButton label="Search (Ctrl+Shift+P)" onClick={() => { setPanel(null); store.setUniversalSearchOpen(true); }}><SearchIcon /></DockButton>
        <DockButton label="Filter by badge" active={!!s.badgeFilter || panel === "filter"} onClick={() => togglePanel("filter")}><FilterIcon /></DockButton>
        <DockButton label={`Theme: ${THEMES[s.theme].label}`} active={panel === "theme"} onClick={() => togglePanel("theme")}>
          <span style={{ width: 20, height: 20, borderRadius: 6, background: THEMES[s.theme].canvasBg, boxShadow: "inset 0 0 0 1.5px var(--divider)" }} />
        </DockButton>
        <span className="divider divider--v" />
        <DockButton label="New folder (selected items go inside)" onClick={() => store.addFolder()}><FolderPlusIcon /></DockButton>
        <DockButton label="Add image" onClick={() => photoRef.current?.click()}><ImageIcon /></DockButton>
        <span className="divider divider--v" />
        <DockButton label={s.drawing ? "Stop drawing" : "Pen"} active={s.drawing} onClick={() => {
          store.setDrawingMode(!s.drawing);
          setPanel(s.drawing ? null : "pen");
        }}><PenIcon /></DockButton>
        <DockButton label={s.erasing ? "Stop erasing" : "Eraser"} active={s.erasing} onClick={() => { setPanel(null); store.setEraserMode(!s.erasing); }}><EraserIcon /></DockButton>
        <DockButton label={s.rope ? "Stop connecting" : "Rope: tie two notes together"} active={s.rope} onClick={() => { setPanel(null); store.setRopeMode(!s.rope); }}><RopeIcon /></DockButton>
        <DockButton label={s.arrow ? "Stop drawing arrows" : "Arrow: point one note at another"} active={s.arrow} onClick={() => { setPanel(null); store.setArrowMode(!s.arrow); }}><ArrowLinkIcon /></DockButton>
        <DockButton label="Badges" active={panel === "badges" || !!s.badgeMode} onClick={() => togglePanel("badges")}><StarIcon /></DockButton>
        <span className="divider divider--v" />
        <DockButton label={s.dotEffect ? "Turn off dot ripple" : "Turn on dot ripple"} onClick={() => store.setDotGridEffect(!s.dotEffect)}>
          <DotsGridIcon active={s.dotEffect} />
        </DockButton>
        <span className="divider divider--v" />
        {user ? (
          <button className="icon-btn" onClick={() => { setPanel(null); setShowProfile(true); }} title="Your profile" aria-label="Your profile">
            <span className="avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {avatarUrl ? <img src={avatarUrl} alt="" /> : (username?.[0] ?? user.email?.[0] ?? "?").toUpperCase()}
            </span>
          </button>
        ) : (
          <DockButton label="Sign in with Google to sync" disabled={loading} onClick={() => void signInWithGoogle()}><UserIcon /></DockButton>
        )}
      </nav>

      {panel && (
        <div className="dock-panel surface scroll-y" aria-label={panel}>
          {panel === "theme" && <ThemePanel current={s.theme} />}
          {panel === "pen" && <PenPanel />}
          {panel === "filter" && <FilterPanel onDelete={setBadgeToDelete} />}
          {panel === "badges" && <BadgePanel onUpload={() => badgeFileRef.current?.click()} onDelete={setBadgeToDelete} />}
        </div>
      )}

      <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => {
        const file = e.target.files?.[0];
        e.currentTarget.value = "";
        if (file) void handlePhotoUpload(file);
      }} />
      <input ref={badgeFileRef} type="file" accept="image/*" hidden onChange={(e) => {
        const file = e.target.files?.[0];
        e.currentTarget.value = "";
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => addCustomBadge({ id: `custom_${Date.now()}`, label: file.name.replace(/\.[^.]+$/, ""), url: String(reader.result) });
        reader.readAsDataURL(file);
      }} />

      {showProfile && user && <ProfileModal user={user} onClose={() => setShowProfile(false)} />}
      {badgeToDelete && <DeleteBadgeDialog badge={badgeToDelete} onClose={() => setBadgeToDelete(null)} />}
    </div>
  );
}

function DockButton({ label, onClick, active, disabled, children }: {
  label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button className="icon-btn" data-active={active || undefined} aria-pressed={active} disabled={disabled} onClick={onClick} title={label} aria-label={label}>
      {children}
    </button>
  );
}

function ThemePanel({ current }: { current: string }) {
  return (
    <>
      <p className="section-title">Theme</p>
      <div className="swatch-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {THEME_ORDER.map((name) => {
          const cfg = THEMES[name];
          return (
            <button key={name} className="swatch" data-active={current === name} onClick={() => chooseTheme(name)} title={cfg.label} aria-label={cfg.label}
              style={{ background: cfg.canvasBg, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
              {Object.values(cfg.noteColors).slice(0, 3).map((c, i) => (
                <span key={i} style={{ width: 12, height: 10, borderRadius: 2, background: c, rotate: `${(i - 1) * 6}deg` }} />
              ))}
            </button>
          );
        })}
      </div>
      <p className="muted" style={{ textAlign: "center", fontSize: 12, margin: "10px 0 0" }}>{THEMES[current as keyof typeof THEMES].label}</p>
    </>
  );
}

function PenPanel() {
  const color = useNotesStore((s) => s.strokeColor);
  return (
    <>
      <p className="section-title">Pen colour</p>
      <div className="swatch-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {PEN_COLORS.map((c) => (
          <button key={c} className="swatch" data-active={color === c} title={c} aria-label={`Pen colour ${c}`} style={{ background: c }}
            onClick={() => { const s = useNotesStore.getState(); s.setStrokeColor(c); if (!s.drawingMode) s.setDrawingMode(true); }} />
        ))}
      </div>
    </>
  );
}

function BadgePanel({ onUpload, onDelete }: { onUpload: () => void; onDelete: (b: BadgeDef) => void }) {
  const badges = useAllBadges();
  const badgeMode = useNotesStore((s) => s.badgeMode);
  return (
    <>
      <p className="section-title">{badgeMode ? "Now click a note" : "Pick a badge, then click a note"}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {badges.map((badge) => (
          <div key={badge.id} style={{ position: "relative" }}>
            <button
              className="icon-btn"
              data-active={badgeMode === badge.id || undefined}
              style={{ width: 46, height: 46, border: "1px solid var(--border)" }}
              onClick={() => useNotesStore.getState().setBadgeMode(badgeMode === badge.id ? null : badge.id)}
              onContextMenu={(e) => { if (isCustomBadge(badge)) { e.preventDefault(); onDelete(badge); } }}
              title={badge.label}
              aria-label={`Place ${badge.label}`}
            >
              <badge.Icon size={30} />
            </button>
            {isCustomBadge(badge) && <RemoveBadgeButton badge={badge} onDelete={onDelete} />}
          </div>
        ))}
        <button className="icon-btn icon-btn--muted" style={{ width: 46, height: 46, border: "1.5px dashed var(--border)" }} onClick={onUpload} title="Upload your own badge" aria-label="Upload your own badge">
          <PlusIcon size={18} />
        </button>
      </div>
    </>
  );
}

function FilterPanel({ onDelete }: { onDelete: (b: BadgeDef) => void }) {
  const badges = useAllBadges();
  const badgeFilter = useNotesStore((s) => s.badgeFilter);
  const counts = useNotesStore(useShallow((s) => badges.map((b) => s.notes.reduce((n, item) => n + (item.parentId === s.activeFolderId && item.badges.includes(b.id) ? 1 : 0), 0))));
  const setFilter = (id: string | null) => useNotesStore.getState().setBadgeFilter(id);
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p className="section-title">Show only notes with</p>
        {badgeFilter && <button className="btn" style={{ height: 26, padding: "0 8px", fontSize: 12 }} onClick={() => setFilter(null)}>Clear</button>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {badges.map((badge, i) => (
          <div key={badge.id} style={{ position: "relative" }}>
            <button
              className="icon-btn"
              data-active={badgeFilter === badge.id || undefined}
              style={{ width: 46, height: 46, opacity: badgeFilter && badgeFilter !== badge.id ? 0.35 : 1 }}
              onClick={() => setFilter(badgeFilter === badge.id ? null : badge.id)}
              title={`${badge.label} (${counts[i]})`}
              aria-label={`${badge.label}, ${counts[i]} items`}
            >
              <badge.Icon size={30} />
            </button>
            {isCustomBadge(badge) && <RemoveBadgeButton badge={badge} onDelete={onDelete} />}
          </div>
        ))}
      </div>
    </>
  );
}

function RemoveBadgeButton({ badge, onDelete }: { badge: BadgeDef; onDelete: (b: BadgeDef) => void }) {
  return (
    <button
      onClick={() => onDelete(badge)}
      title={`Delete ${badge.label}`}
      aria-label={`Delete ${badge.label}`}
      style={{ position: "absolute", top: -5, right: -5, width: 18, height: 18, padding: 0, display: "grid", placeItems: "center", border: "none", borderRadius: "50%", background: "var(--text-ui)", color: "var(--surface)" }}
    >
      <CloseIcon size={11} strokeWidth={2.4} />
    </button>
  );
}

function DeleteBadgeDialog({ badge, onClose }: { badge: BadgeDef; onClose: () => void }) {
  const count = useNotesStore((s) => s.notes.filter((n) => n.badges.includes(badge.id)).length);
  return (
    <ConfirmDialog
      title="Delete badge?"
      message={count > 0
        ? `“${badge.label}” is on ${count} item${count === 1 ? "" : "s"}. Deleting it removes the badge only; the items stay.`
        : `“${badge.label}” isn't on any items.`}
      confirmLabel="Delete badge"
      danger
      onConfirm={() => { deleteCustomBadge(badge.id); onClose(); }}
      onCancel={onClose}
    />
  );
}
