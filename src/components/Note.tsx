"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useGesture } from "@use-gesture/react";
import { useNotesStore, Note as NoteType } from "@/store/notes";
import { useTheme } from "@/hooks/useTheme";
import { DEFAULT_BADGES } from "@/lib/badges";
import NoteFullscreen from "./NoteFullscreen";
import DeleteConfirm from "./DeleteConfirm";
import NoteContextMenu from "./NoteContextMenu";

export type ResizeDir = "n"|"s"|"e"|"w"|"nw"|"ne"|"sw"|"se";

// ── Rich text helpers ────────────────────────────────────────────

type LineType = "bullet" | "todo-open" | "todo-done" | "numbered" | "plain";

function detectLine(line: string): { type: LineType; content: string; num?: number } {
  if (line.startsWith("- "))   return { type: "bullet",    content: line.slice(2) };
  if (line.startsWith("[ ] ")) return { type: "todo-open", content: line.slice(4) };
  if (line.startsWith("[x] ")) return { type: "todo-done", content: line.slice(4) };
  const m = line.match(/^(\d+)\. (.*)/);
  if (m)                        return { type: "numbered",  content: m[2], num: parseInt(m[1]) };
  return                               { type: "plain",     content: line };
}

function lineContinuation(line: string): string | null {
  const { type, num } = detectLine(line);
  if (type === "bullet")   return "- ";
  if (type === "todo-open" || type === "todo-done") return "[ ] ";
  if (type === "numbered" && num !== undefined) return `${num + 1}. `;
  return null;
}

// ── Component ────────────────────────────────────────────────────

interface Props { note: NoteType; gridUnit: number; }

