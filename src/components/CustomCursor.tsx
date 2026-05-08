"use client";

import { useEffect, useRef } from "react";
import { useNotesStore } from "@/store/notes";
import { useTheme } from "@/hooks/useTheme";

type Mode = "default" | "pointer" | "text" | "grab" | "grabbing" | "resize" | "badge";

const RESIZE_CURSORS = new Set([
  "n-resize","s-resize","e-resize","w-resize",
  "nw-resize","ne-resize","sw-resize","se-resize",
  "ew-resize","ns-resize","nesw-resize","nwse-resize",
]);

function detectMode(el: Element | null, badgeActive: boolean): Mode {
  if (badgeActive) return "badge";
  if (!el) return "default";
  let node: Element | null = el;
  while (node && node !== document.documentElement) {
    const cl  = (node as HTMLElement).classList;
    const tag = node.tagName;
    if (cl.contains("note-drag-handle")) return "grab";
    if (cl.contains("resize-handle"))    return "resize";
    if (tag === "INPUT" || tag === "TEXTAREA") return "text";
    if (tag === "BUTTON" || tag === "A")       return "pointer";
    if ((node as HTMLElement).getAttribute?.("role") === "button") return "pointer";
    node = node.parentElement;
  }
  const cs = window.getComputedStyle(el).cursor;
  if (cs === "pointer")    return "pointer";
  if (cs === "text")       return "text";
  if (cs === "grab")       return "grab";
  if (cs === "grabbing")   return "grabbing";
  if (RESIZE_CURSORS.has(cs)) return "resize";
  return "default";
}

// Hotspot (x, y) = how much to offset so the logical point is at the mouse
const HOTSPOT: Record<Mode, [number, number]> = {
  default:  [-4,  -3],
  pointer:  [-5,  -2],
  text:     [-5,  -11],
  grab:     [-11, -11],
  grabbing: [-11, -11],
  resize:   [-11, -11],
  badge:    [-4,  -3],
};

// SVG strings — used to innerHTML-swap without React re-renders
const SVGS: Record<Mode, (accent?: string) => string> = {
  default: () => `
    <svg width="22" height="27" viewBox="0 0 22 27" fill="none">
      <path d="M4 3 L4 21.5 L8.5 17 L12.5 25 L15.5 23.5 L11.5 16 L19.5 16 Z"
        fill="rgba(0,0,0,0.18)" transform="translate(0.7,1)"/>
      <path d="M4 3 L4 21.5 L8.5 17 L12.5 25 L15.5 23.5 L11.5 16 L19.5 16 Z"
        fill="white" stroke="#111" stroke-width="0.9" stroke-linejoin="round"/>
    </svg>`,

  pointer: () => `
    <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
      <path d="M4 18 L4 8.5 Q4 7 5.5 7 Q7 7 7 8.5 L7 9.5" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M7 9.5 L7 7 Q7 5.5 8.5 5.5 Q10 5.5 10 7 L10 9.5" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M10 9.5 L10 7 Q10 5.5 11.5 5.5 Q13 5.5 13 7 L13 9.5" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M13 9.5 L13 8 Q13 6.5 14.5 6.5 Q16 6.5 16 8 L16 14 Q16 20 11 20 Q6 20 5 17" fill="rgba(0,0,0,0.15)" stroke="none"/>

      <path d="M4 18 L4 8.5 Q4 7 5.5 7 Q7 7 7 8.5 L7 9.5" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/>
      <path d="M7 9.5 L7 7 Q7 5.5 8.5 5.5 Q10 5.5 10 7 L10 9.5" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/>
      <path d="M10 9.5 L10 7 Q10 5.5 11.5 5.5 Q13 5.5 13 7 L13 9.5" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/>
      <path d="M13 9.5 L13 8 Q13 6.5 14.5 6.5 Q16 6.5 16 8 L16 14 Q16 20 11 20 Q6 20 5 17" fill="white" stroke="#111" stroke-width="0.85" stroke-linejoin="round"/>
      <path d="M4 18 L4 8.5 Q4 7 5.5 7 Q7 7 7 8.5 L7 9.5" fill="none" stroke="#111" stroke-width="0.85" stroke-linecap="round"/>
      <path d="M7 9.5 L7 7 Q7 5.5 8.5 5.5 Q10 5.5 10 7 L10 9.5" fill="none" stroke="#111" stroke-width="0.85" stroke-linecap="round"/>
      <path d="M10 9.5 L10 7 Q10 5.5 11.5 5.5 Q13 5.5 13 7 L13 9.5" fill="none" stroke="#111" stroke-width="0.85" stroke-linecap="round"/>
      <path d="M13 9.5 L13 8 Q13 6.5 14.5 6.5 Q16 6.5 16 8" fill="none" stroke="#111" stroke-width="0.85" stroke-linecap="round"/>
    </svg>`,

  text: () => `
    <svg width="10" height="22" viewBox="0 0 10 22" fill="none">
      <line x1="1" y1="1" x2="9" y2="1" stroke="white" stroke-width="3" stroke-linecap="round"/>
      <line x1="5" y1="1" x2="5" y2="21" stroke="white" stroke-width="3" stroke-linecap="round"/>
      <line x1="1" y1="21" x2="9" y2="21" stroke="white" stroke-width="3" stroke-linecap="round"/>
      <line x1="1" y1="1" x2="9" y2="1" stroke="#111" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="5" y1="1" x2="5" y2="21" stroke="#111" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="1" y1="21" x2="9" y2="21" stroke="#111" stroke-width="1.3" stroke-linecap="round"/>
    </svg>`,

  grab: () => `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 20 L4 11 Q4 9.5 5.5 9.5 Q7 9.5 7 11 L7 13
               M7 13 L7 9 Q7 7.5 8.5 7.5 Q10 7.5 10 9 L10 11
               M10 11 L10 8 Q10 6.5 11.5 6.5 Q13 6.5 13 8 L13 11
               M13 11 L13 9 Q13 7.5 14.5 7.5 Q16 7.5 16 9 L16 15 Q16 21 11 21 Q6 21 5 18"
        fill="white" stroke="#111" stroke-width="0.9" stroke-linejoin="round"/>
    </svg>`,

  grabbing: () => `
    <svg width="24" height="22" viewBox="0 0 24 22" fill="none">
      <path d="M3 11 Q3 8 6.5 8 L17 8 Q20 8 20 11 L20 15 Q20 21 12 21 Q4 21 3 16 Z"
        fill="white" stroke="#111" stroke-width="0.9" stroke-linejoin="round"/>
    </svg>`,

  resize: () => `
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M2 20 L20 2 M2 20 L2 13 M2 20 L9 20 M20 2 L20 9 M20 2 L13 2"
        stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M2 20 L20 2 M2 20 L2 13 M2 20 L9 20 M20 2 L20 9 M20 2 L13 2"
        stroke="#111" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

  badge: (accent = "#5c6bc0") => `
    <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
      <path d="M4 3 L4 21.5 L8.5 17 L12.5 25 L15.5 23.5 L11.5 16 L19.5 16 Z"
        fill="rgba(0,0,0,0.18)" transform="translate(0.7,1)"/>
      <path d="M4 3 L4 21.5 L8.5 17 L12.5 25 L15.5 23.5 L11.5 16 L19.5 16 Z"
        fill="white" stroke="#111" stroke-width="0.9" stroke-linejoin="round"/>
      <circle cx="22" cy="8" r="6" fill="${accent}"/>
      <circle cx="22" cy="8" r="4.5" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
      <path d="M19.5 8 L21.5 10 L24.5 5.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
};

