"use client";

import { useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useNotesStore } from "@/store/notes";
import { THEMES, type ThemeName } from "@/lib/themes";

const THEME_KEY = "nxtaker_theme";

export default function ThemeSync() {
  const theme = useTheme();
  const setTheme = useNotesStore((s) => s.setTheme);

  // Restore theme from localStorage on first mount
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) as ThemeName | null;
    if (saved && THEMES[saved]) setTheme(saved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply CSS vars + persist whenever theme changes
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--bg-canvas",      theme.canvasBg);
    r.style.setProperty("--bg-sidebar",     theme.sidebarBg);
    r.style.setProperty("--sidebar-border", theme.sidebarBorder);
    r.style.setProperty("--text-ui",        theme.textUi);
    r.style.setProperty("--text-muted",     theme.textMuted);
    r.style.setProperty("--accent",         theme.accent);
    r.style.setProperty("--btn-hover",      theme.btnHover);
    r.style.background = theme.canvasBg;
    localStorage.setItem(THEME_KEY, theme.name);
  }, [theme]);

  return null;
}