export default function Note({ note, gridUnit: G }: Props) {
  const {
    updateNote, deleteNote, bringToFront,
    badgeMode, setBadgeMode, toggleNoteBadge, customBadges,
    newNoteId, setNewNoteId,
    connectionMode, setConnectionMode, addConnection,
    setFocusedNoteId, pendingInsert, setPendingInsert,
  } = useNotesStore();
  const panX = useNotesStore((s) => s.canvas.panX);
  const panY = useNotesStore((s) => s.canvas.panY);
  const theme = useTheme();
  const isDark = theme.isDark;

  const [hovered, setHovered]           = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDelete, setShowDelete]     = useState(false);
  const [isDragging, setIsDragging]     = useState(false);
  const [isEditing, setIsEditing]       = useState(false);
  const [editFocus, setEditFocus]       = useState<"title" | "body">("title");
  const [contextMenu, setContextMenu]   = useState<{ x: number; y: number } | null>(null);

  const [dragPos, setDragPos]     = useState<{ x: number; y: number } | null>(null);
  const [resizeDims, setResizeDims] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [editTitle, setEditTitle] = useState(note.title);
  const [editBody,  setEditBody]  = useState(note.body);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleRef  = useRef<HTMLInputElement>(null);
  const bodyRef   = useRef<HTMLTextAreaElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onNoteEnter = () => { clearTimeout(leaveTimer.current); setHovered(true); };
  const onNoteLeave = () => { leaveTimer.current = setTimeout(() => setHovered(false), 90); };

  useEffect(() => {
    if (!isEditing) { setEditTitle(note.title); setEditBody(note.body); }
  }, [note.title, note.body, isEditing]);

  // Auto-focus when new note is created via +
  useEffect(() => {
    if (newNoteId === note.id) {
      setIsEditing(true); setEditFocus("title"); setNewNoteId(null);
    }
  }, [newNoteId, note.id, setNewNoteId]);

  // Focus the correct input on edit mode entry
  useEffect(() => {
    if (!isEditing) return;
    const t = setTimeout(() => {
      if (editFocus === "title") { titleRef.current?.focus(); titleRef.current?.select(); }
      else { const ta = bodyRef.current; if (!ta) return; ta.focus(); const l = ta.value.length; ta.setSelectionRange(l, l); }
    }, 30);
    return () => clearTimeout(t);
  }, [isEditing, editFocus]);

  // Track focused note in store (for sidebar bullet/todo buttons)
  useEffect(() => {
    setFocusedNoteId(isEditing ? note.id : null);
  }, [isEditing, note.id, setFocusedNoteId]);

  // Apply pending insert from sidebar buttons
  useEffect(() => {
    if (!pendingInsert) return;
    const ta = bodyRef.current;
    if (!isEditing) { setIsEditing(true); setEditFocus("body"); return; }
    if (!ta) return;
    const prefix = pendingInsert === "bullet" ? "- " : "[ ] ";
    insertPrefix(prefix, ta);
    setPendingInsert(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInsert]);

  const scheduleEdit = useCallback((title: string, body: string) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => updateNote(note.id, { title, body }), 400);
  }, [note.id, updateNote]);

  const flushEdit = useCallback(() => {
    clearTimeout(saveTimer.current);
    updateNote(note.id, { title: editTitle, body: editBody });
  }, [editTitle, editBody, note.id, updateNote]);

  const exitEdit = useCallback(() => { flushEdit(); setIsEditing(false); }, [flushEdit]);
  const enterEdit = (focus: "title" | "body" = "title") => { if (note.locked) return; setEditFocus(focus); setIsEditing(true); };

  useEffect(() => {
    if (!isEditing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") exitEdit(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isEditing, exitEdit]);

  // ── Insert prefix at cursor (toggle off if already present on line) ──
  const insertPrefix = (prefix: string, ta: HTMLTextAreaElement) => {
    const pos  = ta.selectionStart;
    const text = ta.value;
    const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
    const restOfLine = text.substring(lineStart);
    let newText: string, newPos: number;

    if (restOfLine.startsWith(prefix)) {
      // Toggle off
      newText = text.substring(0, lineStart) + text.substring(lineStart + prefix.length);
      newPos  = Math.max(lineStart, pos - prefix.length);
    } else {
      // Toggle on — strip other prefixes first
      const { type } = detectLine(restOfLine);
      let stripped = restOfLine;
      if (type === "bullet")    stripped = stripped.slice(2);
      if (type === "todo-open") stripped = stripped.slice(4);
      if (type === "todo-done") stripped = stripped.slice(4);
      const m = stripped.match(/^\d+\. /); if (m) stripped = stripped.slice(m[0].length);
      newText = text.substring(0, lineStart) + prefix + stripped;
      newPos  = lineStart + prefix.length;
    }

    setEditBody(newText);
    scheduleEdit(editTitle, newText);
    setTimeout(() => { ta.setSelectionRange(newPos, newPos); ta.focus(); }, 0);
  };

  // ── Smart Enter / Backspace in body textarea ──────────────────
  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;

    // Ctrl+. → bullet, Ctrl+/ → todo
    if ((e.ctrlKey || e.metaKey) && e.key === ".") { e.preventDefault(); insertPrefix("- ", ta); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === "/") { e.preventDefault(); insertPrefix("[ ] ", ta); return; }

    if (e.key === "Enter") {
      const pos  = ta.selectionStart;
      const text = ta.value;
      const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
      const currentLine = text.substring(lineStart, pos);
      const cont = lineContinuation(currentLine);

      if (cont !== null) {
        e.preventDefault();
        const { content } = detectLine(currentLine);
        if (!content.trim()) {
          // Empty formatted line → exit format
          const before = text.substring(0, lineStart);
          const after  = text.substring(pos);
          const newText = before + after;
          setEditBody(newText);
          scheduleEdit(editTitle, newText);
          setTimeout(() => { ta.setSelectionRange(lineStart, lineStart); }, 0);
        } else {
          // Continue format on new line
          const ins = "\n" + cont;
          const before = text.substring(0, pos);
          const after  = text.substring(ta.selectionEnd);
          const newText = before + ins + after;
          setEditBody(newText);
          scheduleEdit(editTitle, newText);
          setTimeout(() => { const np = pos + ins.length; ta.setSelectionRange(np, np); }, 0);
        }
      }
      return;
    }

    if (e.key === "Backspace") {
      const pos  = ta.selectionStart;
      const text = ta.value;
      if (ta.selectionStart !== ta.selectionEnd) return; // let browser handle selection delete
      const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
      const currentLine = text.substring(lineStart, pos);
      const { type, content } = detectLine(currentLine);
      // If cursor is right at end of an empty formatted line prefix, remove the prefix
      if (type !== "plain" && !content.trim()) {
        const prefixLen = currentLine.length;
        if (pos === lineStart + prefixLen) {
          e.preventDefault();
          const before = text.substring(0, lineStart);
          const after  = text.substring(lineStart + prefixLen);
          const newText = before + after;
          setEditBody(newText);
          scheduleEdit(editTitle, newText);
          setTimeout(() => { ta.setSelectionRange(lineStart, lineStart); }, 0);
        }
      }
    }
  };

  // ── Toggle a todo checkbox in view mode ───────────────────────
  const toggleTodo = (lineIndex: number) => {
    const lines = note.body.split("\n");
    const l = lines[lineIndex];
    if (l.startsWith("[ ] "))      lines[lineIndex] = "[x] " + l.slice(4);
    else if (l.startsWith("[x] ")) lines[lineIndex] = "[ ] " + l.slice(4);
    const newBody = lines.join("\n");
    setEditBody(newBody);
    updateNote(note.id, { body: newBody });
  };

  const dragStart = useRef({ pixelX: 0, pixelY: 0 });
  const bindDrag = useGesture(
    {
      onDragStart: () => { if (note.locked || isEditing) return; bringToFront(note.id); setIsDragging(true); dragStart.current = { pixelX: note.x * G, pixelY: note.y * G }; },
      onDrag: ({ movement: [mx, my] }) => { if (note.locked || isEditing) return; setDragPos({ x: dragStart.current.pixelX + mx, y: dragStart.current.pixelY + my }); },
      onDragEnd: ({ movement: [mx, my] }) => { if (note.locked || isEditing) return; updateNote(note.id, { x: Math.round((dragStart.current.pixelX + mx) / G), y: Math.round((dragStart.current.pixelY + my) / G) }); setDragPos(null); setIsDragging(false); },
    },
    { drag: { filterTaps: true } }
  );

  const bg        = theme.noteColors[note.color] ?? "#fff176";
  const textColor = theme.noteText;
  const phColor   = theme.notePlaceholder;
  const lineColor = isDark ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.07)";

  const visualX = dragPos?.x ?? resizeDims?.x ?? note.x * G;
  const visualY = dragPos?.y ?? resizeDims?.y ?? note.y * G;
  const visualW = resizeDims?.w ?? note.w * G;
  const visualH = resizeDims?.h ?? note.h * G;

  const originX = visualX + panX + visualW / 2;
  const originY = visualY + panY + visualH / 2;

  const shadow = isDark
    ? hovered ? "0 12px 32px rgba(0,0,0,0.65)" : "0 4px 14px rgba(0,0,0,0.5)"
    : hovered ? "0 12px 28px rgba(0,0,0,0.16)" : "0 3px 10px rgba(0,0,0,0.11)";

  const allBadges = [
    ...DEFAULT_BADGES,
    ...customBadges.map((cb) => ({
      id: cb.id, label: cb.label, color: "#888", ring: "#666",
      Icon: ({ size = 28 }: { size?: number }) => (
        <img src={cb.url} alt={cb.label} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />
      ),
    })),
  ];

  const isConnectionSource = connectionMode === note.id;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (badgeMode) { toggleNoteBadge(note.id, badgeMode); setBadgeMode(null); return; }
    if (e.shiftKey) {
      if (connectionMode && connectionMode !== note.id) { addConnection(connectionMode, note.id); setConnectionMode(null); }
      else { setConnectionMode(isConnectionSource ? null : note.id); }
      return;
    }
    bringToFront(note.id);
  };

  return (
    <>
      <div
        onMouseEnter={onNoteEnter}
        onMouseLeave={onNoteLeave}
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
        className={badgeMode ? "badge-mode-active" : isConnectionSource ? "connection-source-active" : ""}
        style={{
          position: "absolute", left: visualX, top: visualY, width: visualW, height: visualH,
          background: bg, borderRadius: 14,
          transform: `rotate(${note.rotation}deg)`,
          transition: "transform 200ms ease, box-shadow 200ms ease",
          zIndex: note.zIndex, overflow: "visible", pointerEvents: "auto",
          boxShadow: shadow, cursor: isDragging ? "grabbing" : "default",
        }}
      >
        {/* Noise + tape */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 14, opacity: 0.09, filter: "url(#paper-noise)", pointerEvents: "none", mixBlendMode: "multiply", background: "transparent" }} />
        <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", width: 46, height: 18, background: isDark ? "rgba(255,250,200,0.22)" : "rgba(255,253,200,0.65)", borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.10)", pointerEvents: "none", zIndex: 0 }} />

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", height: 34, padding: "0 9px", gap: 5, borderRadius: "14px 14px 0 0", background: "rgba(0,0,0,0.07)" }}>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <Dot color="#34c759" title="Full screen" onClick={() => setIsFullscreen(true)}>{hovered && <ExpandIcon />}</Dot>
            <Dot color="#f5c542" title="Edit" onClick={() => enterEdit("title")}>{hovered && <PenIcon />}</Dot>
            <Dot color={note.locked ? "#5c6bc0" : (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.18)")} title={note.locked ? "Unlock" : "Lock"} onClick={() => updateNote(note.id, { locked: !note.locked })}>
              {hovered && (note.locked ? <LockClosedIcon /> : <LockOpenIcon />)}
            </Dot>
          </div>
          <div className="note-drag-handle" style={{ flex: 1, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }} {...bindDrag()}>
            {hovered && !note.locked && !isEditing && (
              <div style={{ display: "flex", gap: 3 }}>{[0,1,2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: textColor, opacity: 0.3 }} />)}</div>
            )}
          </div>
          <Dot color="#ff453a" title="Delete" onClick={() => setShowDelete(true)} extraStyle={{ opacity: hovered ? 1 : 0.45, transition: "opacity 200ms" }}>{hovered && <TrashIcon />}</Dot>
        </div>

        {/* ── Content ── */}
        {isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", height: visualH - 34, padding: "7px 11px 9px" }} onPointerDown={(e) => e.stopPropagation()}>
            <input
              ref={titleRef}
              value={editTitle}
              placeholder="Title"
              onChange={(e) => { setEditTitle(e.target.value); scheduleEdit(e.target.value, editBody); }}
              onBlur={(e) => {
                // Only exit edit if focus is leaving the entire note (not just moving to body)
                if (e.relatedTarget === bodyRef.current) return;
                exitEdit();
              }}
              onKeyDown={(e) => {
                if (e.key === "Tab") { e.preventDefault(); setEditFocus("body"); bodyRef.current?.focus(); }
                if (e.key === "Escape") exitEdit();
              }}
              style={{ background: "transparent", border: "none", outline: "none", fontWeight: 700, fontSize: 14, color: textColor, letterSpacing: "-0.01em", fontFamily: "inherit", width: "100%", padding: 0, marginBottom: 5, cursor: "text" }}
            />
            <div style={{ width: "100%", height: 1, background: `${textColor}22`, marginBottom: 6, flexShrink: 0 }} />
            <textarea
              ref={bodyRef}
              value={editBody}
              placeholder="- bullet  |  1. numbered  |  [ ] todo  |  Ctrl+. bullet  |  Ctrl+/ todo"
              onChange={(e) => { setEditBody(e.target.value); scheduleEdit(editTitle, e.target.value); }}
              onBlur={(e) => {
                if (e.relatedTarget === titleRef.current) return;
                exitEdit();
              }}
              onKeyDown={handleBodyKeyDown}
              style={{
                background: "transparent", border: "none", outline: "none", resize: "none",
                fontSize: 13, fontWeight: 400, color: textColor, fontFamily: "inherit",
                lineHeight: "1.55", width: "100%", flex: 1, padding: 0, cursor: "text",
                backgroundImage: `repeating-linear-gradient(transparent, transparent 19px, ${lineColor} 19px, ${lineColor} 20.5px)`,
                backgroundSize: "100% 20.5px",
              }}
            />
          </div>
        ) : (
          <div style={{ height: visualH - 34, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Title */}
            <div className="note-title-clickable" onClick={() => enterEdit("title")} style={{ padding: "7px 11px 3px", fontWeight: 700, fontSize: 14, color: textColor, letterSpacing: "-0.01em", flexShrink: 0, cursor: "text" }}>
              <div style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {note.title || <span style={{ color: phColor, fontWeight: 500 }}>Title</span>}
              </div>
            </div>
            {/* Body — rich text view */}
            <div
              className="note-body-clickable"
              onClick={() => enterEdit("body")}
              style={{
                padding: "2px 11px 9px", fontSize: 13, flex: 1, overflow: "hidden", cursor: "text",
                backgroundImage: `repeating-linear-gradient(transparent, transparent 19px, ${lineColor} 19px, ${lineColor} 20.5px)`,
                backgroundSize: "100% 20.5px",
              }}
            >
              {note.body
                ? <BodyRenderer body={note.body} textColor={textColor} onToggle={toggleTodo} />
                : <span style={{ color: phColor, lineHeight: "1.55" }}>Tap to write...</span>
              }
            </div>
          </div>
        )}

        {/* Badges */}
        {note.badges.length > 0 && (
          <div style={{ position: "absolute", bottom: -16, right: 8, display: "flex", gap: 2, zIndex: 5, pointerEvents: "auto" }}>
            {note.badges.map((bid) => {
              const badge = allBadges.find((b) => b.id === bid);
              if (!badge) return null;
              const { Icon } = badge;
              return (
                <div key={bid} title={badge.label} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))", transition: "transform 120ms" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.18) translateY(-2px)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                >
                  <Icon size={28} />
                </div>
              );
            })}
          </div>
        )}

        {/* Visible handles */}
        {!note.locked && hovered && !isEditing && (
          <VisibleResizeHandle note={note} G={G} accent={theme.accent} onPixelUpdate={setResizeDims} onGridCommit={(p) => { updateNote(note.id, p); setResizeDims(null); }} onStayHovered={onNoteEnter} />
        )}
        {!note.locked && hovered && !isEditing && (
          <RotationHandle note={note} G={G} panX={panX} panY={panY} accent={theme.accent} onRotate={(r) => updateNote(note.id, { rotation: r })} onStayHovered={onNoteEnter} />
        )}
      </div>

      {/* Portals */}
      {contextMenu && createPortal(<NoteContextMenu x={contextMenu.x} y={contextMenu.y} noteId={note.id} noteBadges={note.badges} onEdit={() => enterEdit("title")} onDelete={() => setShowDelete(true)} onClose={() => setContextMenu(null)} />, document.body)}
      {isFullscreen && createPortal(<NoteFullscreen note={note} theme={theme} originX={originX} originY={originY} onClose={() => setIsFullscreen(false)} />, document.body)}
      {showDelete && createPortal(<DeleteConfirm noteTitle={note.title} onConfirm={() => { deleteNote(note.id); setShowDelete(false); }} onCancel={() => setShowDelete(false)} />, document.body)}
    </>
  );
}

