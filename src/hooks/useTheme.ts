"use client";

import { useNotesStore } from "@/store/notes";
import { THEMES, type ThemeConfig } from "@/lib/themes";

export type { ThemeConfig };

export function useTheme(): ThemeConfig {
  const name = useNotesStore((s) => s.theme);
  return THEMES[name];
}
