"use client";

import { useEffect, useState } from "react";

interface Stats { fps: number; mb: number | null }

/** Dev-only FPS / JS-heap readout (heap is Chromium-only). */
export default function ResourceMonitor() {
  const [stats, setStats] = useState<Stats>({ fps: 0, mb: null });

  useEffect(() => {
    let rafId = 0;
    let frames = 0;
    let last = performance.now();
    const tick = (now: number) => {
      frames++;
      if (now - last >= 1000) {
        const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
        setStats({
          fps: Math.round((frames * 1000) / (now - last)),
          mb: perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1_048_576) : null,
        });
        frames = 0;
        last = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const fpsColor = stats.fps >= 55 ? "#34c759" : stats.fps >= 40 ? "#f5c542" : "#ff453a";

  return (
    <div
      className="surface"
      aria-hidden="true"
      style={{
        position: "fixed", left: "var(--gutter)", top: "calc(var(--gutter) + 52px)", zIndex: 490,
        display: "flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 999,
        fontSize: 10, fontWeight: 600, fontVariantNumeric: "tabular-nums", pointerEvents: "none", opacity: 0.8, boxShadow: "none",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: fpsColor }} />
      {stats.fps} fps{stats.mb !== null && ` / ${stats.mb} MB`}
    </div>
  );
}
