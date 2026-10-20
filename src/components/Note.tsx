"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNotesStore, type Note as NoteType } from "@/store/notes";
import { useAllBadges } from "@/lib/badges";
import { noteColorVar } from "@/lib/colors";
import { handleItemModePointer } from "@/lib/items";
import { listKeyEdit, toggleTodoAt } from "@/lib/noteText";
import { clampNoteFont, DEFAULT_NOTE_FONT, GRID, MAX_NOTE_FONT, MIN_NOTE_FONT, MIN_NOTE_SIZE, NOTE_HEADER_H } from "@/lib/constants";
import { useItemDrag } from "@/hooks/useItemDrag";
import { ResizeHandle, RotateHandle, type PixelRect } from "./ItemHandles";
import NoteBody from "./NoteBody";
import NoteFullscreen from "./NoteFullscreen";
import NoteContextMenu from "./NoteContextMenu";
import { ConfirmDialog } from "./ui/Modal";
import { EditIcon, ExpandIcon, LockIcon, TrashIcon, UnlockIcon } from "./ui/icons";

const SAVE_DELAY = 400;

const SLASH_COMMANDS = [
  { label: "Bullet list", hint: "- item", prefix: "- " },
  { label: "Numbered list", hint: "1. item", prefix: "1. " },
  { label: "To-do", hint: "[ ] task", prefix: "[ ] " },
];

export function noteMetrics(fontSize = DEFAULT_NOTE_FONT) {
  return {
    fontSize,
    titleSize: Math.min(44, fontSize + 3),
    lineStep: Math.round(Math.max(20, fontSize * 1.6)),
  };
}

