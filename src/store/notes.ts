import { create } from "zustand";
import { nanoid } from "nanoid";
import { NoteColor, NOTE_COLOR_KEYS } from "@/lib/colors";
import { ThemeName, DEFAULT_THEME } from "@/lib/themes";

export type { NoteColor };
export type { ThemeName };

const ROTATIONS = [-2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5];
const MIN_SIZE = 4;
const GRID = 80;
export const SIDEBAR_W_OPEN   = 220;
export const SIDEBAR_W_CLOSED = 48;

export interface CustomBadge {
  id: string;
  label: string;
  url: string; // uploaded image URL
}

// Re-export from lib for components that only import from store
export { DEFAULT_BADGES } from "@/lib/badges";

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  color: string;
}

export interface Note {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: NoteColor;
  rotation: number;
  title: string;
  body: string;
  locked: boolean;
  zIndex: number;
  badges: string[];
  createdAt: string; // ISO timestamp
}

interface NotesStore {
  notes: Note[];
  canvas: { panX: number; panY: number };
  topZ: number;
  theme: ThemeName;
  sidebarOpen: boolean;
  badgeMode: string | null;
  customBadges: CustomBadge[];
  newNoteId: string | null;         // signals which note should auto-focus on create
  connections: Connection[];
  connectionMode: string | null;    // sourceId when starting a cord connection

  addNote: () => void;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  bringToFront: (id: string) => void;
  setPan: (x: number, y: number) => void;
  setTheme: (t: ThemeName) => void;
  setSidebarOpen: (v: boolean) => void;
  setBadgeMode: (id: string | null) => void;
  toggleNoteBadge: (noteId: string, badgeId: string) => void;
  addCustomBadge: (badge: CustomBadge) => void;
  setNewNoteId: (id: string | null) => void;
  addConnection: (sourceId: string, targetId: string, color?: string) => void;
  deleteConnection: (id: string) => void;
  setConnectionMode: (id: string | null) => void;
  focusedNoteId: string | null;
  setFocusedNoteId: (id: string | null) => void;
  pendingInsert: "bullet" | "todo" | null;
  setPendingInsert: (type: "bullet" | "todo" | null) => void;
}

// Find first free MIN_SIZE slot scanning top-left → bottom-right
function findFreeSlot(
  occupied: Set<string>,
  colStart: number, rowStart: number,
  colEnd: number,   rowEnd: number,
): { px: number; py: number } | null {
  for (let row = rowStart; row <= rowEnd - MIN_SIZE; row++) {
    for (let col = colStart; col <= colEnd - MIN_SIZE; col++) {
      if (isSlotFree(occupied, col, row)) return { px: col, py: row };
    }
  }
  return null;
}

// Collect ALL free MIN_SIZE slots in the area
function getAllFreeSlots(
  occupied: Set<string>,
  colStart: number, rowStart: number,
  colEnd: number,   rowEnd: number,
): { px: number; py: number }[] {
  const slots: { px: number; py: number }[] = [];
  for (let row = rowStart; row <= rowEnd - MIN_SIZE; row++)
    for (let col = colStart; col <= colEnd - MIN_SIZE; col++)
      if (isSlotFree(occupied, col, row)) slots.push({ px: col, py: row });
  return slots;
}

