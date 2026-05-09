"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useGesture } from "@use-gesture/react";
import { Note } from "@/store/notes";
import { ThemeConfig } from "@/hooks/useTheme";
import { useNotesStore } from "@/store/notes";

type Phase = "entering" | "visible" | "exiting";
type ResizeDir = "n"|"s"|"e"|"w"|"nw"|"ne"|"sw"|"se";

interface Props {
  note: Note;
  theme: ThemeConfig;
  originX: number;
  originY: number;
  originW: number;
  originH: number;
  onClose: () => void;
}

const INIT_W = 860;
const INIT_H = 580;
const MIN_W  = 400;
const MIN_H  = 260;
const MIN_NOTE_FONT = 11;
const MAX_NOTE_FONT = 22;

function clampNoteFontSize(size: number) {
  return Math.min(MAX_NOTE_FONT, Math.max(MIN_NOTE_FONT, size));
}

// ── Line detection (same rules as Note.tsx) ──────────────────────
type LineType = "bullet" | "todo-open" | "todo-done" | "numbered" | "plain";
function detectLine(line: string): { type: LineType; content: string; num?: number } {
  if (line.startsWith("- ")||line.startsWith(". ")||line.startsWith("• ")) return { type: "bullet", content: line.slice(2) };
  if (line.startsWith("[ ] ")) return { type: "todo-open", content: line.slice(4) };
  if (line.startsWith("[x] ")) return { type: "todo-done", content: line.slice(4) };
  const m = line.match(/^(\d+)\. (.*)/);
  if (m) return { type: "numbered", content: m[2], num: parseInt(m[1]) };
  return { type: "plain", content: line };
}
function lineContinuation(line: string): string | null {
  const { type, num } = detectLine(line);
  if (type === "bullet") return "- ";
  if (type === "todo-open" || type === "todo-done") return "[ ] ";
  if (type === "numbered" && num !== undefined) return `${num + 1}. `;
  return null;
}

