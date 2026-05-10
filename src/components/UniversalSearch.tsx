"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNotesStore } from "@/store/notes";
import { useTheme } from "@/hooks/useTheme";

const GRID = 80;

export default function UniversalSearch() {
  const notes = useNotesStore((s) => s.notes);
  const setPan = useNotesStore((s) => s.setPan);
  const bringToFront = useNotesStore((s) => s.bringToFront);
  const setHighlightedNoteId = useNotesStore((s) => s.setHighlightedNoteId);
  const setActiveFolderId = useNotesStore((s) => s.setActiveFolderId);
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const command = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p";
      if (!command) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ranked = notes
      .map((note) => {
        const title = itemLabel(note);
        const body = (note.body || note.caption || "").trim();
        const hayTitle = title.toLowerCase();
        const hayBody = body.toLowerCase();
        const score = !q
          ? 1
          : hayTitle === q
            ? 4
            : hayTitle.startsWith(q)
              ? 3
              : hayTitle.includes(q)
                ? 2
                : hayBody.includes(q)
                  ? 1
                  : 0;
        return { note, score, title, body };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || (b.note.createdAt ?? "").localeCompare(a.note.createdAt ?? ""));
    return ranked.slice(0, 8);
  }, [notes, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const goToNote = (note: typeof notes[number]) => {
    const cx = note.x * GRID + note.w * GRID / 2;
    const cy = note.y * GRID + note.h * GRID / 2;
    setActiveFolderId(note.parentId ?? null);
    setPan(window.innerWidth / 2 - cx, window.innerHeight / 2 - cy);
    bringToFront(note.id);
    setHighlightedNoteId(note.id);
    close();
  };

  if (!open) return null;

  const isDark = theme.isDark;
  const bg = theme.sidebarBg;
  const border = theme.sidebarBorder;

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        background: isDark ? "rgba(0,0,0,0.18)" : "rgba(20,18,24,0.10)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "14vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: "calc(100vw - 32px)",
          borderRadius: 18,
          background: bg,
          border: `1px solid ${border}`,
          boxShadow: isDark ? "0 28px 90px rgba(0,0,0,0.62)" : "0 28px 90px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, height: 58, padding: "0 18px", borderBottom: `1px solid ${border}` }}>
          <SearchGlyph />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "Enter" && matches[0]) goToNote(matches[0].note);
            }}
            placeholder="Search notes"
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-ui)",
              fontFamily: "inherit",
              fontSize: 18,
              fontWeight: 500,
            }}
          />
        </div>
        <div style={{ padding: 8, maxHeight: 360, overflow: "auto" }}>
          {matches.length === 0 ? (
            <div style={{ padding: "22px 14px", color: "var(--text-muted)", fontSize: 13 }}>No matching notes</div>
          ) : matches.map(({ note, title, body }) => (
            <button
              key={note.id}
              onClick={() => goToNote(note)}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                color: "var(--text-ui)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 12,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--btn-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ width: 34, height: 34, borderRadius: note.type === "folder" ? 10 : 8, background: note.type === "photo" ? "#fff" : theme.noteColors[note.color], border: note.type === "photo" ? "5px solid #fff" : "none", flexShrink: 0, boxShadow: note.type === "photo" ? "0 2px 8px rgba(0,0,0,0.2)" : "inset 0 0 0 1px rgba(0,0,0,0.08)" }} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 750, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{title}</span>
                <span style={{ display: "block", marginTop: 2, color: "var(--text-muted)", fontSize: 12, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {body || "Empty note"}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function itemLabel(note: ReturnType<typeof useNotesStore.getState>["notes"][number]) {
  if (note.type === "folder") return note.folderName?.trim() || note.title.trim() || "Untitled Folder";
  if (note.type === "photo") return note.caption?.trim() || note.body.trim() || "Untitled Photo";
  return note.title.trim() || "Untitled";
}

function SearchGlyph() {
  return (
    <svg width="21" height="21" viewBox="0 0 21 21" fill="none" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13.5 13.5L18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
