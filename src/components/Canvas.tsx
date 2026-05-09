"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNotesStore } from "@/store/notes";
import Note from "./Note";
import DotGrid from "./DotGrid";
import Sidebar from "./Sidebar";
import ResourceMonitor from "./ResourceMonitor";
import ConnectionLayer from "./ConnectionLayer";
import UniversalSearch from "./UniversalSearch";
import { useHudScale } from "@/hooks/useHudScale";
import { useTheme } from "@/hooks/useTheme";
import { NOTE_COLOR_KEYS, type NoteColor } from "@/lib/colors";
import upiQr from "../../images/upi qr.jpeg";

const SHOW_COFFEE_BUTTON = true;

function randomNoteColor(): NoteColor {
  return NOTE_COLOR_KEYS[Math.floor(Math.random() * NOTE_COLOR_KEYS.length)];
}

export default function Canvas() {
  const { notes, canvas, setPan, addNote, connectionMode, setConnectionMode, badgeFilter, coffeeVisible, setCoffeeVisible } = useNotesStore();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const panState = useRef({ active: false, startX: 0, startY: 0, panX: 0, panY: 0 });
  const panRef = useRef({ x: canvas.panX, y: canvas.panY });
  panRef.current = { x: canvas.panX, y: canvas.panY };
  const [cursor, setCursor] = useState<"default" | "grabbing">("default");
  const hudScale = useHudScale();

  // Load initial pan position
  useEffect(() => {
    try {
      const saved = localStorage.getItem("canvas-pan");
      if (saved) {
        const { panX, panY } = JSON.parse(saved);
        if (typeof panX === "number" && typeof panY === "number") {
          setPan(panX, panY);
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save pan position when it changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("canvas-pan", JSON.stringify(canvas));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [canvas]);

  // Non-passive wheel to preventDefault and pan
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setPan(panRef.current.x - e.deltaX, panRef.current.y - e.deltaY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape cancels connection mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && connectionMode) setConnectionMode(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectionMode, setConnectionMode]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only activate pan on the backdrop (canvas-pan-layer), not on notes
    const target = e.target as HTMLElement;
    if (!target.classList.contains("canvas-pan-layer")) return;
    panState.current = { active: true, startX: e.clientX, startY: e.clientY, panX: canvas.panX, panY: canvas.panY };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setCursor("grabbing");
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panState.current.active) return;
    setPan(panState.current.panX + e.clientX - panState.current.startX, panState.current.panY + e.clientY - panState.current.startY);
  };

  const onPointerUp = () => { panState.current.active = false; setCursor("default"); };
  const visibleNotes = badgeFilter ? notes.filter((note) => note.badges.includes(badgeFilter)) : notes;

  return (
    <div
      ref={surfaceRef}
      className="canvas-surface"
      style={{ cursor, userSelect: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* SVG noise filter */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id="paper-noise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
      </svg>

      {/* Reactive dot grid — always covers full viewport */}
      <DotGrid />

      {/* Pan backdrop — sits above dot grid, BELOW canvas-world.
          Receives pointer events only when no note is under cursor
          (notes have pointer-events: auto and stop propagation) */}
      <div
        className="canvas-pan-layer"
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
      />

      {/* World — pointer-events: none; notes re-enable with inline pointerEvents: auto */}
      <div
        className="canvas-world"
        style={{ transform: `translate(${canvas.panX}px, ${canvas.panY}px)`, zIndex: 2 }}
      >
        <ConnectionLayer notes={visibleNotes} gridUnit={80} />
        {visibleNotes.map((note) => (
          <Note key={note.id} note={note} gridUnit={80} />
        ))}
      </div>

      {/* Vignette — subtle depth at canvas edges */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3,
        background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.07) 100%)",
      }} />

      <div
        style={{
          position: "fixed",
          bottom: 32,
          right: 32,
          zIndex: 510,
          transform: `scale(${hudScale})`,
          transformOrigin: "bottom right",
        }}
      >
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "var(--accent)",
          animation: "pulse-ring 2.4s ease-out infinite",
          pointerEvents: "none",
        }} />
        <button
          onClick={addNote}
          title="New note"
          style={{
            position: "relative",
            width: 52, height: 52, borderRadius: "50%",
            background: "var(--accent)",
            border: "none",
            color: "#fff",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 150ms, box-shadow 150ms",
            boxShadow: "0 4px 20px rgba(92,107,192,0.45)",
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget as HTMLElement;
            b.style.transform = "scale(1.08)";
            b.style.boxShadow = "0 6px 28px rgba(92,107,192,0.6)";
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget as HTMLElement;
            b.style.transform = "scale(1)";
            b.style.boxShadow = "0 4px 20px rgba(92,107,192,0.45)";
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M11 4.5v13M4.5 11h13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {SHOW_COFFEE_BUTTON && coffeeVisible && <CoffeeButton onHide={() => setCoffeeVisible(false)} />}

      {/* Connection mode indicator */}
      {connectionMode && (
        <div
          onClick={() => setConnectionMode(null)}
          style={{
            position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
            background: "rgba(231,76,60,0.92)",
            backdropFilter: "blur(12px)",
            color: "#fff", fontSize: 12, fontWeight: 600,
            padding: "7px 18px", borderRadius: 20,
            zIndex: 490, cursor: "pointer",
            boxShadow: "0 4px 16px rgba(231,76,60,0.4)",
            letterSpacing: "0.02em",
          }}
        >
          Shift+click another note to connect — click here or press Esc to cancel
        </div>
      )}

      <Sidebar />
      <UniversalSearch />
      <ResourceMonitor />
    </div>
  );
}

function CoffeeButton({ onHide }: { onHide: () => void }) {
  const theme = useTheme();
  const isDark = theme.isDark;
  const [open, setOpen] = useState(false);
  const [qrMissing, setQrMissing] = useState(false);
  const [paperColor, setPaperColor] = useState<NoteColor>(() => randomNoteColor());
  const paper = theme.noteColors[paperColor] ?? theme.noteColors.yellow;
  const line = isDark ? "rgba(0,0,0,0.20)" : "rgba(0,0,0,0.085)";
  const text = theme.noteText;
  const muted = isDark ? "rgba(240,234,216,0.62)" : "rgba(26,26,26,0.56)";
  const frosted = isDark ? "rgba(18,18,22,0.24)" : "rgba(255,255,255,0.42)";
  const frostedBorder = isDark ? "rgba(255,245,220,0.14)" : "rgba(0,0,0,0.12)";

  return (
    <>
      <button
        onClick={() => {
          setPaperColor(randomNoteColor());
          setOpen(true);
        }}
        title="Buy me a coffee"
        style={{
          position: "fixed",
          right: 36,
          bottom: 98,
          zIndex: 500,
          width: 44,
          height: 44,
          padding: 0,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(18,18,22,0.78)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
          transition: "transform 150ms, box-shadow 150ms",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 10px 34px rgba(0,0,0,0.28)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,0.22)";
        }}
      >
        <CoffeeCupIcon />
      </button>

      {open && createPortal(
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0,
            zIndex: 700,
            background: isDark ? "rgba(0,0,0,0.58)" : "rgba(20,18,24,0.36)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "min(360px, 92vw)",
              borderRadius: 16,
              padding: "34px 28px 24px",
              background: paper,
              backgroundImage: `repeating-linear-gradient(transparent, transparent 23px, ${line} 23px, ${line} 24.5px)`,
              backgroundSize: "100% 24.5px",
              color: text,
              boxShadow: isDark ? "0 42px 120px rgba(0,0,0,0.76)" : "0 36px 96px rgba(0,0,0,0.26)",
              animation: "coffeeIn 220ms cubic-bezier(0.34,1.4,0.64,1)",
              textAlign: "center",
              transform: "rotate(-0.65deg)",
            }}
          >
            <div style={{
              position: "absolute",
              top: -10,
              left: "50%",
              transform: "translateX(-50%)",
              width: 62,
              height: 21,
              borderRadius: 3,
              background: isDark ? "rgba(255,250,200,0.24)" : "rgba(255,253,200,0.68)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            }} />
            <button
              onClick={() => setOpen(false)}
              style={{
                position: "absolute",
                top: 10,
                right: 12,
                width: 26, height: 26, borderRadius: "50%",
                border: `1px solid ${frostedBorder}`,
                background: frosted,
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                cursor: "pointer", color: muted,
                fontSize: 16, lineHeight: "26px",
              }}
            >
              x
            </button>
            <h2 style={{ margin: "0 0 16px", fontSize: 20, color: text }}>Buy me a coffee</h2>
            <div style={{
              width: 220,
              height: 220,
              margin: "0 auto 18px",
              borderRadius: 14,
              background: frosted,
              border: `1px solid ${frostedBorder}`,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}>
              {qrMissing ? (
                <div style={{ padding: 18, fontSize: 12, lineHeight: 1.45, color: muted }}>
                  Add your UPI QR image as <strong>public/upi-qr.png</strong>
                </div>
              ) : (
                <img
                  src={upiQr.src}
                  alt="UPI QR code"
                  onError={() => setQrMissing(true)}
                  style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }}
                />
              )}
            </div>
            <div
              style={{
                width: "100%",
                minHeight: 38,
                padding: "6px 8px 6px 12px",
                borderRadius: 10,
                border: `1px solid ${frostedBorder}`,
                background: frosted,
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                color: text,
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                boxSizing: "border-box",
              }}
            >
              <span style={{ fontSize: 12, color: muted }}>Hide coffee button?</span>
              <span style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => { onHide(); setOpen(false); }}
                  title="Hide coffee button"
                  style={{
                    width: 30,
                    height: 28,
                    borderRadius: 9,
                    border: `1px solid ${theme.accent}`,
                    background: `${theme.accent}26`,
                    color: theme.accent,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <HandCheckIcon />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  title="Keep coffee button"
                  style={{
                    width: 30,
                    height: 28,
                    borderRadius: 9,
                    border: `1px solid ${frostedBorder}`,
                    background: frosted,
                    color: muted,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <HandCrossIcon />
                </button>
              </span>
            </div>
          </div>
          <style>{`
            @keyframes coffeeIn {
              from { opacity: 0; transform: scale(0.95) translateY(8px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
        </div>,
        document.body
      )}
    </>
  );
}

function CoffeeCupIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9.2h9.4v4.7c0 2.5-1.8 4.1-4.7 4.1S6 16.4 6 13.9V9.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.4 10.5h1.4c1.4 0 2.3.8 2.3 1.9s-.9 2-2.3 2h-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.2 6.1c-.4-.8.5-1.2.2-2M11.2 6.1c-.4-.8.5-1.2.2-2M14.1 6.1c-.4-.8.5-1.2.2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 20h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function HandCheckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3.6 9.4c1.2 1.1 2.4 2.5 3.4 3.4 1.7-2.9 4.2-5.7 7.3-8.1" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.2 9.1c1.1 1 2 2.1 2.8 2.8" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

function HandCrossIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4.4 4.8c2.8 2.5 5.6 5.5 8.9 8.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M13.1 4.5c-2.4 2.8-5.6 5.5-8.4 8.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
