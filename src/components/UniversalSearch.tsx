"use client";

import { useEffect, useMemo, useState } from "react";
import { useNotesStore, type Note } from "@/store/notes";
import { isListable, itemLabel, itemPreview, itemSnippet } from "@/lib/items";
import { noteColorVar } from "@/lib/colors";
import Modal from "./ui/Modal";
import { FolderIcon, SearchIcon } from "./ui/icons";

const MAX_RESULTS = 8;

export default function UniversalSearch() {
  const open = useNotesStore((s) => s.universalSearchOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        useNotesStore.getState().setUniversalSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return open ? <SearchPalette onClose={() => useNotesStore.getState().setUniversalSearchOpen(false)} /> : null;
}

function SearchPalette({ onClose }: { onClose: () => void }) {
  const notes = useNotesStore((s) => s.notes);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored: { item: Note; score: number }[] = [];
    for (const item of notes) {
      if (!isListable(item)) continue;
      const title = itemLabel(item).toLowerCase();
      const score = !q ? 1
        : title === q ? 4
        : title.startsWith(q) ? 3
        : title.includes(q) ? 2
        : itemSnippet(item).toLowerCase().includes(q) ? 1 : 0;
      if (score) scored.push({ item, score });
    }
    scored.sort((a, b) => b.score - a.score || (b.item.createdAt ?? "").localeCompare(a.item.createdAt ?? ""));
    return scored.slice(0, MAX_RESULTS).map((s) => s.item);
  }, [notes, query]);

  const go = (item: Note) => {
    onClose();
    useNotesStore.getState().focusItem(item.id);
  };

  return (
    <Modal onClose={onClose} label="Search" top className="palette">
      <div className="palette-input-row">
        <SearchIcon size={20} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <input
          className="palette-input"
          value={query}
          autoFocus
          placeholder="Search notes, photos and folders"
          aria-label="Search"
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(matches.length - 1, i + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
            if (e.key === "Enter" && matches[active]) go(matches[active]);
          }}
        />
        <span className="kbd">Esc</span>
      </div>
      <div className="palette-list scroll-y" role="listbox">
        {matches.length === 0 ? (
          <p className="muted" style={{ padding: "20px 12px", margin: 0, fontSize: 13 }}>
            {query ? `Nothing matches “${query.trim()}”.` : "Nothing here yet. Add a note with the + button."}
          </p>
        ) : matches.map((item, i) => (
          <button
            key={item.id}
            role="option"
            aria-selected={i === active}
            className="result"
            data-active={i === active}
            onMouseMove={() => setActive(i)}
            onClick={() => go(item)}
          >
            <span className="result-thumb" style={{ background: item.type === "photo" ? "#fff" : item.type === "folder" ? "var(--accent-soft)" : noteColorVar(item.color), display: "grid", placeItems: "center", color: "var(--accent)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {item.type === "photo" && item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : item.type === "folder" ? <FolderIcon size={16} /> : null}
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="result-title">{itemLabel(item)}</span>
              <span className="result-sub">{itemPreview(item) || (item.type === "folder" ? "Folder" : item.type === "photo" ? "Photo" : "Empty note")}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