export default function NoteFullscreen({ note, theme, originX, originY, originW, originH, onClose }: Props) {
  const { updateNote } = useNotesStore();
  const [phase, setPhase]       = useState<Phase>("entering");
  const [dims, setDims]         = useState({ w: INIT_W, h: INIT_H });
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editBody, setEditBody]   = useState(note.body);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleRef  = useRef<HTMLInputElement>(null);
  const bodyRef   = useRef<HTMLTextAreaElement>(null);

  const vCX = typeof window !== "undefined" ? window.innerWidth  / 2 : 0;
  const vCY = typeof window !== "undefined" ? window.innerHeight / 2 : 0;
  const startRect = {
    left: originX - originW / 2,
    top: originY - originH / 2,
    w: originW,
    h: originH,
  };
  const targetRect = {
    left: vCX - dims.w / 2,
    top: vCY - dims.h / 2,
    w: dims.w,
    h: dims.h,
  };
  const rect = phase === "visible" ? targetRect : startRect;

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("visible")));
    return () => cancelAnimationFrame(id);
  }, []);

  const triggerClose = useCallback(() => { setPhase("exiting"); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") triggerClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [triggerClose]);

  const onTransitionEnd = () => { if (phase === "exiting") onClose(); };

  const scheduleEdit = (title: string, body: string) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => updateNote(note.id, { title, body }), 400);
  };

  const flushEdit = () => {
    clearTimeout(saveTimer.current);
    updateNote(note.id, { title: editTitle, body: editBody });
  };

  const exitEdit = () => { flushEdit(); setIsEditing(false); };

  const enterEdit = (focus: "title" | "body" = "body") => {
    setIsEditing(true);
    setTimeout(() => { (focus === "title" ? titleRef.current : bodyRef.current)?.focus(); }, 40);
  };

  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (e.key === "Escape") { exitEdit(); return; }
    if (e.key === "Enter") {
      const pos = ta.selectionStart, text = ta.value;
      const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
      const cont = lineContinuation(text.substring(lineStart, pos));
      if (cont !== null) {
        e.preventDefault();
        const { content } = detectLine(text.substring(lineStart, pos));
        if (!content.trim()) {
          const newText = text.substring(0, lineStart) + text.substring(pos);
          setEditBody(newText); scheduleEdit(editTitle, newText);
          setTimeout(() => { ta.setSelectionRange(lineStart, lineStart); }, 0);
        } else {
          const ins = "\n" + cont;
          const newText = text.substring(0, pos) + ins + text.substring(ta.selectionEnd);
          setEditBody(newText); scheduleEdit(editTitle, newText);
          setTimeout(() => { const np = pos + ins.length; ta.setSelectionRange(np, np); }, 0);
        }
      }
    }
  };

  const toggleTodo = (lineIndex: number) => {
    const lines = editBody.split("\n");
    const l = lines[lineIndex];
    if (l.startsWith("[ ] ")) lines[lineIndex] = "[x] " + l.slice(4);
    else if (l.startsWith("[x] ")) lines[lineIndex] = "[ ] " + l.slice(4);
    const nb = lines.join("\n");
    setEditBody(nb); updateNote(note.id, { body: nb });
  };

  const bg        = theme.noteColors[note.color] ?? "#fff176";
  const textColor = theme.noteText;
  const phColor   = theme.notePlaceholder;
  const isDark    = theme.isDark;
  const lineColor = isDark ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.07)";
  const bodyFontSize = note.fontSize ?? 13;
  const fullscreenFontSize = bodyFontSize + 2;
  const lineStep = Math.max(28.5, fullscreenFontSize * 1.9);
  const adjustFontSize = (delta: number) => {
    updateNote(note.id, { fontSize: clampNoteFontSize(bodyFontSize + delta) });
  };

  return (
    <div
      onClick={triggerClose}
      style={{
        position: "fixed", inset: 0,
        background: isDark ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.42)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        zIndex: 800,
        opacity: phase === "visible" ? 1 : 0,
        transition: "opacity 300ms ease",
        pointerEvents: phase === "exiting" ? "none" : "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={onTransitionEnd}
        className="sticky-note-font"
        style={{
          position: "fixed",
          left: rect.left,
          top: rect.top,
          width: rect.w,
          height: rect.h,
          background: bg, borderRadius: 16,
          display: "flex", flexDirection: "column", overflow: "visible",
          opacity: phase === "visible" ? 1 : 0,
          transition: "left 320ms cubic-bezier(0.22,1,0.36,1), top 320ms cubic-bezier(0.22,1,0.36,1), width 320ms cubic-bezier(0.22,1,0.36,1), height 320ms cubic-bezier(0.22,1,0.36,1), opacity 240ms ease",
          zIndex: 810,
          boxShadow: "0 32px 80px rgba(0,0,0,0.28)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -11,
            left: "50%",
            transform: "translateX(-50%) rotate(-1.5deg)",
            width: 68,
            height: 22,
            background: isDark ? "rgba(255,250,200,0.24)" : "rgba(255,253,200,0.68)",
            borderRadius: 3,
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            pointerEvents: "none",
            zIndex: 4,
          }}
        />
        {/* Noise overlay */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 16, opacity: 0.07, filter: "url(#paper-noise)", pointerEvents: "none", mixBlendMode: "multiply", background: "transparent" }} />

        {/* Header — green dot + icon, no other Mac dots */}
        <div style={{
          display: "flex", alignItems: "center",
          height: 40, padding: "0 14px", gap: 10,
          background: "rgba(0,0,0,0.08)", flexShrink: 0,
          position: "relative", userSelect: "none",
        }}>
          {/* Green dot with expand icon */}
          <button
            onClick={triggerClose}
            title="Return to canvas"
            style={{
              width: 15, height: 15, borderRadius: "50%",
              background: "#34c759", border: "none", cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <polyline points="5.5,1 8,1 8,3.5" stroke="rgba(0,0,0,0.5)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="3.5,8 1,8 1,5.5" stroke="rgba(0,0,0,0.5)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="1" y1="8" x2="3.8" y2="5.2" stroke="rgba(0,0,0,0.5)" strokeWidth="1.1" strokeLinecap="round"/>
              <line x1="8" y1="1" x2="5.2" y2="3.8" stroke="rgba(0,0,0,0.5)" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Title — click to edit */}
          {isEditing ? (
            <input
              ref={titleRef}
              value={editTitle}
              onChange={(e) => { setEditTitle(e.target.value); scheduleEdit(e.target.value, editBody); }}
              onBlur={(e) => { if (e.relatedTarget !== bodyRef.current) exitEdit(); }}
              onKeyDown={(e) => {
                if (e.key === "Tab") { e.preventDefault(); bodyRef.current?.focus(); }
                if (e.key === "Escape") exitEdit();
              }}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 20, fontWeight: 800, color: textColor, fontFamily: "inherit" }}
            />
          ) : (
            <span
              onClick={() => enterEdit("title")}
              style={{ flex: 1, fontSize: 20, fontWeight: 800, color: textColor, opacity: 0.84, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", cursor: "text" }}
            >
              {note.title || <span style={{ opacity: 0.4 }}>Untitled</span>}
            </span>
          )}

          {/* Edit button */}
          <button
            onClick={() => enterEdit("body")}
            title={isEditing ? "Editing…" : "Edit note"}
            style={{ background: "rgba(0,0,0,0.08)", border: "none", borderRadius: 6, padding: "4px 10px", color: textColor, opacity: isEditing ? 0.5 : 0.7, cursor: isEditing ? "default" : "pointer", fontSize: 12, fontFamily: "inherit" }}
          >
            {isEditing ? "editing" : "Edit"}
          </button>
          <FontSizeButton label="-" title="Decrease text size" onClick={() => adjustFontSize(-1)} disabled={bodyFontSize <= MIN_NOTE_FONT} textColor={textColor} />
          <FontSizeButton label="+" title="Increase text size" onClick={() => adjustFontSize(1)} disabled={bodyFontSize >= MAX_NOTE_FONT} textColor={textColor} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
          {isEditing ? (
            <textarea
              ref={bodyRef}
              value={editBody}
              placeholder="Start writing..."
              onChange={(e) => { setEditBody(e.target.value); scheduleEdit(editTitle, e.target.value); }}
              onBlur={(e) => { if (e.relatedTarget !== titleRef.current) exitEdit(); }}
              onKeyDown={handleBodyKeyDown}
              style={{
                flex: 1, padding: "20px 28px",
                background: "transparent", border: "none", outline: "none", resize: "none",
                fontSize: fullscreenFontSize, color: textColor, fontFamily: "inherit", lineHeight: "1.75",
                backgroundImage: `repeating-linear-gradient(transparent, transparent ${lineStep - 1.5}px, ${lineColor} ${lineStep - 1.5}px, ${lineColor} ${lineStep}px)`,
                backgroundSize: `100% ${lineStep}px`,
                backgroundPosition: "0 20px",
              }}
            />
          ) : (
            <div style={{ 
              padding: "20px 28px", flex: 1, cursor: "text",
              backgroundImage: `repeating-linear-gradient(transparent, transparent ${lineStep - 1.5}px, ${lineColor} ${lineStep - 1.5}px, ${lineColor} ${lineStep}px)`,
              backgroundSize: `100% ${lineStep}px`,
              backgroundPosition: "0 20px",
            }} onClick={() => enterEdit("body")}>
              {note.body ? (
                <FSBodyRenderer lines={note.body.split("\n")} textColor={textColor} onToggle={toggleTodo} fontSize={fullscreenFontSize} />
              ) : (
                <span style={{ color: phColor, fontSize: fullscreenFontSize }}>Click to write...</span>
              )}
            </div>
          )}
        </div>

        {/* Resize handles */}
        {(["nw","n","ne","e","se","s","sw","w"] as ResizeDir[]).map((dir) => (
          <FSResizeHandle key={dir} dir={dir} dims={dims} onUpdate={setDims} />
        ))}
      </div>
    </div>
  );
}

