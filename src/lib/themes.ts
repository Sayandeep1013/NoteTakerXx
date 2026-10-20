import { NOTE_COLOR_KEYS, type NoteColor } from "./colors";

export type ThemeName = "paper" | "cork" | "slate" | "midnight" | "forest" | "mono";
export const THEME_ORDER: ThemeName[] = ["paper", "cork", "slate", "midnight", "forest", "mono"];

export interface ThemeConfig {
  name: ThemeName;
  label: string;
  canvasBg: string;
  sidebarBg: string;
  sidebarBorder: string;
  textUi: string;
  textMuted: string;
  accent: string;
  /** Text/icon colour that stays readable on top of `accent`. */
  onAccent: string;
  btnHover: string;
  folderLabelBg: string;
  folderLabelText: string;
  folderLabelBorder: string;
  isDark: boolean;
  noteColors: Record<NoteColor, string>;
  noteText: string;
  notePlaceholder: string;
  dotBase: [number, number, number, number]; // rgba components
  dotHot:  [number, number, number, number];
}

const PASTEL_NOTES: Record<NoteColor, string> = {
  yellow:   "#fff176", pink:     "#f48fb1",
  mint:     "#80cbc4", lavender: "#b39ddb",
  peach:    "#ffab91", sky:      "#81d4fa",
  lilac:    "#ce93d8", sage:     "#a5d6a7",
};

// Theme keys are persisted (localStorage + profiles.theme), so they never change;
// labels describe what the theme actually looks like.
export const THEMES: Record<ThemeName, ThemeConfig> = {

  // Warm kraft-paper wall with vivid pastel notes
  paper: {
    name: "paper", label: "Kraft", isDark: false,
    canvasBg: "#d8bd91",
    sidebarBg: "#fffaf4",
    sidebarBorder: "#9f7a4e",
    textUi: "#1a1a1a", textMuted: "rgba(26,26,26,0.55)",
    accent: "#6f54b7", onAccent: "#ffffff", btnHover: "rgba(111,84,183,0.12)",
    folderLabelBg: "#b39ddb",
    folderLabelText: "#1a1430",
    folderLabelBorder: "#6f54b7",
    noteColors: PASTEL_NOTES,
    noteText: "#111111", notePlaceholder: "rgba(17,17,17,0.36)",
    dotBase: [98, 67, 36, 0.36], dotHot: [100, 72, 160, 0.88],
  },

  // Soft off-white linen with the same pastels
  cork: {
    name: "cork", label: "Linen", isDark: false,
    canvasBg: "#f0ede8",
    sidebarBg: "#fff6ea",
    sidebarBorder: "#c98652",
    textUi: "#2e1e0a", textMuted: "rgba(46,30,10,0.55)",
    accent: "#c2577a", onAccent: "#ffffff", btnHover: "rgba(194,87,122,0.12)",
    folderLabelBg: "#f48fb1",
    folderLabelText: "#30111b",
    folderLabelBorder: "#c2577a",
    noteColors: PASTEL_NOTES,
    noteText: "#2e1e0a", notePlaceholder: "rgba(46,30,10,0.34)",
    dotBase: [80, 50, 20, 0.30], dotHot: [160, 90, 20, 0.88],
  },

  // Cool graphite with muted jewel-tone notes
  slate: {
    name: "slate", label: "Slate", isDark: true,
    canvasBg: "#2b2b32",
    sidebarBg: "#202026",
    sidebarBorder: "#5a5a68",
    textUi: "#ece8e1", textMuted: "rgba(236,232,225,0.55)",
    accent: "#d9799a", onAccent: "#1d0e14", btnHover: "rgba(217,121,154,0.14)",
    folderLabelBg: "#8567c8",
    folderLabelText: "#fff5e6",
    folderLabelBorder: "#d9799a",
    noteColors: {
      yellow:   "#d7b84f", pink:     "#c96a86",
      mint:     "#4aa28b", lavender: "#8567c8",
      peach:    "#c96b55", sky:      "#4f8fc0",
      lilac:    "#aa62bd", sage:     "#669b60",
    },
    noteText: "#fff5e6", notePlaceholder: "rgba(255,245,230,0.40)",
    dotBase: [210, 200, 185, 0.22], dotHot: [230, 165, 80, 0.88],
  },

  // Deep navy where saturated notes glow
  midnight: {
    name: "midnight", label: "Midnight", isDark: true,
    canvasBg: "#080c1c",
    sidebarBg: "#11152a",
    sidebarBorder: "#34507a",
    textUi: "#c4d4ec", textMuted: "rgba(196,212,236,0.55)",
    accent: "#e0a552", onAccent: "#1c1204", btnHover: "rgba(224,165,82,0.14)",
    folderLabelBg: "#4f8fc0",
    folderLabelText: "#f0eae0",
    folderLabelBorder: "#e0a552",
    noteColors: {
      yellow:   "#c8940e", pink:     "#b8185a",
      mint:     "#0d7060", lavender: "#4828a0",
      peach:    "#a83c14", sky:      "#0a4898",
      lilac:    "#7018a8", sage:     "#156028",
    },
    noteText: "#f0eae0", notePlaceholder: "rgba(240,234,224,0.40)",
    dotBase: [70, 110, 210, 0.30], dotHot: [80, 205, 255, 0.94],
  },

  // Deep green with warm complementary notes
  forest: {
    name: "forest", label: "Forest", isDark: true,
    canvasBg: "#172a16",
    sidebarBg: "#1a2419",
    sidebarBorder: "#46633f",
    textUi: "#d4ead0", textMuted: "rgba(212,234,208,0.55)",
    accent: "#e07a42", onAccent: "#1e0d04", btnHover: "rgba(224,122,66,0.14)",
    folderLabelBg: "#8050c0",
    folderLabelText: "#f4ece0",
    folderLabelBorder: "#e07a42",
    noteColors: {
      yellow:   "#d4aa1c", pink:     "#c84868",
      mint:     "#2a8058", lavender: "#8050c0",
      peach:    "#c86030", sky:      "#3898b0",
      lilac:    "#c070a0", sage:     "#6aaa50",
    },
    noteText: "#f4ece0", notePlaceholder: "rgba(244,236,224,0.40)",
    dotBase: [95, 150, 72, 0.32], dotHot: [220, 180, 55, 0.92],
  },

  // Editorial black & white
  mono: {
    name: "mono", label: "Monochrome", isDark: true,
    canvasBg: "#000000",
    sidebarBg: "#0e0e0e",
    sidebarBorder: "#3a3a3a",
    textUi: "#ececec", textMuted: "rgba(236,236,236,0.52)",
    accent: "#e6e6e6", onAccent: "#0a0a0a", btnHover: "rgba(230,230,230,0.10)",
    folderLabelBg: "#1c1c1c",
    folderLabelText: "#e8e8e8",
    folderLabelBorder: "#4a4a4a",
    noteColors: {
      yellow:   "#ffffff", pink:     "#f2f2f2",
      mint:     "#e6e6e6", lavender: "#dbdbdb",
      peach:    "#f8f8f8", sky:      "#ececec",
      lilac:    "#e2e2e2", sage:     "#f0f0f0",
    },
    noteText: "#080808", notePlaceholder: "rgba(8,8,8,0.34)",
    dotBase: [255, 255, 255, 0.10], dotHot: [255, 255, 255, 0.82],
  },
};

