"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/hooks/useTheme";

interface Stats { fps: number; mb: number | null; }

export default function ResourceMonitor() {
  const theme = useTheme();
  const isDark = theme.isDark;
  const [stats, setStats] = useState<Stats>({ fps: 0, mb: null });
  const frameCount = useRef(0);
  const lastTime   = useRef(performance.now());

  useEffect(() => {
    let rafId: number;

    const tick = () => {
      frameCount.current++;
      const now = performance.now();
      const delta = now - lastTime.current;

      if (delta >= 1000) {
        const fps = Math.round((frameCount.current * 1000) / delta);
        const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
        const mb   = perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1_048_576) : null;
        setStats({ fps, mb });
        frameCount.current = 0;
        lastTime.current   = now;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // FPS color indicator
  const fpsColor = stats.fps >= 55 ? "#34c759" : stats.fps >= 40 ? "#f5c542" : "#ff453a";

  return (
    <div
      title={stats.mb !== null ? "FPS · JS Heap Memory (Chrome only)" : "FPS counter"}
      style={{
        position: "fixed",
        bottom: 12, left: stats.mb !== null ? "50%" : "50%",
        transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 8,
        padding: "4px 10px",
        borderRadius: 20,
        background: theme.sidebarBg,
        border: `0.5px solid ${isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.08)"}`,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: "var(--font-geist-mono, monospace)",
        letterSpacing: "0.04em",
        zIndex: 490,
        userSelect: "none",
        pointerEvents: "none",
        opacity: 0.85,
      }}
    >
      {/* FPS dot + value */}
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: fpsColor, flexShrink: 0 }} />
        <span style={{ color: isDark ? "#c8c0d8" : "#444" }}>{stats.fps} fps</span>
      </span>

      {stats.mb !== null && (
        <>
          <span style={{ width: 1, height: 10, background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)" }} />
          <span style={{ color: isDark ? "#c8c0d8" : "#444" }}>
            {stats.mb} mb
          </span>
        </>
      )}
    </div>
  );
}