// ── Fullscreen body renderer ──────────────────────────────────────

function FSBodyRenderer({ lines, textColor, onToggle, fontSize }: { lines: string[]; textColor: string; onToggle: (i: number) => void; fontSize: number }) {
  return (
    <div className="note-rendered-text" style={{ fontSize, lineHeight: "1.75" }}>
      {lines.map((line, i) => {
        const { type, content, num } = detectLine(line);
        if (type === "bullet") return (
          <div key={i} style={{ display: "flex", gap: 8, color: textColor }}>
            <span style={{ opacity: 0.5, flexShrink: 0 }}>•</span>
            <span>{content || " "}</span>
          </div>
        );
        if (type === "todo-open") return (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: textColor }}>
            <button onClick={() => onToggle(i)} style={{ flexShrink: 0, marginTop: "0.25em", width: 15, height: 15, border: `1.5px solid ${textColor}`, borderRadius: 3, background: "transparent", cursor: "pointer", padding: 0, opacity: 0.65 }} />
            <span>{content || " "}</span>
          </div>
        );
        if (type === "todo-done") return (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: textColor }}>
            <button onClick={() => onToggle(i)} style={{ flexShrink: 0, marginTop: "0.25em", width: 15, height: 15, border: `1.5px solid ${textColor}`, borderRadius: 3, background: textColor, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><polyline points="1,4.5 3.5,7 8,2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span style={{ textDecoration: "line-through", opacity: 0.5 }}>{content || " "}</span>
          </div>
        );
        if (type === "numbered") return (
          <div key={i} style={{ display: "flex", gap: 8, color: textColor }}>
            <span style={{ opacity: 0.5, flexShrink: 0, minWidth: "2em", textAlign: "right" }}>{num}.</span>
            <span>{content || " "}</span>
          </div>
        );
        return <div key={i} style={{ color: textColor, minHeight: "1.75em" }}>{line || " "}</div>;
      })}
    </div>
  );
}

