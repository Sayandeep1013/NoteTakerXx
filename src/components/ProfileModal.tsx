"use client";

import { useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useProfile } from "@/hooks/useProfile";
import { useNotesStore } from "@/store/notes";
import { useAllBadges } from "@/lib/badges";
import { isListable, itemLabel, itemPreview, itemSnippet } from "@/lib/items";
import { noteColorVar } from "@/lib/colors";
import { signOut } from "@/lib/session";
import Modal from "./ui/Modal";
import { EditIcon, FilterIcon, LogoutIcon, SearchIcon } from "./ui/icons";

function fmtDate(iso: string | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ProfileModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { username, avatarUrl, updateUsername, uploadAvatar } = useProfile();
  const notes = useNotesStore((s) => s.notes);
  const coffeeVisible = useNotesStore((s) => s.coffeeVisible);
  const badges = useAllBadges();

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [badgeFilter, setBadgeFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => notes.filter(isListable), [notes]);
  const counts = useMemo(() => ({
    notes: items.filter((n) => n.type === "note").length,
    photos: items.filter((n) => n.type === "photo").length,
    folders: items.filter((n) => n.type === "folder").length,
  }), [items]);

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((n) => !q || itemLabel(n).toLowerCase().includes(q) || itemSnippet(n).toLowerCase().includes(q))
      .filter((n) => !badgeFilter || n.badges.includes(badgeFilter))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [items, search, badgeFilter]);

  const saveName = async () => {
    if (nameDraft === null) return;
    await updateUsername(nameDraft.trim());
    setNameDraft(null);
  };

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    setUploading(true);
    await uploadAvatar(file);
    setUploading(false);
  };

  const displayName = username || user.user_metadata?.full_name || "";
  const initial = (displayName[0] ?? user.email?.[0] ?? "?").toUpperCase();

  return (
    <Modal variant="paper" label="Your profile" onClose={onClose} closeButton className="profile">
      <aside className="profile-side">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => fileRef.current?.click()}
            title="Change photo"
            aria-label="Change profile photo"
            style={{ position: "relative", width: 88, height: 104, padding: "7px 7px 22px", borderRadius: 6, border: "none", background: "#fff", boxShadow: "var(--shadow-md)", rotate: "-2deg" }}
          >
            {avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 2 }} />
              : <span style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", borderRadius: 2, background: "var(--accent)", color: "var(--on-accent)", fontSize: 30, fontWeight: 700 }}>{initial}</span>}
            <span style={{ position: "absolute", left: 0, right: 0, bottom: 4, fontSize: 10, color: "#666", fontFamily: "var(--font-ui)" }}>{uploading ? "Uploading…" : "Change"}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />

          {nameDraft !== null ? (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                className="input"
                value={nameDraft}
                autoFocus
                aria-label="Display name"
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void saveName(); if (e.key === "Escape") { e.stopPropagation(); setNameDraft(null); } }}
                style={{ textAlign: "center", background: "var(--surface)" }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn" style={{ flex: 1, height: 32 }} onClick={() => setNameDraft(null)}>Cancel</button>
                <button className="btn btn--primary" style={{ flex: 1, height: 32 }} onClick={() => void saveName()}>Save</button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", maxWidth: "100%" }}>
              <button onClick={() => setNameDraft(displayName)} title="Edit name" style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "none", padding: "2px 6px", borderRadius: 6, fontFamily: "var(--font-hand)", fontSize: 24, color: "var(--note-text)" }}>
                {displayName || <span style={{ opacity: 0.45 }}>Add your name</span>}
                <EditIcon size={14} style={{ opacity: 0.5 }} />
              </button>
              <div style={{ fontSize: 12, opacity: 0.65, overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
            </div>
          )}
        </div>

        <div className="profile-stats" style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {[
            ["Notes", counts.notes],
            ["Photos", counts.photos],
            ["Folders", counts.folders],
            ["Member since", new Date(user.created_at ?? "").toLocaleDateString(undefined, { month: "short", year: "numeric" })],
          ].map(([label, value]) => (
            <div key={label} className="panel" style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ opacity: 0.7 }}>{label}</span>
              <strong style={{ fontWeight: 600 }}>{value}</strong>
            </div>
          ))}
          <label className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, cursor: "pointer" }}>
            <span style={{ opacity: 0.7 }}>Show coffee button</span>
            <input type="checkbox" checked={coffeeVisible} onChange={(e) => useNotesStore.getState().setCoffeeVisible(e.target.checked)} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
          </label>
        </div>

        <div style={{ flex: 1 }} />
        <button className="btn btn--block btn--danger-ghost" style={{ background: "rgba(255,255,255,0.28)" }} onClick={async () => { await signOut(); onClose(); }}>
          <LogoutIcon size={15} />Sign out
        </button>
      </aside>

      <section className="profile-main">
        <h2 className="modal-title" style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          Everything on your wall <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, opacity: 0.6 }}>{items.length}</span>
        </h2>
        <div style={{ display: "flex", gap: 8, margin: "6px 0 10px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <SearchIcon size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.5, pointerEvents: "none" }} />
            <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search your items" style={{ paddingLeft: 32, background: "var(--surface)" }} />
          </div>
          <button className="icon-btn" data-active={!!badgeFilter || filterOpen || undefined} onClick={() => setFilterOpen((v) => !v)} title="Filter by badge" aria-label="Filter by badge" style={{ width: 36, height: 36, background: "var(--surface)" }}>
            <FilterIcon size={16} />
          </button>
        </div>
        {filterOpen && (
          <div className="panel" style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {badges.map((b) => (
              <button key={b.id} className="icon-btn icon-btn--sm" data-active={badgeFilter === b.id || undefined} title={b.label} aria-label={b.label}
                style={{ opacity: badgeFilter && badgeFilter !== b.id ? 0.35 : 1 }}
                onClick={() => setBadgeFilter(badgeFilter === b.id ? null : b.id)}>
                <b.Icon size={22} />
              </button>
            ))}
            {badgeFilter && <button className="btn" style={{ height: 32, marginLeft: "auto" }} onClick={() => setBadgeFilter(null)}>Clear</button>}
          </div>
        )}

        <div className="scroll-y" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 }}>
          {sorted.length === 0 ? (
            <p style={{ textAlign: "center", marginTop: 48, opacity: 0.6, fontSize: 14 }}>
              {search || badgeFilter ? "Nothing matches." : "Nothing here yet. Add a note with the + button."}
            </p>
          ) : sorted.map((n) => (
            <button
              key={n.id}
              className="panel"
              onClick={() => { onClose(); useNotesStore.getState().focusItem(n.id); }}
              title="Show on the wall"
              style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%", fontFamily: "var(--font-ui)" }}
            >
              <span style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, background: n.type === "photo" ? "#fff" : n.type === "folder" ? "var(--accent-soft)" : noteColorVar(n.color), boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)", overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {n.type === "photo" && n.imageUrl && <img src={n.imageUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="result-title" style={{ fontSize: 13, fontWeight: 600 }}>{itemLabel(n)}</span>
                {itemPreview(n) && <span className="result-sub" style={{ color: "inherit", opacity: 0.6 }}>{itemPreview(n)}</span>}
              </span>
              <span style={{ fontSize: 11, opacity: 0.6, flexShrink: 0 }}>{fmtDate(n.createdAt)}</span>
            </button>
          ))}
        </div>
      </section>
    </Modal>
  );
}
