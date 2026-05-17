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
//   t = linear falloff 1→0 from center to edge of ball
//   liftT  = t²           → max at center (crown of ball)
//   pushT  = 4·t·(1-t)    → peaks at t=0.5 (equator), 0 at edge

interface DotTheme {
  base: [number, number, number, number];
  hot:  [number, number, number, number];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function DotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef({ x: -9999, y: -9999 });

  const panX = useNotesStore((s) => s.canvas.panX);
  const panY = useNotesStore((s) => s.canvas.panY);
  const zoom = useNotesStore((s) => s.canvas.zoom || 1);
  const panRef = useRef({ x: 0, y: 0, zoom: 1 });
  panRef.current = { x: panX, y: panY, zoom };

  const themeKey = useNotesStore((s) => s.theme);
  const themeRef = useRef<DotTheme>({ base: [60, 50, 80, 0.22], hot: [45, 35, 140, 0.82] });
  themeRef.current = { base: THEMES[themeKey].dotBase, hot: THEMES[themeKey].dotHot };

  const dotGridEffect = useNotesStore((s) => s.dotGridEffect);
  const effectRef = useRef(true);
  effectRef.current = dotGridEffect;

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d")!;
    let rafId: number;

    const onMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", onMove);

    const resize = () => { cvs.width = window.innerWidth; cvs.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const { x: px, y: py, zoom: z } = panRef.current;
      const { x: mx, y: my } = mouseRef.current;
      const theme = themeRef.current;
      const effect = effectRef.current;
      const W = cvs.width, H = cvs.height;
      const spacing = Math.max(8, DOT_SPACING * z);
      const baseRadius = Math.max(0.8, DOT_BASE_R * Math.sqrt(z));
      const peakRadius = Math.max(baseRadius + 1, DOT_PEAK_R * Math.sqrt(z));

      ctx.clearRect(0, 0, W, H);

      const startCol = Math.floor(-px / spacing) - 1;
      const endCol   = Math.ceil((W - px) / spacing) + 1;
      const startRow = Math.floor(-py / spacing) - 1;
      const endRow   = Math.ceil((H - py) / spacing) + 1;

      const [br, bg, bb, ba] = theme.base;
      const [hr, hg, hb, ha] = theme.hot;

      for (let col = startCol; col <= endCol; col++) {
        for (let row = startRow; row <= endRow; row++) {
          const restX = col * spacing + px;
          const restY = row * spacing + py;

          const ddx = restX - mx;
          const ddy = restY - my;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy);

          let finalX = restX;
          let finalY = restY;
          let radius = baseRadius;
          let r = br, g = bg, b = bb, a = ba;

          if (dist < BALL_RADIUS && dist > 0) {
            const t     = 1 - dist / BALL_RADIUS;
            const liftT = t * t;                  // drives glow (size + color)

            // Glow: always applied (dot grows and shifts colour near cursor)
            radius = lerp(baseRadius, peakRadius, liftT);
            r = Math.round(lerp(br, hr, liftT));
            g = Math.round(lerp(bg, hg, liftT));
            b = Math.round(lerp(bb, hb, liftT));
            a = lerp(ba, ha, liftT);

            // Ball displacement: only when the ball effect is toggled on
            if (effect) {
              const pushT   = 4 * t * (1 - t);   // peaks at equator, 0 at center/edge
              const pushMag = PUSH_STRENGTH * pushT;
              const angle   = Math.atan2(ddy, ddx);
              finalX = restX + Math.cos(angle) * pushMag;
              finalY = restY + Math.sin(angle) * pushMag;
            }
          }

          ctx.beginPath();
          ctx.arc(finalX, finalY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(2)})`;
          ctx.fill();
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}
    />
  );
}