export default function CustomCursor() {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const badgeMode = useNotesStore((s) => s.badgeMode);
  const theme    = useTheme();
  // Store latest values in refs so RAF closure doesn't go stale
  const badgeModeRef = useRef(badgeMode);
  const accentRef    = useRef(theme.accent);
  badgeModeRef.current = badgeMode;
  accentRef.current    = theme.accent;

  useEffect(() => {
    // Guarantee no system cursor survives — belt + suspenders
    const styleTag = document.createElement("style");
    styleTag.textContent = "html,html *,html *::before,html *::after{cursor:none!important}";
    document.head.appendChild(styleTag);
    return () => { document.head.removeChild(styleTag); };
  }, []);

  useEffect(() => {
    let rafId: number;
    let px = -400, py = -400;
    let prevMode: Mode = "default";

    const onMove = (e: MouseEvent) => { px = e.clientX; py = e.clientY; };
    const onLeave = () => { px = -400; py = -400; };
    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);

    const frame = () => {
      const wrap = wrapRef.current;
      if (wrap) {
        const target = document.elementFromPoint(px, py);
        const mode   = detectMode(target, !!badgeModeRef.current);

        // Update inner SVG only when mode changes
        if (mode !== prevMode) {
          prevMode = mode;
          wrap.innerHTML = SVGS[mode](accentRef.current);
        }

        const [ox, oy] = HOTSPOT[mode];
        wrap.style.transform = `translate(${px + ox}px, ${py + oy}px)`;
      }
      rafId = requestAnimationFrame(frame);
    };

    // Initial render
    if (wrapRef.current) {
      wrapRef.current.innerHTML = SVGS.default();
    }
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // When badge mode or accent changes, force SVG refresh on next frame
  useEffect(() => {
    if (wrapRef.current) {
      const mode = badgeMode ? "badge" : "default";
      wrapRef.current.innerHTML = SVGS[mode](theme.accent);
    }
  }, [badgeMode, theme.accent]);

  return (
    <div style={{ position: "fixed", top: 0, left: 0, pointerEvents: "none", zIndex: 99999, willChange: "transform" }}>
      <div ref={wrapRef} style={{ display: "block", lineHeight: 0 }} />
    </div>
  );
}