// ── Rich text view renderer ─────────────────────────────────────

function BodyRenderer({ body, textColor, onToggle }: { body: string; textColor: string; onToggle: (i: number) => void }) {
  const lines = body.split("\n");
  return (
    <div style={{ lineHeight: "1.55" }}>
      {lines.map((line, i) => {
        const { type, content, num } = detectLine(line);

        if (type === "bullet") return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, minHeight: "1.55em" }}>
            <span style={{ color: textColor, opacity: 0.55, flexShrink: 0, marginTop: "0.12em", fontSize: 15 }}>•</span>
            <span style={{ color: textColor }}>{content || " "}</span>
          </div>
        );

        if (type === "todo-open") return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, minHeight: "1.55em" }}>
            <button onClick={(e) => { e.stopPropagation(); onToggle(i); }} style={{ flexShrink: 0, marginTop: "0.2em", width: 13, height: 13, border: `1.5px solid ${textColor}`, borderRadius: 3, background: "transparent", cursor: "pointer", padding: 0, opacity: 0.65 }} />
            <span style={{ color: textColor }}>{content || " "}</span>
          </div>
        );

        if (type === "todo-done") return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, minHeight: "1.55em" }}>
            <button onClick={(e) => { e.stopPropagation(); onToggle(i); }} style={{ flexShrink: 0, marginTop: "0.2em", width: 13, height: 13, border: `1.5px solid ${textColor}`, borderRadius: 3, background: textColor, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><polyline points="1,4 3,6.5 7,1.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span style={{ color: textColor, textDecoration: "line-through", opacity: 0.5 }}>{content || " "}</span>
          </div>
        );

        if (type === "numbered") return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 5, minHeight: "1.55em" }}>
            <span style={{ color: textColor, opacity: 0.5, flexShrink: 0, minWidth: "1.8em", textAlign: "right", fontSize: 12, marginTop: "0.08em" }}>{num}.</span>
            <span style={{ color: textColor }}>{content || " "}</span>
          </div>
        );

        return <div key={i} style={{ color: textColor, minHeight: "1.55em" }}>{line || " "}</div>;
      })}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function Dot({ color, title, onClick, children, extraStyle }: { color: string; title: string; onClick: () => void; children?: React.ReactNode; extraStyle?: React.CSSProperties }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} title={title} style={{ width: 15, height: 15, borderRadius: "50%", background: color, border: "none", cursor: "pointer", padding: 0, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", ...extraStyle }}>
      {children}
    </button>
  );
}

