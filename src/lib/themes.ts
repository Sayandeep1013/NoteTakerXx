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
    name: "paper", label: "Paper", swatch: "#d8bd91", isDark: false,
    canvasBg: "#d8bd91",
    sidebarBg: "#fffaf4",
    sidebarBorder: "#9f7a4e",
    textUi: "#1a1a1a", textMuted: "rgba(26,26,26,0.42)",
    accent: "#6f54b7", btnHover: "rgba(111,84,183,0.12)",
    folderLabelBg: "#b39ddb",
    folderLabelText: "#1a1430",
    folderLabelBorder: "#6f54b7",
    noteColors: {
      yellow:   "#fff176", pink:     "#f48fb1",
      mint:     "#80cbc4", lavender: "#b39ddb",
      peach:    "#ffab91", sky:      "#81d4fa",
      lilac:    "#ce93d8", sage:     "#a5d6a7",
    },
    noteText: "#111111", notePlaceholder: "rgba(17,17,17,0.32)",
    dotBase: [98, 67, 36, 0.36], dotHot: [100, 72, 160, 0.88],
  },

  // Cork: warm mid-tone brown wall — notes are creamy warm naturals
  cork: {
    name: "cork", label: "Cork Board", swatch: "#f0ede8", isDark: false,
    canvasBg: "#f0ede8",
    sidebarBg: "#ffe8c7",
    sidebarBorder: "#c98652",
    textUi: "#2e1e0a", textMuted: "rgba(46,30,10,0.45)",
    accent: "#c96a86", btnHover: "rgba(201,106,134,0.13)",
    folderLabelBg: "#f48fb1",
    folderLabelText: "#30111b",
    folderLabelBorder: "#c96a86",
    noteColors: {
      yellow:   "#fff176", pink:     "#f48fb1",
      mint:     "#80cbc4", lavender: "#b39ddb",
      peach:    "#ffab91", sky:      "#81d4fa",
      lilac:    "#ce93d8", sage:     "#a5d6a7",
    },
    noteText: "#2e1e0a", notePlaceholder: "rgba(46,30,10,0.30)",
    dotBase: [80, 50, 20, 0.34], dotHot: [160, 90, 20, 0.88],
  },

  // Slate: sophisticated cool dark blue-gray
  slate: {
    name: "slate", label: "Slate", swatch: "#2b2b32", isDark: true,
    canvasBg: "#2b2b32",
    sidebarBg: "#2a2520",
    sidebarBorder: "#6b563e",
    textUi: "#ece4d4", textMuted: "rgba(236,228,212,0.44)",
    accent: "#c96a86", btnHover: "rgba(201,106,134,0.13)",
    folderLabelBg: "#8567c8",
    folderLabelText: "#fff5e6",
    folderLabelBorder: "#c96a86",
    noteColors: {
      yellow:   "#d7b84f", pink:     "#c96a86",
      mint:     "#4aa28b", lavender: "#8567c8",
      peach:    "#c96b55", sky:      "#4f8fc0",
      lilac:    "#aa62bd", sage:     "#669b60",
    },
    noteText: "#fff5e6", notePlaceholder: "rgba(255,245,230,0.32)",
    dotBase: [210, 190, 150, 0.30], dotHot: [230, 165, 80, 0.88],
  },

  // Midnight: deep navy — electric brights glow (complementary + triadic)
  midnight: {
    name: "midnight", label: "Midnight", swatch: "#07091a", isDark: true,
    canvasBg: "#080c1c",
    sidebarBg: "#121421",
    sidebarBorder: "#4f8fc0",
    textUi: "#b8cce8", textMuted: "rgba(184,204,232,0.40)",
    accent: "#d39a4a", btnHover: "rgba(211,154,74,0.14)",
    folderLabelBg: "#4f8fc0",
    folderLabelText: "#f0eae0",
    folderLabelBorder: "#d39a4a",
    noteColors: {
      yellow:   "#c8940e", pink:     "#b8185a",
      mint:     "#0d7060", lavender: "#4828a0",
      peach:    "#a83c14", sky:      "#0a4898",
      lilac:    "#7018a8", sage:     "#156028",
    },
    noteText: "#f0eae0", notePlaceholder: "rgba(240,234,224,0.30)",
    dotBase: [70, 110, 210, 0.34], dotHot: [80, 205, 255, 0.94],
  },

  // Forest: deep green wall — triadic warm tones (red/orange/gold) as complements
  forest: {
    name: "forest", label: "Forest", swatch: "#162814", isDark: true,
    canvasBg: "#172a16",
    sidebarBg: "#1b251a",
    sidebarBorder: "#8050c0",
    textUi: "#cce8c4", textMuted: "rgba(204,232,196,0.40)",
    accent: "#c86030", btnHover: "rgba(200,96,48,0.14)",
    folderLabelBg: "#8050c0",
    folderLabelText: "#f4ece0",
    folderLabelBorder: "#c86030",
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
    dotBase: [95, 150, 72, 0.36], dotHot: [220, 180, 55, 0.92],
  },

  // Dusk: warm plum/aubergine — sunset analogous (golds, roses, corals)
  dusk: {
    name: "dusk", label: "Dusk", swatch: "#281535", isDark: true,
    canvasBg: "#241230",
    sidebarBg: "#24182a",
    sidebarBorder: "#c89828",
    textUi: "#e8d0f4", textMuted: "rgba(232,208,244,0.40)",
    accent: "#3888c0", btnHover: "rgba(56,136,192,0.14)",
    folderLabelBg: "#c89828",
    folderLabelText: "#241230",
    folderLabelBorder: "#3888c0",
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
    dotBase: [165, 92, 205, 0.34], dotHot: [255, 120, 210, 0.94],
  },
};

export const DEFAULT_THEME: ThemeName = "slate";
