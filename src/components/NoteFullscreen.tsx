"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGesture } from "@use-gesture/react";
import { useNotesStore, type Note } from "@/store/notes";
import { noteColorVar } from "@/lib/colors";
import { listKeyEdit, toggleTodoAt } from "@/lib/noteText";
import { clampNoteFont, MAX_NOTE_FONT, MIN_NOTE_FONT } from "@/lib/constants";
import NoteBody from "./NoteBody";
import { ShrinkIcon } from "./ui/icons";

type Phase = "entering" | "visible" | "exiting";
type ResizeDir = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

const MIN_W = 320;
const MIN_H = 240;
const SAVE_DELAY = 400;

function initialSize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  return { w: Math.min(860, vw - 32), h: Math.min(600, vh - 32) };
}

/**
 * Expanded note. Grows out of the note's on-screen rect using a transform
 * (FLIP) animation, so no layout work happens per frame.
 */
export default function NoteFullscreen({ note, origin, onClose }: { note: Note; origin: DOMRect; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("entering");
  const [dims, setDims] = useState(initialSize);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: note.title, body: note.body });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const focusTarget = useRef<"title" | "body">("body");
  const pendingCursor = useRef<number | null>(null);

  const fontSize = (note.fontSize ?? 13) + 3;
  const titleSize = Math.min(48, fontSize + 6);
  const lineStep = Math.round(Math.max(28, fontSize * 1.75));

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("visible")));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!editing) return;
    const el = focusTarget.current === "title" ? titleRef.current : bodyRef.current;
    el?.focus({ preventScroll: true });
    if (el instanceof HTMLTextAreaElement) el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  useLayoutEffect(() => {
    if (pendingCursor.current === null || !bodyRef.current) return;
    bodyRef.current.setSelectionRange(pendingCursor.current, pendingCursor.current);
    pendingCursor.current = null;
  }, [draft.body]);

  const save = (next: { title: string; body: string }, immediate = false) => {
    clearTimeout(saveTimer.current);
    const commit = () => useNotesStore.getState().updateNote(note.id, next);
    if (immediate) commit();
    else saveTimer.current = setTimeout(commit, SAVE_DELAY);
  };
  const updateDraft = (next: { title: string; body: string }) => { setDraft(next); save(next); };
  const enterEdit = (focus: "title" | "body") => {
    focusTarget.current = focus;
    setDraft({ title: note.title, body: note.body });
    setEditing(true);
  };
  const exitEdit = () => { save(draft, true); setEditing(false); };
  const close = () => {
    if (editing) save(draft, true);
    setPhase("exiting");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      if (!editing) setPhase("exiting");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editing]);

  const vw = window.innerWidth, vh = window.innerHeight;
  const left = (vw - dims.w) / 2;
  const top = (vh - dims.h) / 2;
  const collapsed = phase !== "visible";
  const fromTransform = `translate(${origin.left + origin.width / 2 - vw / 2}px, ${origin.top + origin.height / 2 - vh / 2}px) scale(${origin.width / dims.w}, ${origin.height / dims.h}) rotate(${note.rotation}deg)`;
  const ruleStyle = { "--line-step": `${lineStep}px`, backgroundPosition: "0 20px" } as React.CSSProperties;

  return createPortal(
    <div
      onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 800,
        background: "var(--scrim)",
        opacity: collapsed ? 0 : 1,
        transition: "opacity 280ms ease",
        pointerEvents: phase === "exiting" ? "none" : "auto",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={note.title || "Note"}
        className="fs-note paper-texture"
        onTransitionEnd={(e) => { if (e.propertyName === "transform" && phase === "exiting") onClose(); }}
        style={{
          left, top, width: dims.w, height: dims.h,
          background: noteColorVar(note.color),
          "--note-bg": noteColorVar(note.color),
          transform: collapsed ? fromTransform : "none",
          opacity: phase === "exiting" ? 0.4 : 1,
        } as React.CSSProperties}
      >
        <div className="tape" style={{ width: 68, height: 22, top: -11 }} />

        <div className="note-header" style={{ height: 44, padding: "0 14px", gap: 10, background: "rgba(0,0,0,0.08)" }}>
          <button className="traffic" style={{ "--dot": "#34c759" } as React.CSSProperties} onClick={close} title="Back to canvas" aria-label="Back to canvas">
            <ShrinkIcon size={9} />
          </button>
          {editing ? (
            <input
              ref={titleRef}
              value={draft.title}
              placeholder="Title"
              onChange={(e) => updateDraft({ ...draft, title: e.target.value })}
              onBlur={(e) => { if (e.relatedTarget !== bodyRef.current) exitEdit(); }}
              onKeyDown={(e) => {
                if (e.key === "Escape") exitEdit();
                if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) { e.preventDefault(); bodyRef.current?.focus(); }
              }}
              style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontSize: titleSize, fontWeight: 700 }}
            />
          ) : (
            <span onClick={() => enterEdit("title")} style={{ flex: 1, minWidth: 0, fontSize: titleSize, fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", cursor: "text" }}>
              {note.title || <span className="note-placeholder" style={{ fontWeight: 400 }}>Untitled</span>}
            </span>
          )}
          <button className="note-mini-btn" style={{ width: 24, height: 24, fontSize: 15 }} title="Smaller text" aria-label="Smaller text" disabled={(note.fontSize ?? 13) <= MIN_NOTE_FONT}
            onClick={() => useNotesStore.getState().updateNote(note.id, { fontSize: clampNoteFont((note.fontSize ?? 13) - 1) })}>−</button>
          <button className="note-mini-btn" style={{ width: 24, height: 24, fontSize: 15 }} title="Larger text" aria-label="Larger text" disabled={(note.fontSize ?? 13) >= MAX_NOTE_FONT}
            onClick={() => useNotesStore.getState().updateNote(note.id, { fontSize: clampNoteFont((note.fontSize ?? 13) + 1) })}>+</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
          {editing ? (
            <textarea
              ref={bodyRef}
              className="ruled"
              value={draft.body}
              placeholder="Start writing…"
              onChange={(e) => updateDraft({ ...draft, body: e.target.value })}
              onBlur={(e) => { if (e.relatedTarget !== titleRef.current) exitEdit(); }}
              onKeyDown={(e) => {
                const ta = e.currentTarget;
                if (e.key === "Escape") { exitEdit(); return; }
                const edit = listKeyEdit(e.key, e.ctrlKey || e.metaKey, ta.value, ta.selectionStart, ta.selectionEnd);
                if (!edit) return;
                e.preventDefault();
                pendingCursor.current = edit.cursor;
                updateDraft({ ...draft, body: edit.text });
              }}
              style={{ ...ruleStyle, flex: 1, padding: "20px 28px", resize: "none", background: "transparent", border: "none", outline: "none", fontSize, lineHeight: `${lineStep}px` }}
            />
          ) : (
            <div className="ruled" onClick={() => enterEdit("body")} style={{ ...ruleStyle, flex: 1, padding: "20px 28px", cursor: "text" }}>
              {note.body
                ? <NoteBody body={note.body} fontSize={fontSize} lineHeight={lineStep} onToggleTodo={(i) => useNotesStore.getState().updateNote(note.id, { body: toggleTodoAt(note.body, i) })} />
                : <span className="note-placeholder" style={{ fontSize, lineHeight: `${lineStep}px` }}>Click to write…</span>}
            </div>
          )}
        </div>

        {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as ResizeDir[]).map((dir) => (
          <EdgeHandle key={dir} dir={dir} dims={dims} onResize={setDims} />
        ))}
      </div>
    </div>,
    document.body,
  );
}

