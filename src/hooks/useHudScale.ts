"use client";

import { useEffect, useRef, useState } from "react";

function getViewportScale() {
  if (typeof window === "undefined") return 1;
  return window.visualViewport?.scale || 1;
}

function clampScale(value: number) {
  return Math.min(1.6, Math.max(0.55, value));
}

export function useHudScale() {
  const base = useRef<number | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    base.current = window.devicePixelRatio || 1;

    const update = () => {
      const current = (window.devicePixelRatio || 1) * getViewportScale();
      setScale(clampScale((base.current || current) / current));
    };

    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return scale;
}
