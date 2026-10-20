"use client";

import { useRef } from "react";
import { flushSync } from "react-dom";

const OPEN_RADIUS = 18;
const COMPACT_RADIUS = 16;
const COMPACT_SIZE = 50;
// Opening: the bar travels out with an ease-out while its outline grows with a gentle spring.
const OPEN_MOVE = { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
const OPEN_GROW = { duration: 560, easing: "cubic-bezier(0.3, 1.2, 0.5, 1)" };
// Closing: shrink a little ahead of the travel so it "tucks in" as it flies home.
const CLOSE_MOVE = { duration: 420, easing: "cubic-bezier(0.55, 0, 0.25, 1)" };
const CLOSE_SHRINK = { duration: 340, easing: "cubic-bezier(0.5, 0, 0.3, 1)" };
const ITEM_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

type Box = { left: number; top: number; width: number; height: number };

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** clip-path showing a w×h box centred inside the element. */
const centredClip = (full: Box, w: number, h: number, radius: number) =>
  `inset(${(full.height - h) / 2}px ${(full.width - w) / 2}px ${(full.height - h) / 2}px ${(full.width - w) / 2}px round ${radius}px)`;

/** Translation that puts the element's centre on the target's centre. */
const toward = (from: Box, to: Box) =>
  `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px, ${to.top + to.height / 2 - (from.top + from.height / 2)}px)`;

/**
 * Morphs the toolbar between its full bar and the compact button that rests
 * next to the + button. Closing shrinks the bar's outline (clip-path) to the
 * button's size while it glides to the resting spot; opening is the reverse,
 * with the icons cascading out from the centre. Only clip-path, transform and
 * opacity animate, so it stays on the compositor.
 */
export function useDockMorph() {
  const navRef = useRef<HTMLElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const restRef = useRef<HTMLSpanElement>(null);
  const busy = useRef(false);

  const fullClip = `inset(0px 0px 0px 0px round ${OPEN_RADIUS}px)`;
  const itemShift = () => (wrapRef.current?.dataset.side === "left" ? "translateX(-10px)" : "translateY(10px)");
  const items = (nav: HTMLElement) => Array.from(nav.children) as HTMLElement[];
  const cancelAll = () => navRef.current?.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  const morphing = (on: boolean) => wrapRef.current?.classList.toggle("dock-morphing", on);

  /** Fold the bar down to a compact-sized box, flying to `target` (or staying centred). */
  const fold = async (target: Box | null) => {
    const nav = navRef.current;
    if (!nav || prefersReducedMotion()) return;
    const full = nav.getBoundingClientRect();
    const list = items(nav);
    const mid = (list.length - 1) / 2;
    morphing(true);
    list.forEach((el, i) => el.animate(
      [{ opacity: 1, transform: "none" }, { opacity: 0, transform: `${itemShift()} scale(0.85)` }],
      { duration: 170, delay: (mid - Math.abs(i - mid)) * 8, easing: "ease-in", fill: "forwards" },
    ));
    const w = target?.width ?? COMPACT_SIZE, h = target?.height ?? COMPACT_SIZE;
    const runs = [nav.animate([{ clipPath: fullClip }, { clipPath: centredClip(full, w, h, COMPACT_RADIUS) }], { ...CLOSE_SHRINK, fill: "forwards" })];
    if (target) runs.push(nav.animate([{ transform: "none" }, { transform: toward(full, target) }], { ...CLOSE_MOVE, fill: "forwards" }));
    await Promise.all(runs.map((a) => a.finished.catch(() => {})));
  };

  /** Grow the (already rendered) full bar out of `source` (or out of its own centre). */
  const unfold = async (source: Box | null) => {
    const nav = navRef.current;
    if (!nav || prefersReducedMotion()) { morphing(false); return; }
    const full = nav.getBoundingClientRect();
    const list = items(nav);
    const mid = (list.length - 1) / 2;
    morphing(true);
    list.forEach((el, i) => el.animate(
      [{ opacity: 0, transform: `${itemShift()} scale(0.85)` }, { opacity: 1, transform: "none" }],
      { duration: 300, delay: 140 + Math.abs(i - mid) * 16, easing: ITEM_EASE, fill: "backwards" },
    ));
    const w = source?.width ?? COMPACT_SIZE, h = source?.height ?? COMPACT_SIZE;
    const runs = [nav.animate([{ clipPath: centredClip(full, w, h, COMPACT_RADIUS) }, { clipPath: fullClip }], OPEN_GROW)];
    if (source) runs.push(nav.animate([{ transform: toward(full, source) }, { transform: "none" }], OPEN_MOVE));
    await Promise.all(runs.map((a) => a.finished.catch(() => {})));
    morphing(false);
  };

  const run = async (fn: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try { await fn(); } finally { busy.current = false; }
  };

  return {
    navRef,
    wrapRef,
    /** Invisible marker for where the compact button rests (rendered while the bar is open). */
    restRef,
    /** Fly into the resting spot, then commit the compact state. */
    collapse: (commit: () => void) => run(async () => {
      await fold(restRef.current?.getBoundingClientRect() ?? null);
      flushSync(commit);
      morphing(false);
      cancelAll();
      if (!prefersReducedMotion()) {
        navRef.current?.animate([{ transform: "scale(0.88)" }, { transform: "scale(1)" }], { duration: 280, easing: "cubic-bezier(0.3, 1.4, 0.5, 1)" });
      }
    }),
    /** Commit the open state, then grow out of the compact button. */
    expand: (commit: () => void) => run(async () => {
      const from = navRef.current?.getBoundingClientRect() ?? null;
      flushSync(commit);
      await unfold(from);
    }),
    /** Fold up in place, switch edges, unfold there. */
    move: (commit: () => void) => run(async () => {
      await fold(null);
      flushSync(commit);
      cancelAll();
      await unfold(null);
    }),
  };
}