export const DEFAULT_THEME: ThemeName = "paper";
export const THEME_STORAGE_KEY = "nxtaker_theme";

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && value in THEMES;
}

/** CSS custom properties for a theme — applied on <html> so canvas items never re-render on theme change. */
export function themeCssVars(theme: ThemeConfig): Record<string, string> {
  const vars: Record<string, string> = {
    "--bg-canvas": theme.canvasBg,
    "--bg-sidebar": theme.sidebarBg,
    "--sidebar-border": theme.sidebarBorder,
    "--text-ui": theme.textUi,
    "--text-muted": theme.textMuted,
    "--accent": theme.accent,
    "--on-accent": theme.onAccent,
    "--btn-hover": theme.btnHover,
    "--folder-label-bg": theme.folderLabelBg,
    "--folder-label-text": theme.folderLabelText,
    "--folder-label-border": theme.folderLabelBorder,
    "--note-text": theme.noteText,
    "--note-placeholder": theme.notePlaceholder,
  };
  for (const key of NOTE_COLOR_KEYS) vars[`--note-${key}`] = theme.noteColors[key];
  return vars;
}

export function applyTheme(theme: ThemeConfig) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(themeCssVars(theme))) root.style.setProperty(key, value);
  root.dataset.mode = theme.isDark ? "dark" : "light";
  root.style.colorScheme = theme.isDark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.canvasBg);
}

/**
 * Inline <head> script that applies the saved theme before first paint, so a
 * dark-theme user never sees a flash of the default theme.
 */
export function themeBootScript() {
  const table = Object.fromEntries(
    THEME_ORDER.map((name) => [name, { vars: themeCssVars(THEMES[name]), dark: THEMES[name].isDark }]),
  );
  return `(function(){try{var t=${JSON.stringify(table)};var n=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var c=t[n]||t[${JSON.stringify(DEFAULT_THEME)}];var r=document.documentElement;for(var k in c.vars)r.style.setProperty(k,c.vars[k]);r.dataset.mode=c.dark?"dark":"light";r.style.colorScheme=c.dark?"dark":"light";}catch(e){}})();`;
}
