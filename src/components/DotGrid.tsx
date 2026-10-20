"use client";

import { useEffect, useRef } from "react";
import { useNotesStore } from "@/store/notes";
import { THEMES } from "@/lib/themes";

const DOT_SPACING   = 40;
const DOT_BASE_R    = 1.9;
const DOT_PEAK_R    = 5;
const BALL_RADIUS   = 110;
const PUSH_STRENGTH = 18;

// Ball-under-cloth model:
//   t      = linear falloff 1→0 from centre to edge of the ball
//   liftT  = t²          → size/colour glow, max at the crown
//   pushT  = 4·t·(1-t)   → outward push, peaks at the equator

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Background dot grid that reacts to the mouse.
 *  - Resting dots are drawn once into a layer one grid cell larger than the
 *    viewport. The grid is periodic, so panning only translates that layer by
 *    (pan mod spacing) — a compositor move, no repaint. It redraws on zoom,
 *    theme or resize only.
 *  - Under the cursor, the resting dots are punched out of that layer (and
 *    restored when the cursor moves on) while an overlay canvas draws the
 *    lifted/pushed versions — only a few dozen dots change per frame.
 */
export default function DotGrid() {
  const layerRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const cvs = canvasRef.current;
    const ctx = cvs?.getContext("2d");
    const lctx = layer?.getContext("2d");
    if (!layer || !lctx || !cvs || !ctx) return;

    const fineHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const interactive = () => fineHover.matches && !reducedMotion.matches;

    let W = 0, H = 0, dpr = 1;
    let mouse = { x: -1e5, y: -1e5 };
    let dirty: { x: number; y: number; w: number; h: number } | null = null;
    let raf = 0;
    let lastLayerKey = "";
    let holes: { x: number; y: number }[] = []; // resting dots currently punched out (layer coords)

    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      cvs.width = Math.round(W * dpr);
      cvs.height = Math.round(H * dpr);
      cvs.style.width = `${W}px`;
      cvs.style.height = `${H}px`;
      dirty = null;
      lastLayerKey = "";
      schedule();
    };

    function draw() {
      raf = 0;
      const s = useNotesStore.getState();
      const { panX: px, panY: py } = s.canvas;
      const z = s.canvas.zoom || 1;
      const theme = THEMES[s.theme];
      const spacing = Math.max(8, DOT_SPACING * z);
      const baseR = Math.max(0.8, DOT_BASE_R * Math.sqrt(z));
      const peakR = Math.max(baseR + 1, DOT_PEAK_R * Math.sqrt(z));
      const [br, bg, bb, ba] = theme.dotBase;
      const [hr, hg, hb, ha] = theme.dotHot;
      const baseColor = `rgba(${br},${bg},${bb},${ba})`;

      // Resting grid: repaint only when its geometry/colour changes; panning just shifts it.
      const layerKey = `${spacing}|${baseR}|${baseColor}|${W}|${H}|${dpr}`;
      if (layerKey !== lastLayerKey) {
        lastLayerKey = layerKey;
        const lw = W + spacing * 2, lh = H + spacing * 2;
        layer!.width = Math.round(lw * dpr);
        layer!.height = Math.round(lh * dpr);
        layer!.style.width = `${lw}px`;
        layer!.style.height = `${lh}px`;
        lctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        lctx!.fillStyle = baseColor;
        lctx!.beginPath();
        for (let x = 0; x <= lw; x += spacing) {
          for (let y = 0; y <= lh; y += spacing) {
            lctx!.moveTo(x + baseR, y);
            lctx!.arc(x, y, baseR, 0, Math.PI * 2);
          }
        }
        lctx!.fill();
        holes = [];
      }
      const mod = (v: number) => ((v % spacing) + spacing) % spacing;
      const ox = mod(px) - spacing, oy = mod(py) - spacing;
      layer!.style.transform = `translate3d(${ox}px, ${oy}px, 0)`;

      // Restore the dots punched out last frame.
      if (holes.length) {
        lctx!.fillStyle = baseColor;
        lctx!.beginPath();
        for (const h of holes) { lctx!.moveTo(h.x + baseR, h.y); lctx!.arc(h.x, h.y, baseR, 0, Math.PI * 2); }
        lctx!.fill();
        holes = [];
      }

      const c = ctx!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (dirty) c.clearRect(dirty.x, dirty.y, dirty.w, dirty.h);
      dirty = null;

      const { x: mx, y: my } = mouse;
      const reach = BALL_RADIUS + PUSH_STRENGTH + peakR + 2;
      if (mx < -reach || my < -reach || mx > W + reach || my > H + reach) return;
      dirty = { x: mx - reach, y: my - reach, w: reach * 2, h: reach * 2 };

      const c0 = Math.floor((mx - BALL_RADIUS - px) / spacing), c1 = Math.ceil((mx + BALL_RADIUS - px) / spacing);
      const r0 = Math.floor((my - BALL_RADIUS - py) / spacing), r1 = Math.ceil((my + BALL_RADIUS - py) / spacing);
      const hot: { x: number; y: number; r: number; color: string }[] = [];

      // 1) Punch the resting dots inside the ball out of the grid layer…
      lctx!.globalCompositeOperation = "destination-out";
      lctx!.fillStyle = "#000"; // opaque, so destination-out removes the dot completely
      lctx!.beginPath();
      for (let col = c0; col <= c1; col++) {
        const x = col * spacing + px;
        for (let row = r0; row <= r1; row++) {
          const y = row * spacing + py;
          const dist = Math.hypot(x - mx, y - my);
          if (dist >= BALL_RADIUS || dist === 0) continue;
          const hx = x - ox, hy = y - oy;
          lctx!.moveTo(hx + baseR + 1, hy);
          lctx!.arc(hx, hy, baseR + 1, 0, Math.PI * 2);
          holes.push({ x: hx, y: hy });
          const t = 1 - dist / BALL_RADIUS;
          const lift = t * t;
          const mag = s.dotGridEffect ? (PUSH_STRENGTH * 4 * t * (1 - t)) / dist : 0;
          hot.push({
            x: x + (x - mx) * mag,
            y: y + (y - my) * mag,
            r: lerp(baseR, peakR, lift),
            color: `rgba(${Math.round(lerp(br, hr, lift))},${Math.round(lerp(bg, hg, lift))},${Math.round(lerp(bb, hb, lift))},${lerp(ba, ha, lift).toFixed(3)})`,
          });
        }
      }
      lctx!.fill();
      lctx!.globalCompositeOperation = "source-over";

      // 2) …and draw them lifted and pushed on the overlay.
      for (const d of hot) {
        c.fillStyle = d.color;
        c.beginPath();
        c.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        c.fill();
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !interactive()) return;
      mouse = { x: e.clientX, y: e.clientY };
      schedule();
    };
    const onLeave = () => { mouse = { x: -1e5, y: -1e5 }; schedule(); };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    const unsub = useNotesStore.subscribe((s, prev) => {
      if (s.canvas !== prev.canvas || s.theme !== prev.theme || s.dotGridEffect !== prev.dotGridEffect) schedule();
    });

    return () => {
      cancelAnimationFrame(raf);
      unsub();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <>
      <canvas ref={layerRef} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", zIndex: 0, willChange: "transform" }} />
      <canvas ref={canvasRef} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }} />
    </>
  );
}
