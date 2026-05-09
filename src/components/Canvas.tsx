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

const SHOW_COFFEE_BUTTON = false;

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
  const [open, setOpen] = useState(false);
  const [qrMissing, setQrMissing] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Buy me a coffee"
        style={{
          position: "fixed",
          right: 96,
          bottom: 38,
          zIndex: 500,
          height: 40,
          padding: "0 16px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(18,18,22,0.78)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: "pointer",
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
        Buy me a coffee
      </button>

      {open && createPortal(
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0,
            zIndex: 700,
            background: "rgba(0,0,0,0.48)",
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
              width: "min(340px, 92vw)",
              borderRadius: 18,
              padding: 22,
              background: "rgba(250,250,255,0.96)",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 32px 90px rgba(0,0,0,0.28)",
              animation: "coffeeIn 220ms cubic-bezier(0.34,1.4,0.64,1)",
              textAlign: "center",
            }}
          >
            <button
              onClick={() => setOpen(false)}
              style={{
                float: "right",
                width: 26, height: 26, borderRadius: "50%",
                border: "none", background: "rgba(0,0,0,0.06)",
                cursor: "pointer", color: "rgba(0,0,0,0.5)",
                fontSize: 16, lineHeight: "26px",
              }}
            >
              x
            </button>
            <div style={{ clear: "both" }} />
            <h2 style={{ margin: "0 0 16px", fontSize: 20, color: "#161616" }}>Buy me a coffee</h2>
            <div style={{
              width: 220,
              height: 220,
              margin: "0 auto 18px",
              borderRadius: 14,
              background: "rgba(0,0,0,0.045)",
              border: "1px solid rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}>
              {qrMissing ? (
                <div style={{ padding: 18, fontSize: 12, lineHeight: 1.45, color: "rgba(0,0,0,0.48)" }}>
                  Add your UPI QR image as <strong>public/upi-qr.png</strong>
                </div>
              ) : (
                <img
                  src="/upi-qr.png"
                  alt="UPI QR code"
                  onError={() => setQrMissing(true)}
                  style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }}
                />
              )}
            </div>
            <button
              onClick={() => { onHide(); setOpen(false); }}
              style={{
                width: "100%",
                height: 38,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.10)",
                background: "rgba(0,0,0,0.045)",
                color: "#242424",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "inherit",
              }}
            >
              Hide it
            </button>
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