function Note({ note }: { note: NoteType }) {
  const isSelected = useNotesStore((s) => s.selectedItemIds.includes(note.id));
  const isHighlighted = useNotesStore((s) => s.highlightedNoteId === note.id);
  const isConnectSource = useNotesStore((s) => s.connectionMode === note.id);
  const badges = useAllBadges();

  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusTarget = useRef<"title" | "body">("title");
  const pendingCursor = useRef<number | null>(null);

  // A note created from the + button opens straight into edit mode.
  const [editing, setEditing] = useState(() => useNotesStore.getState().newNoteId === note.id);
  const [draft, setDraft] = useState({ title: note.title, body: note.body });
  const [slashAt, setSlashAt] = useState<{ pos: number; top: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fsOrigin, setFsOrigin] = useState<DOMRect | null>(null);
  const [liveRect, setLiveRect] = useState<PixelRect | null>(null);
  const [liveRotation, setLiveRotation] = useState<number | null>(null);

  const { bind, dragPos, dragging } = useItemDrag(note, { disabled: note.locked || editing });
  const { fontSize, titleSize, lineStep } = noteMetrics(note.fontSize);

  useEffect(() => {
    const store = useNotesStore.getState();
    if (store.newNoteId === note.id) store.setNewNoteId(null);
  }, [note.id]);

  useEffect(() => {
    if (!isHighlighted) return;
    const timer = setTimeout(() => useNotesStore.getState().setHighlightedNoteId(null), 2400);
    return () => clearTimeout(timer);
  }, [isHighlighted]);

  useEffect(() => {
    if (!editing) return;
    const el = focusTarget.current === "title" ? titleRef.current : bodyRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (el === titleRef.current) titleRef.current.select();
    else el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  // Place the caret right after React commits a programmatic edit, before the next keystroke.
  useLayoutEffect(() => {
    if (pendingCursor.current === null || !bodyRef.current) return;
    bodyRef.current.setSelectionRange(pendingCursor.current, pendingCursor.current);
    pendingCursor.current = null;
  }, [draft.body]);

  const save = useCallback((next: { title: string; body: string }, immediate = false) => {
    clearTimeout(saveTimer.current);
    const commit = () => useNotesStore.getState().updateNote(note.id, next);
    if (immediate) commit();
    else saveTimer.current = setTimeout(commit, SAVE_DELAY);
  }, [note.id]);

  const updateDraft = (next: { title: string; body: string }) => {
    setDraft(next);
    save(next);
  };

  const enterEdit = (focus: "title" | "body") => {
    if (note.locked) return;
    focusTarget.current = focus;
    setDraft({ title: note.title, body: note.body });
    setEditing(true);
  };

  const exitEdit = () => {
    save(draft, true);
    setSlashAt(null);
    setEditing(false);
  };

  const applyBodyEdit = (text: string, cursor: number) => {
    pendingCursor.current = cursor;
    updateDraft({ ...draft, body: text });
  };

  const onBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (e.key === "Escape") { e.preventDefault(); exitEdit(); return; }
    if (slashAt && (e.key === "Backspace" || e.key === "Enter")) setSlashAt(null);
    if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
      const pos = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf("\n", pos - 1) + 1;
      if (!ta.value.substring(lineStart, pos).trim()) {
        const lineIndex = ta.value.slice(0, lineStart).split("\n").length - 1;
        setSlashAt({ pos, top: Math.min(ta.clientHeight - 10, 50 + lineIndex * lineStep) });
      }
      return;
    }
    const edit = listKeyEdit(e.key, e.ctrlKey || e.metaKey, ta.value, ta.selectionStart, ta.selectionEnd);
    if (!edit) return;
    e.preventDefault();
    applyBodyEdit(edit.text, edit.cursor);
  };

  const applySlash = (prefix: string) => {
    if (!slashAt) return;
    const before = draft.body.slice(0, slashAt.pos);
    const after = draft.body.slice(draft.body[slashAt.pos] === "/" ? slashAt.pos + 1 : slashAt.pos);
    setSlashAt(null);
    applyBodyEdit(before + prefix + after, before.length + prefix.length);
  };

  const toggleTodo = useCallback((lineIndex: number) => {
    useNotesStore.getState().updateNote(note.id, { body: toggleTodoAt(note.body, lineIndex) });
  }, [note.id, note.body]);

  const setFont = (delta: number) => useNotesStore.getState().updateNote(note.id, { fontSize: clampNoteFont(fontSize + delta) });

  const badgeById = useMemo(() => new Map(badges.map((b) => [b.id, b])), [badges]);

  const x = dragPos?.x ?? liveRect?.x ?? note.x * GRID;
  const y = dragPos?.y ?? liveRect?.y ?? note.y * GRID;
  const w = liveRect?.w ?? note.w * GRID;
  const h = liveRect?.h ?? note.h * GRID;
  const contentH = h - NOTE_HEADER_H;
  const ruleStyle = { "--line-step": `${lineStep}px` } as React.CSSProperties;

  return (
    <>
      <div
        ref={rootRef}
        data-item={note.id}
        data-connectable="true"
        data-selected={isSelected}
        data-highlighted={isHighlighted}
        data-connect-source={isConnectSource}
        data-dragging={dragging || liveRect !== null || liveRotation !== null}
        data-editing={editing}
        tabIndex={-1}
        className="item note"
        onPointerDownCapture={(e) => {
          if (handleItemModePointer(note.id, e, { connectable: true })) { e.preventDefault(); e.stopPropagation(); }
        }}
        onPointerDown={() => useNotesStore.getState().bringToFront(note.id)}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
        style={{
          left: x, top: y, width: w, height: h,
          zIndex: note.zIndex,
          transform: `rotate(${liveRotation ?? note.rotation}deg)`,
          background: noteColorVar(note.color),
          "--note-bg": noteColorVar(note.color),
        } as React.CSSProperties}
      >
        <div className="tape" />

        <div className="note-header">
          <button className="traffic" style={{ "--dot": "#34c759" } as React.CSSProperties} title="Open full screen" aria-label="Open full screen"
            onClick={() => setFsOrigin(rootRef.current?.getBoundingClientRect() ?? null)}>
            <ExpandIcon size={9} />
          </button>
          <button className="traffic" style={{ "--dot": "#f5c542" } as React.CSSProperties} title="Edit" aria-label="Edit note"
            disabled={note.locked} onClick={() => enterEdit("title")}>
            <EditIcon size={9} strokeWidth={2.6} />
          </button>
          <button className={`traffic${note.locked ? " traffic--locked" : ""}`} title={note.locked ? "Unlock" : "Lock in place"} aria-label={note.locked ? "Unlock note" : "Lock note"}
            onClick={() => useNotesStore.getState().updateNote(note.id, { locked: !note.locked })}>
            {note.locked ? <LockIcon size={9} /> : <UnlockIcon size={9} />}
          </button>
          <div {...bind()} className={note.locked ? undefined : "drag-handle"} style={{ flex: 1, alignSelf: "stretch", display: "grid", placeItems: "center" }} title={note.locked ? "Locked" : "Drag to move"}>
            {!note.locked && !editing && <span className="grip reveal"><span /><span /><span /></span>}
          </div>
          <button className="note-mini-btn reveal" title="Smaller text" aria-label="Smaller text" disabled={fontSize <= MIN_NOTE_FONT} onClick={() => setFont(-1)}>−</button>
          <button className="note-mini-btn reveal" title="Larger text" aria-label="Larger text" disabled={fontSize >= MAX_NOTE_FONT} onClick={() => setFont(1)}>+</button>
          <button className="traffic traffic--delete" style={{ "--dot": "#ff453a" } as React.CSSProperties} title="Delete" aria-label="Delete note"
            onClick={() => setConfirmDelete(true)}>
            <TrashIcon size={9} strokeWidth={2.6} />
          </button>
        </div>

        {editing ? (
          <div
            style={{ display: "flex", flexDirection: "column", height: contentH, padding: "7px 11px 9px", position: "relative" }}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) exitEdit(); }}
          >
            <input
              ref={titleRef}
              value={draft.title}
              placeholder="Title"
              onChange={(e) => updateDraft({ ...draft, title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.preventDefault(); exitEdit(); }
                if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) { e.preventDefault(); bodyRef.current?.focus(); }
              }}
              style={{ background: "transparent", border: "none", outline: "none", fontWeight: 700, fontSize: titleSize, width: "100%", padding: 0, marginBottom: 6 }}
            />
            <div style={{ height: 1.5, background: "currentColor", opacity: 0.2, marginBottom: 6, flexShrink: 0 }} />
            <textarea
              ref={bodyRef}
              value={draft.body}
              className="ruled"
              placeholder={"Write something…\n- bullet   1. numbered   [ ] todo\nType / for a list, Ctrl+. bullet, Ctrl+/ todo"}
              onChange={(e) => {
                updateDraft({ ...draft, body: e.target.value });
                if (slashAt && e.target.value[slashAt.pos] !== "/") setSlashAt(null);
              }}
              onKeyDown={onBodyKeyDown}
              style={{
                ...ruleStyle,
                flex: 1, width: "100%", padding: 0, resize: "none",
                background: "transparent", border: "none", outline: "none",
                fontSize, lineHeight: `${lineStep}px`,
              }}
            />
            {slashAt && (
              <div className="menu surface" style={{ position: "absolute", left: 10, top: slashAt.top, minWidth: 176, zIndex: 80, fontFamily: "var(--font-ui)" }}>
                {SLASH_COMMANDS.map((cmd) => (
                  <button key={cmd.prefix} className="menu-item" onPointerDown={(e) => e.preventDefault()} onClick={() => applySlash(cmd.prefix)} style={{ justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600 }}>{cmd.label}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{cmd.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ height: contentH, display: "flex", flexDirection: "column", overflow: "hidden", cursor: note.locked ? "default" : "text" }}>
            <div onClick={() => enterEdit("title")} style={{ padding: "8px 11px 5px", fontWeight: 700, fontSize: titleSize, flexShrink: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              {note.title || <span className="note-placeholder" style={{ fontWeight: 400 }}>Title</span>}
            </div>
            <div style={{ height: 1.5, margin: "0 11px 5px", background: "currentColor", opacity: 0.2, flexShrink: 0 }} />
            <div className="ruled" onClick={() => enterEdit("body")} style={{ ...ruleStyle, flex: 1, overflow: "hidden", padding: "0 11px 9px" }}>
              {note.body
                ? <NoteBody body={note.body} fontSize={fontSize} lineHeight={lineStep} onToggleTodo={toggleTodo} />
                : <span className="note-placeholder" style={{ fontSize, lineHeight: `${lineStep}px` }}>Tap to write…</span>}
            </div>
          </div>
        )}

        {note.badges.length > 0 && (
          <div className="item-badges">
            {note.badges.map((id) => {
              const badge = badgeById.get(id);
              return badge ? <span key={id} title={badge.label}><badge.Icon size={28} /></span> : null;
            })}
          </div>
        )}

        {!note.locked && !editing && (
          <>
            <ResizeHandle item={note} minSize={MIN_NOTE_SIZE} onLive={setLiveRect} />
            <RotateHandle item={note} onLive={setLiveRotation} />
          </>
        )}
      </div>

      {menu && (
        <NoteContextMenu
          x={menu.x} y={menu.y} item={note}
          onEdit={() => enterEdit("title")}
          onDelete={() => setConfirmDelete(true)}
          onClose={() => setMenu(null)}
        />
      )}
      {fsOrigin && <NoteFullscreen note={note} origin={fsOrigin} onClose={() => setFsOrigin(null)} />}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this note?"
          message={`${note.title ? `“${note.title}”` : "This note"} will be permanently removed.`}
          confirmLabel="Delete note"
          danger
          onConfirm={() => { setConfirmDelete(false); useNotesStore.getState().deleteNote(note.id); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

export default memo(Note);