function isSlotFree(occupied: Set<string>, col: number, row: number): boolean {
  for (let dx = 0; dx < MIN_SIZE; dx++)
    for (let dy = 0; dy < MIN_SIZE; dy++)
      if (occupied.has(`${col + dx},${row + dy}`)) return false;
  return true;
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  canvas: { panX: 320, panY: 240 },
  topZ: 10,
  theme: DEFAULT_THEME,
  sidebarOpen: true,
  badgeMode: null,
  customBadges: [],
  newNoteId: null,
  connections: [],
  connectionMode: null,
  focusedNoteId: null,
  pendingInsert: null,

  addNote: () => {
    const { notes, topZ, canvas, sidebarOpen } = get();
    const color    = NOTE_COLOR_KEYS[Math.floor(Math.random() * NOTE_COLOR_KEYS.length)];
    const rotation = ROTATIONS[Math.floor(Math.random() * ROTATIONS.length)];

    const vw = typeof window !== "undefined" ? window.innerWidth  : 1280;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;

    const sidebarW = sidebarOpen ? SIDEBAR_W_OPEN : SIDEBAR_W_CLOSED;
    const vLeft   = Math.ceil((-canvas.panX + sidebarW) / GRID);
    const vTop    = Math.floor(-canvas.panY / GRID);
    const vRight  = Math.ceil((-canvas.panX + vw) / GRID);
    const vBottom = Math.ceil((-canvas.panY + vh) / GRID);

    const occupied = new Set(
      notes.flatMap((n) => {
        const cells: string[] = [];
        for (let cx = n.x; cx < n.x + n.w; cx++)
          for (let cy = n.y; cy < n.y + n.h; cy++)
            cells.push(`${cx},${cy}`);
        return cells;
      })
    );

    const rand = Math.random();
    let slot: { px: number; py: number };

    if (rand < 0.20) {
      // 20% — top-left scan (systematic, first free spot)
      slot =
        findFreeSlot(occupied, vLeft, vTop, vRight, vBottom) ??
        findFreeSlot(occupied, -50, -50, 100, 100) ??
        { px: vLeft, py: vTop };

    } else if (rand < 0.80) {
      // 60% — random free slot anywhere in the visible canvas
      const freeSlots = getAllFreeSlots(occupied, vLeft, vTop, vRight, vBottom);
      if (freeSlots.length > 0) {
        slot = freeSlots[Math.floor(Math.random() * freeSlots.length)];
      } else {
        // Canvas is full — expand search outward
        slot =
          findFreeSlot(occupied, -50, -50, 100, 100) ??
          { px: vLeft, py: vTop };
      }

    } else {
      // 20% — dead center of visible canvas (may stack if occupied)
      slot = {
        px: Math.floor((vLeft + vRight) / 2) - Math.floor(MIN_SIZE / 2),
        py: Math.floor((vTop + vBottom) / 2) - Math.floor(MIN_SIZE / 2),
      };
    }

    const newId = nanoid();
    set({
      notes: [...notes, {
        id: newId,
        x: slot.px, y: slot.py,
        w: MIN_SIZE, h: MIN_SIZE,
        color, rotation,
        title: "", body: "",
        locked: false,
        zIndex: topZ + 1,
        badges: [],
        createdAt: new Date().toISOString(),
      }],
      topZ: topZ + 1,
      newNoteId: newId,  // triggers auto-focus in the Note component
    });
  },

  updateNote: (id, patch) =>
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),
  deleteNote: (id) =>
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
  bringToFront: (id) => {
    const next = get().topZ + 1;
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, zIndex: next } : n)),
      topZ: next,
    }));
  },
  setPan: (x, y) => set({ canvas: { panX: x, panY: y } }),
  setTheme: (t) => set({ theme: t }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setBadgeMode: (id) => set({ badgeMode: id }),
  setNewNoteId: (id) => set({ newNoteId: id }),
  addConnection: (sourceId, targetId, color = "#e74c3c") =>
    set((s) => ({ connections: [...s.connections, { id: nanoid(), sourceId, targetId, color }] })),
  deleteConnection: (id) =>
    set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),
  setConnectionMode: (id) => set({ connectionMode: id }),
  setFocusedNoteId: (id) => set({ focusedNoteId: id }),
  setPendingInsert: (type) => set({ pendingInsert: type }),
  addCustomBadge: (badge) => set((s) => ({ customBadges: [...s.customBadges, badge] })),
  toggleNoteBadge: (noteId, badgeId) =>
    set((s) => ({
      notes: s.notes.map((n) => {
        if (n.id !== noteId) return n;
        const has = n.badges.includes(badgeId);
        return { ...n, badges: has ? n.badges.filter((b) => b !== badgeId) : [...n.badges, badgeId] };
      }),
    })),
}));