function VisibleResizeHandle({ note, G, accent, onPixelUpdate, onGridCommit, onStayHovered }: { note: NoteType; G: number; accent: string; onPixelUpdate: (d: { x: number; y: number; w: number; h: number }) => void; onGridCommit: (p: Partial<NoteType>) => void; onStayHovered: () => void }) {
  const start = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const [active, setActive] = useState(false);
  const [live, setLive] = useState({ w: note.w, h: note.h });
  const bind = useGesture({
    onDragStart: () => { setActive(true); start.current = { x: note.x * G, y: note.y * G, w: note.w * G, h: note.h * G }; },
    onDrag: ({ movement: [mx, my] }) => { const s = start.current; const min = 4*G; const nw=Math.max(min,s.w-mx),nh=Math.max(min,s.h+my); onPixelUpdate({ x: s.x+(s.w-nw), y: s.y, w: nw, h: nh }); setLive({ w: Math.round(nw/G), h: Math.round(nh/G) }); },
    onDragEnd: ({ movement: [mx, my] }) => { const s = start.current; const min=4*G; const nw=Math.max(min,s.w-mx),nh=Math.max(min,s.h+my); onGridCommit({ x: Math.round((s.x+(s.w-nw))/G), y: Math.round(s.y/G), w: Math.max(4,Math.round(nw/G)), h: Math.max(4,Math.round(nh/G)) }); setActive(false); },
  }, { drag: { filterTaps: true } });
  return (
    <div {...bind()} onMouseEnter={onStayHovered} title="Drag to resize" style={{ position: "absolute", bottom: -36, left: -36, width: 36, height: 36, borderRadius: "50%", cursor: "sw-resize", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20 }}>
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: active ? accent : "rgba(92,107,192,0.8)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? `0 0 0 3px ${accent}44` : "0 2px 6px rgba(0,0,0,0.2)", transition: "background 150ms" }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="2" y1="11" x2="11" y2="2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/><polyline points="2,7 2,11 6,11" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><polyline points="11,6 11,2 7,2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      {active && <div style={{ position: "absolute", bottom: 38, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.78)", color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 5, whiteSpace: "nowrap", pointerEvents: "none" }}>{live.w} × {live.h}</div>}
    </div>
  );
}

