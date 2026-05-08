import type { NoteColor } from "./colors";

export type ThemeName = "paper" | "cork" | "slate" | "midnight" | "forest" | "dusk";

export interface ThemeConfig {
  name: ThemeName;
  label: string;
  swatch: string;         // shown in the picker
  canvasBg: string;
  sidebarBg: string;
  sidebarBorder: string;
  textUi: string;
  textMuted: string;
  accent: string;
  btnHover: string;
  isDark: boolean;
  noteColors: Record<NoteColor, string>;
  noteText: string;
  notePlaceholder: string;
  dotBase: [number, number, number, number]; // rgba components
  dotHot:  [number, number, number, number];
}

// ─────────────────────────────────────────────────────────────────────────────
// Color theory rationale per theme:
//
// Paper  — neutral warm white wall → vivid analogous pastels pop without clashing
// Cork   — mid-tone warm brown → desaturated warm creams/tans feel paper-pinned
// Slate  — cool blue-gray dark → cool-tinted muted jewel notes harmonize
// Midnight — deep navy → electric complementary brights (yellow/cyan/magenta) glow
// Forest — deep green → triadic warm oranges/reds/golds as complements to green
// Dusk   — warm plum/aubergine → sunset analogous golds+pinks+corals
// ─────────────────────────────────────────────────────────────────────────────

export const THEMES: Record<ThemeName, ThemeConfig> = {

  paper: {
    name: "paper", label: "Paper", swatch: "#f0ede8", isDark: false,
    canvasBg: "#f0ede8",
    sidebarBg: "rgba(255,252,248,0.75)",
    sidebarBorder: "rgba(0,0,0,0.14)",
    textUi: "#1a1a1a", textMuted: "rgba(26,26,26,0.42)",
    accent: "#5c6bc0", btnHover: "rgba(0,0,0,0.055)",
    noteColors: {
      yellow:   "#fff176", pink:     "#f48fb1",
      mint:     "#80cbc4", lavender: "#b39ddb",
      peach:    "#ffab91", sky:      "#81d4fa",
      lilac:    "#ce93d8", sage:     "#a5d6a7",
    },
    noteText: "#111111", notePlaceholder: "rgba(17,17,17,0.32)",
    dotBase: [55, 45, 75, 0.22], dotHot: [40, 30, 140, 0.78],
  },

  // Cork: warm mid-tone brown wall — notes are creamy warm naturals
  cork: {
    name: "cork", label: "Cork Board", swatch: "#b8945a", isDark: false,
    canvasBg: "#c4a070",
    sidebarBg: "rgba(160,118,70,0.82)",
    sidebarBorder: "rgba(255,240,210,0.25)",
    textUi: "#2e1e0a", textMuted: "rgba(46,30,10,0.45)",
    accent: "#7a4e1e", btnHover: "rgba(0,0,0,0.08)",
    noteColors: {
      yellow:   "#fff8d0", pink:     "#f8d8c0",
      mint:     "#d0e8c0", lavender: "#e8d4c8",
      peach:    "#f5ddb0", sky:      "#c8dce8",
      lilac:    "#eed0dc", sage:     "#cce0b8",
    },
    noteText: "#2e1e0a", notePlaceholder: "rgba(46,30,10,0.30)",
    dotBase: [80, 50, 20, 0.28], dotHot: [160, 90, 20, 0.82],
  },

  // Slate: sophisticated cool dark blue-gray
  slate: {
    name: "slate", label: "Slate", swatch: "#2a3045", isDark: true,
    canvasBg: "#252c42",
    sidebarBg: "rgba(18,22,38,0.88)",
    sidebarBorder: "rgba(160,175,220,0.15)",
    textUi: "#ccd4f0", textMuted: "rgba(204,212,240,0.42)",
    accent: "#7c8de8", btnHover: "rgba(255,255,255,0.065)",
    noteColors: {
      yellow:   "#c8a84a", pink:     "#b85c7c",
      mint:     "#3a9078", lavender: "#7050b0",
      peach:    "#b85040", sky:      "#3870a8",
      lilac:    "#9045a8", sage:     "#3c7848",
    },
    noteText: "#f0eae0", notePlaceholder: "rgba(240,234,224,0.30)",
    dotBase: [130, 150, 200, 0.18], dotHot: [110, 140, 240, 0.82],
  },

  // Midnight: deep navy — electric brights glow (complementary + triadic)
  midnight: {
    name: "midnight", label: "Midnight", swatch: "#07091a", isDark: true,
    canvasBg: "#080c1c",
    sidebarBg: "rgba(4,6,18,0.90)",
    sidebarBorder: "rgba(80,120,255,0.18)",
    textUi: "#b8cce8", textMuted: "rgba(184,204,232,0.40)",
    accent: "#4fc3f7", btnHover: "rgba(79,195,247,0.08)",
    noteColors: {
      yellow:   "#c8940e", pink:     "#b8185a",
      mint:     "#0d7060", lavender: "#4828a0",
      peach:    "#a83c14", sky:      "#0a4898",
      lilac:    "#7018a8", sage:     "#156028",
    },
    noteText: "#f0eae0", notePlaceholder: "rgba(240,234,224,0.30)",
    dotBase: [30, 55, 120, 0.20], dotHot: [60, 190, 255, 0.90],
  },

  // Forest: deep green wall — triadic warm tones (red/orange/gold) as complements
  forest: {
    name: "forest", label: "Forest", swatch: "#162814", isDark: true,
    canvasBg: "#172a16",
    sidebarBg: "rgba(10,20,10,0.90)",
    sidebarBorder: "rgba(120,200,100,0.15)",
    textUi: "#cce8c4", textMuted: "rgba(204,232,196,0.40)",
    accent: "#70c855", btnHover: "rgba(112,200,85,0.10)",
    noteColors: {
      yellow:   "#d4aa1c",  // warm gold — triadic complement to green
      pink:     "#c84868",  // warm rose
      mint:     "#2a8058",  // mid forest — same family
      lavender: "#8050c0",  // cool purple — triadic
      peach:    "#c86030",  // burnt sienna complement
      sky:      "#3898b0",  // teal
      lilac:    "#c070a0",  // warm mauve
      sage:     "#6aaa50",  // bright sage
    },
    noteText: "#f4ece0", notePlaceholder: "rgba(244,236,224,0.30)",
    dotBase: [70, 120, 50, 0.20], dotHot: [200, 160, 40, 0.85],
  },

  // Dusk: warm plum/aubergine — sunset analogous (golds, roses, corals)
  dusk: {
    name: "dusk", label: "Dusk", swatch: "#281535", isDark: true,
    canvasBg: "#241230",
    sidebarBg: "rgba(16,8,24,0.90)",
    sidebarBorder: "rgba(200,120,240,0.15)",
    textUi: "#e8d0f4", textMuted: "rgba(232,208,244,0.40)",
    accent: "#c078e8", btnHover: "rgba(192,120,232,0.10)",
    noteColors: {
      yellow:   "#c89828",  // warm amber — analogous warm
      pink:     "#c84870",  // warm rose
      mint:     "#208878",  // teal — split complement
      lavender: "#8848c8",  // violet — same warm-dark family
      peach:    "#c86040",  // coral
      sky:      "#3888c0",  // cool blue — complement
      lilac:    "#b04898",  // magenta rose
      sage:     "#388868",  // seafoam
    },
    noteText: "#f4e8f8", notePlaceholder: "rgba(244,232,248,0.28)",
    dotBase: [140, 70, 180, 0.20], dotHot: [255, 100, 200, 0.88],
  },
};

export const DEFAULT_THEME: ThemeName = "paper";
