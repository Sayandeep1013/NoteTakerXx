"use client";

import { useRef } from "react";
import { flushSync } from "react-dom";
import { spring } from "@/lib/spring";

const OPEN_RADIUS = 18;
const COMPACT_RADIUS = 16;
const COMPACT_SIZE = 50;

// Spring tunings (bounce = damping ratio: lower wobbles more).
const SPRINGS = {
  travelOut: { stiffness: 240, bounce: 0.6 },  // flies out to its edge, overshoots a touch, settles
  grow: { stiffness: 300, bounce: 0.45 },       // the bar's size wobbles as it lands
  items: { stiffness: 360, bounce: 0.5 },      // icons pop in with a little jiggle
  travelHome: { stiffness: 260, bounce: 0.62 }, // glides home, slight overshoot at the resting spot
  land: { stiffness: 500, bounce: 0.36 },       // compact button jiggles as it lands
};
const CLOSE_SHRINK = { duration: 300, easing: "cubic-bezier(0.5, 0, 0.3, 1)" };

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
 * next to the + button, on real spring curves (see lib/spring): closing shrinks
 * the bar while it springs home and the button lands with a jiggle; opening
 * springs it out to its edge where it wobbles and settles while the icons pop
 * in from the centre. Only clip-path, transform, scale, translate and opacity
 * animate, so it stays on the compositor.
 */
export function useDockMorph() {
  const navRef = useRef<HTMLElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const restRef = useRef<HTMLSpanElement>(null);
  const busy = useRef(false);

  const fullClip = `inset(0px 0px 0px 0px round ${OPEN_RADIUS}px)`;
  const itemShift = () => (wrapRef.current?.dataset.side === "left" ? "-12px 0px" : "0px 12px");
  const items = (nav: HTMLElement) => Array.from(nav.children) as HTMLElement[];
  const cancelAll = () => navRef.current?.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  const morphing = (on: boolean) => wrapRef.current?.classList.toggle("dock-morphing", on);
  const done = (anims: Animation[]) => Promise.all(anims.map((a) => a.finished.catch(() => {})));

  /** Fold the bar down to a compact-sized box, springing to `target` (or staying centred). */
  const fold = async (target: Box | null) => {
    const nav = navRef.current;
    if (!nav || prefersReducedMotion()) return;
    const full = nav.getBoundingClientRect();
    const list = items(nav);
    const mid = (list.length - 1) / 2;
    morphing(true);
    list.forEach((el, i) => el.animate(
      [{ opacity: 1, scale: "1" }, { opacity: 0, scale: "0.6" }],
      { duration: 150, delay: (mid - Math.abs(i - mid)) * 7, easing: "ease-in", fill: "forwards" },
    ));
    const w = target?.width ?? COMPACT_SIZE, h = target?.height ?? COMPACT_SIZE;
    const anims = [nav.animate([{ clipPath: fullClip }, { clipPath: centredClip(full, w, h, COMPACT_RADIUS) }], { ...CLOSE_SHRINK, fill: "forwards" })];
    if (target) anims.push(nav.animate([{ transform: "none" }, { transform: toward(full, target) }], { ...spring(SPRINGS.travelHome), fill: "forwards" }));
    await done(anims);
  };

  /** Spring the (already rendered) full bar out of `source` (or out of its own centre). */
  const unfold = async (source: Box | null) => {
    const nav = navRef.current;
    if (!nav || prefersReducedMotion()) { morphing(false); return; }
    const full = nav.getBoundingClientRect();
    const list = items(nav);
    const mid = (list.length - 1) / 2;
    const pop = spring(SPRINGS.items);
    morphing(true);
    list.forEach((el, i) => el.animate(
      [{ opacity: 0, scale: "0.4", translate: itemShift() }, { opacity: 1, scale: "1", translate: "0px 0px" }],
      { ...pop, delay: 110 + Math.abs(i - mid) * 18, fill: "backwards" },
    ));
    const w = source?.width ?? COMPACT_SIZE, h = source?.height ?? COMPACT_SIZE;
    const grow = spring(SPRINGS.grow);
    const anims = [
      nav.animate([{ clipPath: centredClip(full, w, h, COMPACT_RADIUS) }, { clipPath: fullClip }], grow),
      // Scale overshoots past 1 and back: the visible "bounce" of the bar as it lands.
      nav.animate([{ scale: "0.82" }, { scale: "1" }], grow),
    ];
    if (source) anims.push(nav.animate([{ transform: toward(full, source) }, { transform: "none" }], spring(SPRINGS.travelOut)));
    await done(anims);
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
    /** Spring into the resting spot, commit the compact state, land with a jiggle. */
    collapse: (commit: () => void) => run(async () => {
      await fold(restRef.current?.getBoundingClientRect() ?? null);
      flushSync(commit);
      morphing(false);
      cancelAll();
      if (!prefersReducedMotion()) navRef.current?.animate([{ scale: "0.72" }, { scale: "1" }], spring(SPRINGS.land));
    }),
    /** Commit the open state, then spring out of the compact button. */
    expand: (commit: () => void) => run(async () => {
      const from = navRef.current?.getBoundingClientRect() ?? null;
      flushSync(commit);
      await unfold(from);
    }),
    /** Fold up in place, switch edges, spring open there. */
    move: (commit: () => void) => run(async () => {
      await fold(null);
      flushSync(commit);
      cancelAll();
      await unfold(null);
    }),
  };
}
