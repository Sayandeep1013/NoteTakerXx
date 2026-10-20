// Shared canvas + UI constants. Grid coordinates are stored in "grid units";
// one unit is GRID world pixels.

export const GRID = 80;

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 1.15;

export const NOTE_HEADER_H = 34;
export const MIN_NOTE_SIZE = 4;
export const MIN_PHOTO_SIZE = 3;

export const DEFAULT_NOTE_FONT = 13;
export const MIN_NOTE_FONT = 10;
export const MAX_NOTE_FONT = 40;

export const clampNoteFont = (size: number) => Math.min(MAX_NOTE_FONT, Math.max(MIN_NOTE_FONT, size));

// One z-index scale for everything that floats above the canvas.
export const Z = {
  hud: 500,
  dock: 510,
  banner: 520,
  popover: 530,
  menu: 600,
  modal: 700,
  fullscreen: 800,
  palette: 900,
  toast: 950,
} as const;
