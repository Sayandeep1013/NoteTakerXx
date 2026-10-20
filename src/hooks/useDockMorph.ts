"use client";

import { useRef } from "react";
import { flushSync } from "react-dom";
import type { DockSide } from "@/store/notes";

const OPEN_RADIUS = 18;
const COMPACT_RADIUS = 16;
const OPEN_MS = 480;
const CLOSE_MS = 300;
// Gentle spring (slight overshoot) for opening; quick ease-in for closing.
const OPEN_EASE = "cubic-bezier(0.3, 1.25, 0.5, 1)";
const CLOSE_EASE = "cubic-bezier(0.55, 0, 0.35, 1)";
const ITEM_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The toolbar morphs between its compact button and the full bar. Both share
 * one anchor (bottom-centre, or left-middle when docked left), so the morph is
 * a clip-path that grows out of / shrinks back into the compact button while
 * the icons cascade outward from the centre. Only clip-path, opacity and
 * transform animate, so it stays on the compositor.
 */
export function useDockMorph(side: DockSide) {
  const navRef = useRef<HTMLElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const compact = useRef({ w: 50, h: 50 });
  const busy = useRef(false);

  // Read the side from the DOM: after a move the closure's `side` is stale.
  const currentSide = () => (wrapRef.current?.dataset.side as DockSide | undefined) ?? side;
  const clipToCompact = (w: number, h: number) => {
    const { w: cw, h: ch } = compact.current;
    return currentSide() === "left"
      ? `inset(${(h - ch) / 2}px ${w - cw}px ${(h - ch) / 2}px 0px round ${COMPACT_RADIUS}px)`
      : `inset(${h - ch}px ${(w - cw) / 2}px 0px ${(w - cw) / 2}px round ${COMPACT_RADIUS}px)`;
  };
  const fullClip = `inset(0px 0px 0px 0px round ${OPEN_RADIUS}px)`;
  const itemShift = () => (currentSide() === "left" ? "translateX(-10px)" : "translateY(10px)");

  const begin = () => wrapRef.current?.classList.add("dock-morphing");
  const end = () => {
    wrapRef.current?.classList.remove("dock-morphing");
    navRef.current?.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  };

  /** Fold the full bar into the compact button. Resolves when it has finished. */
  const fold = async () => {
    const nav = navRef.current;
    if (!nav || prefersReducedMotion()) return;
    const { width: w, height: h } = nav.getBoundingClientRect();
    const items = Array.from(nav.children) as HTMLElement[];
    const mid = (items.length - 1) / 2;
    begin();
    items.forEach((el, i) => el.animate(
      [{ opacity: 1, transform: "none" }, { opacity: 0, transform: `${itemShift()} scale(0.85)` }],
      { duration: 160, delay: (mid - Math.abs(i - mid)) * 8, easing: "ease-in", fill: "forwards" },
    ));
    await nav.animate([{ clipPath: fullClip }, { clipPath: clipToCompact(w, h) }], { duration: CLOSE_MS, easing: CLOSE_EASE, fill: "forwards" }).finished.catch(() => {});
  };

  /** Grow the full bar (already rendered) out of the compact button. */
  const unfold = async () => {
    const nav = navRef.current;
    if (!nav || prefersReducedMotion()) { end(); return; }
    const { width: w, height: h } = nav.getBoundingClientRect();
    const items = Array.from(nav.children) as HTMLElement[];
    const mid = (items.length - 1) / 2;
    begin();
    items.forEach((el, i) => el.animate(
      [{ opacity: 0, transform: `${itemShift()} scale(0.85)` }, { opacity: 1, transform: "none" }],
      { duration: 280, delay: 70 + Math.abs(i - mid) * 16, easing: ITEM_EASE, fill: "backwards" },
    ));
    await nav.animate([{ clipPath: clipToCompact(w, h) }, { clipPath: fullClip }], { duration: OPEN_MS, easing: OPEN_EASE }).finished.catch(() => {});
    end();
  };

  /** The compact button pops in after a fold. */
  const popCompact = () => {
    const nav = navRef.current;
    if (!nav || prefersReducedMotion()) return;
    nav.animate([{ transform: "scale(0.86)" }, { transform: "scale(1)" }], { duration: 260, easing: OPEN_EASE });
  };

  const run = async (fn: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try { await fn(); } finally { busy.current = false; }
  };

  return {
    navRef,
    wrapRef,
    /** Animate closed, then commit the compact state. */
    collapse: (commit: () => void) => run(async () => {
      await fold();
      flushSync(commit);
      end();
      const r = navRef.current?.getBoundingClientRect();
      if (r) compact.current = { w: r.width, h: r.height };
      popCompact();
    }),
    /** Commit the open state, then animate it open from the compact button. */
    expand: (commit: () => void) => run(async () => {
      const r = navRef.current?.getBoundingClientRect();
      if (r) compact.current = { w: r.width, h: r.height };
      flushSync(commit);
      await unfold();
    }),
    /** Fold up, move to the other edge, unfold there. */
    move: (commit: () => void) => run(async () => {
      await fold();
      flushSync(commit);
      navRef.current?.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      await unfold();
    }),
  };
}
