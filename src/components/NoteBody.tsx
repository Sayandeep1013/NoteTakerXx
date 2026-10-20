"use client";

import { memo } from "react";
import { detectLine } from "@/lib/noteText";

const TickIcon = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
    <polyline points="1,4 3,6.5 7,1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Read-only rendering of a note body: bullets, numbered lists and clickable todos. */
function NoteBody({ body, fontSize, lineHeight, onToggleTodo }: {
  body: string;
  fontSize: number;
  lineHeight: number;
  onToggleTodo: (lineIndex: number) => void;
}) {
  return (
    <div style={{ fontSize, lineHeight: `${lineHeight}px` }}>
      {body.split("\n").map((line, i) => {
        const { type, content, num } = detectLine(line);
        if (type === "plain") return <div key={i} style={{ minHeight: lineHeight }}>{line || " "}</div>;
        const done = type === "todo-done";
        return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, minHeight: lineHeight }}>
            {type === "bullet" && <span aria-hidden="true" style={{ flexShrink: 0, width: "0.34em", height: "0.34em", marginTop: (lineHeight - fontSize * 0.34) / 2, marginInline: "0.2em 0.1em", borderRadius: "50%", background: "currentColor", opacity: 0.6 }} />}
            {type === "numbered" && <span style={{ opacity: 0.55, flexShrink: 0, minWidth: "1.4em", textAlign: "right" }}>{num}.</span>}
            {(type === "todo-open" || done) && (
              <button
                className="todo-box"
                data-done={done}
                aria-label={done ? "Mark as not done" : "Mark as done"}
                style={{ width: Math.round(fontSize * 0.95), height: Math.round(fontSize * 0.95), marginTop: (lineHeight - fontSize) / 2 + 1 }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggleTodo(i); }}
              >
                {done && <TickIcon />}
              </button>
            )}
            <span style={done ? { textDecoration: "line-through", opacity: 0.5 } : undefined}>{content || " "}</span>
          </div>
        );
      })}
    </div>
  );
}

export default memo(NoteBody);