// ── Fullscreen resize handle ──────────────────────────────────────

function FontSizeButton({ label, title, onClick, disabled, textColor }: { label: string; title: string; onClick: () => void; disabled: boolean; textColor: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
      title={title}
      disabled={disabled}
      style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        border: "none",
        background: "rgba(0,0,0,0.08)",
        color: textColor,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.3 : 0.72,
        padding: 0,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        fontWeight: 900,
        lineHeight: "24px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
    >
      {label}
    </button>
  );
}

function FSResizeHandle({ dir, dims, onUpdate }: { dir: ResizeDir; dims: { w: number; h: number }; onUpdate: (d: { w: number; h: number }) => void }) {
  const start = useRef({ w: 0, h: 0 });
  const calc = (mx: number, my: number) => {
    const s = start.current; let w = s.w, h = s.h;
    if (dir.includes("e")) w = Math.max(MIN_W, s.w + mx);
    if (dir.includes("w")) w = Math.max(MIN_W, s.w - mx);
    if (dir.includes("s")) h = Math.max(MIN_H, s.h + my);
    if (dir.includes("n")) h = Math.max(MIN_H, s.h - my);
    return { w, h };
  };
  const bind = useGesture({
    onDragStart: () => { start.current = { w: dims.w, h: dims.h }; },
    onDrag: ({ movement: [mx, my] }) => { onUpdate(calc(mx, my)); },
  }, { drag: { filterTaps: true } });

  const cursors: Record<ResizeDir, string> = { nw:"nw-resize",n:"n-resize",ne:"ne-resize",e:"e-resize",se:"se-resize",s:"s-resize",sw:"sw-resize",w:"w-resize" };
  const isCorner = dir.length === 2;
  const s = 8, half = s / 2, cornerSz = 16;
  const base: React.CSSProperties = { position: "absolute", zIndex: 10, cursor: cursors[dir], background: "transparent" };
  const pos: React.CSSProperties = isCorner ? { width: cornerSz, height: cornerSz, [dir.includes("n") ? "top" : "bottom"]: -half, [dir.includes("w") ? "left" : "right"]: -half } : dir === "n" ? { top: -half, left: cornerSz, right: cornerSz, height: s } : dir === "s" ? { bottom: -half, left: cornerSz, right: cornerSz, height: s } : dir === "e" ? { right: -half, top: cornerSz, bottom: cornerSz, width: s } : { left: -half, top: cornerSz, bottom: cornerSz, width: s };
  return <div {...bind()} style={{ ...base, ...pos }} />;
}
