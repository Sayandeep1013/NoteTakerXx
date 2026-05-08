"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useNotesStore } from "@/store/notes";
import { createClient } from "@/lib/supabase/client";
import { THEMES, type ThemeName } from "@/lib/themes";

const THEME_KEY = "nxtaker_theme";

export default function ThemeSync() {
  const theme = useTheme();
  const setTheme = useNotesStore((s) => s.setTheme);
  const readyToCloudSave = useRef(false);

  // Restore theme from localStorage first, then prefer the logged-in user's profile.
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) as ThemeName | null;
    if (saved && THEMES[saved]) setTheme(saved);
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) {
        readyToCloudSave.current = true;
        return;
      }
      sb.from("profiles").select("theme").eq("id", data.user.id).single().then(({ data }) => {
        if (data?.theme && THEMES[data.theme as ThemeName]) {
          setTheme(data.theme as ThemeName);
        }
        readyToCloudSave.current = true;
      });
    });
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
    if (!readyToCloudSave.current) return;
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => {
      if (data.user) {
        sb.from("profiles").upsert({ id: data.user.id, theme: theme.name }, { onConflict: "id" }).then(() => {});
      }
    });
  }, [theme]);

  // On login, restore theme from Supabase profile
  useEffect(() => {
    const sb = createClient();
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) return;
      sb.from("profiles").select("theme").eq("id", session.user.id).single().then(({ data }) => {
        if (data?.theme && THEMES[data.theme as ThemeName]) {
          setTheme(data.theme as ThemeName);
        }
      });
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
