"use client";

import { useEffect } from "react";

interface Props {
  noteTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirm({ noteTitle, onConfirm, onCancel }: Props) {
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
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(2px)",
        zIndex: 400,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1e1e1e",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          padding: "28px 32px",
          width: 340,
          animation: "delIn 150ms ease-out",
        }}
      >
        <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: 16, color: "#eee" }}>
          Delete this note?
        </p>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#888" }}>
          {noteTitle ? `"${noteTitle}"` : "This note"} will be permanently removed.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 18px", borderRadius: 8,
              background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
              color: "#ccc", cursor: "pointer", fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 18px", borderRadius: 8,
              background: "#e57373", border: "none",
              color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
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
