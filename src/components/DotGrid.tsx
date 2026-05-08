"use client";

import { useEffect, useRef } from "react";
import { useNotesStore } from "@/store/notes";
import { THEMES } from "@/lib/themes";

const DOT_SPACING   = 40;
const DOT_BASE_R    = 1.5;
const DOT_PEAK_R    = 5;
const BALL_RADIUS   = 110;   // 220px diameter — noticeable but not overwhelming
const PUSH_STRENGTH = 18;

// Ball-under-cloth model:
//   t = linear falloff 1→0 from center to edge of ball
//
//   liftT  = t²           → max at center (crown of ball), fades toward edge
//   pushT  = 4·t·(1-t)    → 0 at center, peaks at t=0.5 (equator), 0 at edge
//
// liftT drives dot SIZE (the crown pushes cloth straight up → bigger dot)
// pushT drives radial DISPLACEMENT (the slope pushes cloth sideways → moved dot)
//
// Together they produce the illusion of cloth draping over a sphere.

// ── Theme colors ────────────────────────────────────────────
interface DotTheme {
  base: [number, number, number, number];
  hot:  [number, number, number, number];
}

const LIGHT: DotTheme = {
  base: [60, 50, 80, 0.22],       // warm dark violet-gray
  hot:  [45, 35, 140, 0.82],      // deep indigo near cursor crown
};
const DARK: DotTheme = {
  base: [220, 215, 255, 0.18],    // cool dim white-violet
  hot:  [235, 230, 255, 0.90],    // bright warm white at crown
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function DotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef({ x: -9999, y: -9999 });

  const panX = useNotesStore((s) => s.canvas.panX);
  const panY = useNotesStore((s) => s.canvas.panY);
  const panRef = useRef({ x: 0, y: 0 });
  panRef.current = { x: panX, y: panY };

  const themeKey = useNotesStore((s) => s.theme);
  const themeRef = useRef<DotTheme>(LIGHT);
  themeRef.current = { base: THEMES[themeKey].dotBase, hot: THEMES[themeKey].dotHot };

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
      const { x: px, y: py } = panRef.current;
      const { x: mx, y: my } = mouseRef.current;
      const theme = themeRef.current;
      const W = cvs.width, H = cvs.height;

      ctx.clearRect(0, 0, W, H);

      const startCol = Math.floor(-px / DOT_SPACING) - 1;
      const endCol   = Math.ceil((W - px) / DOT_SPACING) + 1;
      const startRow = Math.floor(-py / DOT_SPACING) - 1;
      const endRow   = Math.ceil((H - py) / DOT_SPACING) + 1;

      const [br, bg, bb, ba] = theme.base;
      const [hr, hg, hb, ha] = theme.hot;

      for (let col = startCol; col <= endCol; col++) {
        for (let row = startRow; row <= endRow; row++) {
          // Rest position of this dot (screen coords)
          const restX = col * DOT_SPACING + px;
          const restY = row * DOT_SPACING + py;

          const ddx = restX - mx;
          const ddy = restY - my;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy);

          let finalX = restX;
          let finalY = restY;
          let radius = DOT_BASE_R;
          let r = br, g = bg, b = bb, a = ba;

          if (dist < BALL_RADIUS && dist > 0) {
            const t      = 1 - dist / BALL_RADIUS;             // 1 at center, 0 at edge
            const liftT  = t * t;                               // crown lift (max at center)
            const pushT  = 4 * t * (1 - t);                    // equatorial push (max at mid)

            // Radial displacement — push dot away from mouse
            const pushMag = PUSH_STRENGTH * pushT;
            const angle   = Math.atan2(ddy, ddx);
            finalX = restX + Math.cos(angle) * pushMag;
            finalY = restY + Math.sin(angle) * pushMag;

            // Size — grows at the crown
            radius = lerp(DOT_BASE_R, DOT_PEAK_R, liftT);

            // Color — transition base → hot
            r = Math.round(lerp(br, hr, liftT));
            g = Math.round(lerp(bg, hg, liftT));
            b = Math.round(lerp(bb, hb, liftT));
            a = lerp(ba, ha, liftT);
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
