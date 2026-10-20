export type NoteColor =
  | "yellow" | "pink" | "mint" | "lavender"
  | "peach" | "sky" | "lilac" | "sage";

export const NOTE_COLOR_KEYS: NoteColor[] = [
  "yellow", "pink", "mint", "lavender", "peach", "sky", "lilac", "sage",
];

export function randomNoteColor(): NoteColor {
  return NOTE_COLOR_KEYS[Math.floor(Math.random() * NOTE_COLOR_KEYS.length)];
}

/** Note colours are CSS variables set per theme (see themeCssVars). */
export function noteColorVar(color: NoteColor | undefined) {
  return `var(--note-${color ?? "yellow"})`;
}
