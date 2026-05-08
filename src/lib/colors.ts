export type NoteColor =
  | "yellow" | "pink" | "mint" | "lavender"
  | "peach" | "sky" | "lilac" | "sage";

export const NOTE_COLOR_KEYS: NoteColor[] = [
  "yellow", "pink", "mint", "lavender", "peach", "sky", "lilac", "sage",
];

// Light theme — vibrant, high-saturation pastels
export const LIGHT_COLORS: Record<NoteColor, string> = {
  yellow:   "#fff176",
  pink:     "#f48fb1",
  mint:     "#80cbc4",
  lavender: "#b39ddb",
  peach:    "#ffab91",
  sky:      "#81d4fa",
  lilac:    "#ce93d8",
  sage:     "#a5d6a7",
};

// Dark theme — deep, jewel-toned pastels with enough contrast for light text
export const DARK_COLORS: Record<NoteColor, string> = {
  yellow:   "#d4a843",
  pink:     "#c2527a",
  mint:     "#2e9e80",
  lavender: "#7c5cbf",
  peach:    "#c06438",
  sky:      "#2878b8",
  lilac:    "#9c3fbf",
  sage:     "#3a7a40",
};

export const NOTE_TEXT: Record<"light" | "dark", string> = {
  light: "#1a1a1a",
  dark:  "#f0ead8",
};

export const NOTE_PLACEHOLDER: Record<"light" | "dark", string> = {
  light: "rgba(26,26,26,0.3)",
  dark:  "rgba(240,234,216,0.3)",
};
