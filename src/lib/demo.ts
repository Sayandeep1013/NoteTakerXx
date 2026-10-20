import type { FullDemoSpec } from "@/store/notes";

// Seeded once on a first visit with an empty canvas.
// Grid unit = 80px. Stroke coords are world pixels; connections index into notes/photos.

export const DEMO_SPEC: FullDemoSpec = {
  // 2 notes
  notes: [
    {
      title: "Welcome to NoteTakerXX",
      body: "Your infinite canvas for ideas.\n\n- Drag the top bar of a note to move it\n- Click a note to edit it\n- Ctrl+V pastes text or images\n- Right-click for more options\n- Ctrl+Shift+P searches everything",
      x: 0, y: 0, w: 5, h: 4, color: "yellow", rotation: -1.5,
    },
    {
      title: "Connect & Draw",
      body: "- Rope: string notes together\n- Arrow: point one note at another\n- Pen: sketch freehand\n- Eraser: removes pen strokes only",
      x: 6, y: 1, w: 4, h: 4, color: "mint", rotation: 1,
    },
  ],

  photos: [
    {
      url: "/images/guts-5k-berserk-5120x2880-13631.jpg",
      caption: "Berserk",
      x: 11, y: 0, w: 6, h: 4, rotation: 0.5,
    },
  ],

  // Pen strokes (world pixel coords)
  strokes: [
    {
      // Wavy underline below Note 1 (note bottom edge at y=320)
      color: "#e58aa9",
      width: 3,
      points: [
        { x: 30,  y: 345 }, { x: 60,  y: 338 }, { x: 90,  y: 348 },
        { x: 120, y: 338 }, { x: 150, y: 348 }, { x: 180, y: 338 },
        { x: 210, y: 348 }, { x: 240, y: 338 }, { x: 270, y: 348 },
        { x: 300, y: 338 }, { x: 330, y: 348 }, { x: 360, y: 340 },
      ],
    },
    {
      // Short squiggle below Note 2 (note bottom edge at y=400)
      color: "#7c8fd8",
      width: 3,
      points: [
        { x: 490, y: 428 }, { x: 525, y: 420 }, { x: 560, y: 432 },
        { x: 595, y: 420 }, { x: 630, y: 432 }, { x: 665, y: 422 },
        { x: 700, y: 430 }, { x: 735, y: 420 }, { x: 770, y: 428 },
      ],
    },
  ],

  // 1 rope + 1 arrow connection
  connections: [
    {
      // Rope: Note 0 → Note 1
      sourceType: "note", sourceIdx: 0,
      targetType: "note", targetIdx: 1,
      connectionType: "rope",
      color: "#e74c3c",
    },
    {
      // Arrow: Note 1 right edge → Photo left edge
      sourceType: "note", sourceIdx: 1,
      targetType: "photo", targetIdx: 0,
      connectionType: "arrow",
      sourceAnchor: "right",
      targetAnchor: "left",
      color: "var(--accent)",
    },
  ],

  // Zoom out slightly so everything fits in the initial viewport
  initialCanvas: { panX: 80, panY: 100, zoom: 0.75 },
};