function RotationHandle({ note, G, panX, panY, accent, onRotate, onStayHovered }: { note: NoteType; G: number; panX: number; panY: number; accent: string; onRotate: (r: number) => void; onStayHovered: () => void }) {
  const startRef = useRef({ startAngle: 0, startRotation: 0 });
  const [active, setActive] = useState(false);
  const [display, setDisplay] = useState(note.rotation);
  const cx = () => note.x * G + note.w * G / 2 + panX;
  const cy = () => note.y * G + note.h * G / 2 + panY;
  const bind = useGesture({
    onDragStart: ({ xy: [mx, my] }) => { setActive(true); startRef.current = { startAngle: Math.atan2(my-cy(), mx-cx()), startRotation: note.rotation }; },
    onDrag: ({ xy: [mx, my] }) => { const ca=Math.atan2(my-cy(),mx-cx()); const delta=(ca-startRef.current.startAngle)*(180/Math.PI); const raw=startRef.current.startRotation+delta; const n=((raw%360)+360)%360; const s=Math.round((n>180?n-360:n)*2)/2; setDisplay(s); onRotate(s); },
    onDragEnd: () => setActive(false),
  }, { drag: { filterTaps: true } });
  return (
    <div {...bind()} onMouseEnter={onStayHovered} onClick={(e) => { e.stopPropagation(); onRotate(0); setDisplay(0); }} title={`${display.toFixed(1)}° — drag to rotate · click to reset`} style={{ position: "absolute", bottom: -36, right: -36, width: 36, height: 36, borderRadius: "50%", cursor: active ? "grabbing" : "grab", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20 }}>
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: active ? accent : "rgba(92,107,192,0.8)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? `0 0 0 3px ${accent}44` : "0 2px 6px rgba(0,0,0,0.2)", transition: "background 150ms" }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M10.5 6.5A4 4 0 012.5 6.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><polyline points="10.5,4 10.5,6.5 8,6.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      {active && <div style={{ position: "absolute", bottom: 38, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.78)", color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 5, whiteSpace: "nowrap", pointerEvents: "none" }}>{display.toFixed(1)}°</div>}
    </div>
  );
}

function ExpandIcon()     { return <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><polyline points="3.5,1 1,1 1,3.5" stroke="rgba(0,0,0,0.55)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><polyline points="5.5,8 8,8 8,5.5" stroke="rgba(0,0,0,0.55)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function PenIcon()        { return <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M6 1.5L7.5 3 3 7.5H1.5V6L6 1.5Z" stroke="rgba(0,0,0,0.55)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function LockClosedIcon() { return <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><rect x="1.5" y="4.5" width="6" height="3.5" rx="0.8" stroke="rgba(255,255,255,0.7)" strokeWidth="1.1"/><path d="M3 4.5V3A1.5 1.5 0 016 3v1.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.1" strokeLinecap="round"/></svg>; }
function LockOpenIcon()   { return <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><rect x="1.5" y="4.5" width="6" height="3.5" rx="0.8" stroke="rgba(0,0,0,0.45)" strokeWidth="1.1"/><path d="M3 4.5V3A1.5 1.5 0 016 3" stroke="rgba(0,0,0,0.45)" strokeWidth="1.1" strokeLinecap="round"/></svg>; }
function TrashIcon()      { return <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><line x1="1" y1="2.5" x2="8" y2="2.5" stroke="rgba(0,0,0,0.55)" strokeWidth="1.1" strokeLinecap="round"/><path d="M3 2.5V1.5h3v1M2.5 2.5l.5 5h3l.5-5" stroke="rgba(0,0,0,0.55)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