const CURSORS: Record<ResizeDir, string> = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };

function EdgeHandle({ dir, dims, onResize }: { dir: ResizeDir; dims: { w: number; h: number }; onResize: (d: { w: number; h: number }) => void }) {
  const start = useRef(dims);
  const bind = useGesture({
    onDragStart: () => { start.current = dims; },
    onDrag: ({ movement: [mx, my] }) => {
      const s = start.current;
      const maxW = window.innerWidth - 16, maxH = window.innerHeight - 16;
      // The card stays centred, so an edge drag grows both sides: double the delta.
      let w = s.w, h = s.h;
      if (dir.includes("e")) w = s.w + mx * 2;
      if (dir.includes("w")) w = s.w - mx * 2;
      if (dir.includes("s")) h = s.h + my * 2;
      if (dir.includes("n")) h = s.h - my * 2;
      onResize({ w: Math.min(maxW, Math.max(MIN_W, w)), h: Math.min(maxH, Math.max(MIN_H, h)) });
    },
  }, { drag: { filterTaps: true } });

  const corner = dir.length === 2, edge = 8, size = 18;
  const pos: React.CSSProperties = corner
    ? { width: size, height: size, [dir.includes("n") ? "top" : "bottom"]: -edge / 2, [dir.includes("w") ? "left" : "right"]: -edge / 2 }
    : dir === "n" || dir === "s"
      ? { [dir === "n" ? "top" : "bottom"]: -edge / 2, left: size, right: size, height: edge }
      : { [dir === "w" ? "left" : "right"]: -edge / 2, top: size, bottom: size, width: edge };
  return <div {...bind()} style={{ position: "absolute", zIndex: 10, cursor: CURSORS[dir], touchAction: "none", ...pos }} />;
}
