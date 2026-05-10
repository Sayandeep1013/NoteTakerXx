"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { NOTE_COLOR_KEYS, type NoteColor } from "@/lib/colors";

interface Props {
  noteTitle: string;
  itemType?: "note" | "folder" | "photo";
  detail?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirm({ noteTitle, itemType = "note", detail, onConfirm, onCancel }: Props) {
  const theme = useTheme();
  const [colorKey] = useState<NoteColor>(() => NOTE_COLOR_KEYS[Math.floor(Math.random() * NOTE_COLOR_KEYS.length)]);
  const bg = theme.noteColors[colorKey] ?? "#ffab91";
  const text = theme.noteText;
  const line = theme.isDark ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.10)";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0,
        background: theme.isDark ? "rgba(0,0,0,0.56)" : "rgba(20,18,24,0.36)",
        zIndex: 400,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          background: bg,
          color: text,
          borderRadius: 15,
          padding: "34px 28px 24px",
          width: 360,
          transform: "rotate(-1.2deg)",
          animation: "delIn 190ms cubic-bezier(0.34,1.35,0.64,1)",
          boxShadow: theme.isDark ? "0 24px 70px rgba(0,0,0,0.6)" : "0 24px 70px rgba(0,0,0,0.22)",
          backgroundImage: `repeating-linear-gradient(transparent, transparent 23px, ${line} 23px, ${line} 24.5px)`,
          backgroundSize: "100% 24.5px",
        }}
      >
        <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", width: 54, height: 20, background: theme.isDark ? "rgba(255,250,200,0.24)" : "rgba(255,253,200,0.66)", borderRadius: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }} />
        <p style={{ margin: "0 0 8px", fontWeight: 850, fontSize: 18, color: text }}>
          Delete this {itemType}?
        </p>
        <p style={{ margin: "0 0 26px", fontSize: 13, lineHeight: 1.55, color: text, opacity: 0.72 }}>
          {detail ?? `${noteTitle ? `"${noteTitle}"` : `This ${itemType}`} will be permanently removed.`}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 18px", borderRadius: 9,
              background: "rgba(255,255,255,0.24)", border: `1px solid ${text}22`,
              color: text, cursor: "pointer", fontSize: 13, fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 18px", borderRadius: 9,
              background: "rgba(210,55,55,0.88)", border: "none",
              color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <style>{`
        @keyframes delIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
