import { create } from "zustand";
import { nanoid } from "nanoid";
import { NoteColor, NOTE_COLOR_KEYS } from "@/lib/colors";
import { ThemeName, DEFAULT_THEME } from "@/lib/themes";

export type { NoteColor };
export type { ThemeName };

const ROTATIONS = [-2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5];
const MIN_SIZE = 4;
const FOLDER_SIZE = 1;
const PHOTO_W = 4;
const PHOTO_H = 5;
const GRID = 80;
export const SIDEBAR_W_OPEN = 220;
export const SIDEBAR_W_CLOSED = 48;
const DOCK_W_OPEN = 0;

export type CanvasItemType = "note" | "folder" | "photo";
export type CanvasParentId = string | null;

function createItemId() {
  return globalThis.crypto?.randomUUID?.() ?? nanoid();
}

export interface CustomBadge {
  id: string;
  label: string;
  url: string;
}

export { DEFAULT_BADGES } from "@/lib/badges";

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  color: string;
}

export interface Note {
  id: string;
  type: CanvasItemType;
  parentId: CanvasParentId;
  x: number;
  y: number;
  w: number;
  h: number;
  color: NoteColor;
  rotation: number;
  title: string;
  body: string;
  fontSize?: number;
  locked: boolean;
  zIndex: number;
  badges: string[];
  createdAt: string;
  folderName?: string;
  imageUrl?: string;
  imagePath?: string | null;
  caption?: string;
}

interface FolderPan {
  panX: number;
  panY: number;
}

interface NotesStore {
  notes: Note[];
  canvas: FolderPan;
  folderPan: Record<string, FolderPan>;
  activeFolderId: CanvasParentId;
  topZ: number;
  theme: ThemeName;
  sidebarOpen: boolean;
  dockX: number | null;
  dockY: number | null;
  coffeeVisible: boolean;
  badgeMode: string | null;
  customBadges: CustomBadge[];
  newNoteId: string | null;
  connections: Connection[];
  connectionMode: string | null;
  selectedItemIds: string[];
  pendingDeletedItemIds: string[];
  selectionMode: "normal" | "import";

  addNote: () => void;
  addFolder: (itemIds?: string[]) => string;
  addPhoto: (url: string, imagePath?: string | null, caption?: string, naturalWidth?: number, naturalHeight?: number) => void;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  deleteItemTree: (id: string) => void;
  consumeDeletedItemIds: (ids: string[]) => void;
  bringToFront: (id: string) => void;
  setPan: (x: number, y: number) => void;
  setTheme: (t: ThemeName) => void;
  setSidebarOpen: (v: boolean) => void;
  setDockPosition: (x: number, y: number) => void;
  setCoffeeVisible: (v: boolean) => void;
  setBadgeMode: (id: string | null) => void;
  toggleNoteBadge: (noteId: string, badgeId: string) => void;
  addCustomBadge: (badge: CustomBadge) => void;
  deleteCustomBadge: (badgeId: string) => void;
  setCustomBadges: (badges: CustomBadge[]) => void;
  setNewNoteId: (id: string | null) => void;
  addConnection: (sourceId: string, targetId: string, color?: string) => void;
  deleteConnection: (id: string) => void;
  setConnectionMode: (id: string | null) => void;
  openFolder: (id: string) => void;
  goToParentFolder: () => void;
  setActiveFolderId: (id: CanvasParentId) => void;
  moveItemsToFolder: (itemIds: string[], folderId: CanvasParentId) => void;
  moveItemsByGrid: (itemIds: string[], dx: number, dy: number) => void;
  isDescendantFolder: (folderId: string, possibleDescendantId: string) => boolean;
  focusedNoteId: string | null;
  setFocusedNoteId: (id: string | null) => void;
  pendingInsert: "bullet" | "todo" | null;
  setPendingInsert: (type: "bullet" | "todo" | null) => void;
  badgeFilter: string | null;
  setBadgeFilter: (id: string | null) => void;
  noteSearch: string;
  setNoteSearch: (query: string) => void;
  highlightedNoteId: string | null;
  setHighlightedNoteId: (id: string | null) => void;
  toggleSelectedItem: (id: string) => void;
  setSelectedItems: (ids: string[]) => void;
  clearSelection: () => void;
  setSelectionMode: (mode: "normal" | "import") => void;
}

function folderKey(id: CanvasParentId) {
  return id ?? "root";
}

function randomNoteColor(): NoteColor {
  return NOTE_COLOR_KEYS[Math.floor(Math.random() * NOTE_COLOR_KEYS.length)];
}

function randomRotation() {
  return ROTATIONS[Math.floor(Math.random() * ROTATIONS.length)];
}

function photoGridSize(naturalWidth?: number, naturalHeight?: number) {
  const aspect = naturalWidth && naturalHeight ? naturalWidth / naturalHeight : 0.8;
  if (!Number.isFinite(aspect) || aspect <= 0) return { w: PHOTO_W, h: PHOTO_H };
  if (aspect >= 1.25) return { w: Math.min(8, Math.max(5, Math.round(4 * aspect))), h: 4 };
  if (aspect <= 0.8) return { w: 4, h: Math.min(9, Math.max(5, Math.round(4 / aspect) + 1)) };
  return { w: PHOTO_W, h: PHOTO_H };
}

function normalizeItem(item: Partial<Note> & { id: string }): Note {
  const type = item.type ?? "note";
  const folderName = item.folderName ?? (type === "folder" ? item.title || "Untitled Folder" : undefined);
  const caption = item.caption ?? (type === "photo" ? item.body || "" : undefined);
  return {
    id: item.id,
    type,
    parentId: item.parentId ?? null,
    x: item.x ?? 0,
    y: item.y ?? 0,
    w: item.w ?? (type === "folder" ? FOLDER_SIZE : type === "photo" ? PHOTO_W : MIN_SIZE),
    h: item.h ?? (type === "folder" ? FOLDER_SIZE : type === "photo" ? PHOTO_H : MIN_SIZE),
    color: item.color ?? randomNoteColor(),
    rotation: item.rotation ?? (type === "folder" ? 0 : randomRotation()),
    title: type === "folder" ? (folderName ?? "Untitled Folder") : item.title ?? "",
    body: type === "photo" ? (caption ?? "") : item.body ?? "",
    fontSize: item.fontSize ?? 13,
    locked: item.locked ?? false,
    zIndex: item.zIndex ?? 10,
    badges: item.badges ?? [],
    createdAt: item.createdAt ?? new Date().toISOString(),
    folderName,
    imageUrl: item.imageUrl,
    imagePath: item.imagePath ?? null,
    caption,
  };
}

function isSlotFree(occupied: Set<string>, col: number, row: number, size = MIN_SIZE): boolean {
  for (let dx = 0; dx < size; dx++)
    for (let dy = 0; dy < size; dy++)
      if (occupied.has(`${col + dx},${row + dy}`)) return false;
  return true;
}

function findFreeSlot(
  occupied: Set<string>,
  colStart: number,
  rowStart: number,
  colEnd: number,
  rowEnd: number,
  size = MIN_SIZE,
): { px: number; py: number } | null {
  for (let row = rowStart; row <= rowEnd - size; row++) {
    for (let col = colStart; col <= colEnd - size; col++) {
      if (isSlotFree(occupied, col, row, size)) return { px: col, py: row };
    }
  }
  return null;
}

function getAllFreeSlots(
  occupied: Set<string>,
  colStart: number,
  rowStart: number,
  colEnd: number,
  rowEnd: number,
  size = MIN_SIZE,
): { px: number; py: number }[] {
  const slots: { px: number; py: number }[] = [];
  for (let row = rowStart; row <= rowEnd - size; row++)
    for (let col = colStart; col <= colEnd - size; col++)
      if (isSlotFree(occupied, col, row, size)) slots.push({ px: col, py: row });
  return slots;
}

function findFolderSlot(notes: Note[], parentId: CanvasParentId, canvas: FolderPan, sidebarOpen: boolean) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const dockInset = sidebarOpen ? DOCK_W_OPEN : SIDEBAR_W_CLOSED;
  const vLeft = Math.ceil((-canvas.panX + dockInset) / GRID);
  const vTop = Math.floor(-canvas.panY / GRID);
  const vRight = Math.ceil((-canvas.panX + vw) / GRID);
  const vBottom = Math.ceil((-canvas.panY + vh) / GRID);
  const occupied = occupiedCells(notes, parentId);

  for (let col = vLeft; col <= vRight; col += 1) {
    for (let row = vTop; row <= vBottom; row += 2) {
      if (isSlotFree(occupied, col, row, FOLDER_SIZE)) return { px: col, py: row };
    }
  }

  return findFreeSlot(occupied, -50, -50, 100, 100, FOLDER_SIZE) ?? { px: vLeft, py: vTop };
}

function occupiedCells(notes: Note[], parentId: CanvasParentId) {
  return new Set(
    notes
      .filter((n) => n.parentId === parentId)
      .flatMap((n) => {
        const cells: string[] = [];
        for (let cx = n.x; cx < n.x + n.w; cx++)
          for (let cy = n.y; cy < n.y + n.h; cy++)
            cells.push(`${cx},${cy}`);
        return cells;
      })
  );
}

function findVisibleSlot(notes: Note[], parentId: CanvasParentId, canvas: FolderPan, sidebarOpen: boolean, size = MIN_SIZE) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const dockInset = sidebarOpen ? DOCK_W_OPEN : SIDEBAR_W_CLOSED;
  const vLeft = Math.ceil((-canvas.panX + dockInset) / GRID);
  const vTop = Math.floor(-canvas.panY / GRID);
  const vRight = Math.ceil((-canvas.panX + vw) / GRID);
  const vBottom = Math.ceil((-canvas.panY + vh) / GRID);
  const occupied = occupiedCells(notes, parentId);
  const rand = Math.random();

  if (rand < 0.20) {
    return (
      findFreeSlot(occupied, vLeft, vTop, vRight, vBottom, size) ??
      findFreeSlot(occupied, -50, -50, 100, 100, size) ??
      { px: vLeft, py: vTop }
    );
  }
  if (rand < 0.80) {
    const freeSlots = getAllFreeSlots(occupied, vLeft, vTop, vRight, vBottom, size);
    return freeSlots.length > 0
      ? freeSlots[Math.floor(Math.random() * freeSlots.length)]
      : findFreeSlot(occupied, -50, -50, 100, 100, size) ?? { px: vLeft, py: vTop };
  }
  return {
    px: Math.floor((vLeft + vRight) / 2) - Math.floor(size / 2),
    py: Math.floor((vTop + vBottom) / 2) - Math.floor(size / 2),
  };
}

function collectDescendantIds(notes: Note[], id: string): string[] {
  const out = [id];
  const walk = (parentId: string) => {
    notes.filter((n) => n.parentId === parentId).forEach((child) => {
      out.push(child.id);
      if (child.type === "folder") walk(child.id);
    });
  };
  walk(id);
  return out;
}

function moveIntoFolder(items: Note[], itemIds: string[], folderId: CanvasParentId): Note[] {
  if (itemIds.length === 0) return items;
  const moving = items.filter((n) => itemIds.includes(n.id));
  if (moving.length === 0) return items;
  const minX = Math.min(...moving.map((n) => n.x));
  const minY = Math.min(...moving.map((n) => n.y));
  return items.map((n) => {
    if (!itemIds.includes(n.id)) return n;
    return {
      ...n,
      parentId: folderId,
      x: n.x - minX,
      y: n.y - minY,
    };
  });
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  canvas: { panX: 320, panY: 240 },
  folderPan: { root: { panX: 320, panY: 240 } },
  activeFolderId: null,
  topZ: 10,
  theme: DEFAULT_THEME,
  sidebarOpen: true,
  dockX: null,
  dockY: null,
  coffeeVisible: true,
  badgeMode: null,
  customBadges: [],
  newNoteId: null,
  connections: [],
  connectionMode: null,
  selectedItemIds: [],
  pendingDeletedItemIds: [],
  selectionMode: "normal",
  focusedNoteId: null,
  pendingInsert: null,
  badgeFilter: null,
  noteSearch: "",
  highlightedNoteId: null,

  addNote: () => {
    const { notes, topZ, canvas, sidebarOpen, activeFolderId } = get();
    const slot = findVisibleSlot(notes.map(normalizeItem), activeFolderId, canvas, sidebarOpen, MIN_SIZE);
    const newId = createItemId();
    set({
      notes: [...notes.map(normalizeItem), normalizeItem({
        id: newId,
        type: "note",
        parentId: activeFolderId,
        x: slot.px,
        y: slot.py,
        w: MIN_SIZE,
        h: MIN_SIZE,
        color: randomNoteColor(),
        rotation: randomRotation(),
        title: "",
        body: "",
        locked: false,
        zIndex: topZ + 1,
        badges: [],
        createdAt: new Date().toISOString(),
      })],
      topZ: topZ + 1,
      newNoteId: newId,
    });
  },

  addFolder: (itemIds = get().selectedItemIds) => {
    const state = get();
    const notes = state.notes.map(normalizeItem);
    const folderId = createItemId();
    const slot = findFolderSlot(notes, state.activeFolderId, state.canvas, state.sidebarOpen);
    const folder = normalizeItem({
      id: folderId,
      type: "folder",
      parentId: state.activeFolderId,
      x: slot.px,
      y: slot.py,
      w: FOLDER_SIZE,
      h: FOLDER_SIZE,
      color: "lavender",
      rotation: 0,
      title: "Untitled Folder",
      folderName: "Untitled Folder",
      locked: false,
      zIndex: state.topZ + 1,
      badges: [],
      createdAt: new Date().toISOString(),
    });
    const movableIds = itemIds.filter((id) => id !== folderId);
    set({
      notes: moveIntoFolder([...notes, folder], movableIds, folderId),
      selectedItemIds: [],
      topZ: state.topZ + 1,
    });
    return folderId;
  },

  addPhoto: (url, imagePath = null, caption = "", naturalWidth, naturalHeight) => {
    const { notes, topZ, canvas, sidebarOpen, activeFolderId } = get();
    const normalized = notes.map(normalizeItem);
    const size = photoGridSize(naturalWidth, naturalHeight);
    const slot = findVisibleSlot(normalized, activeFolderId, canvas, sidebarOpen, Math.max(size.w, size.h));
    set({
      notes: [...normalized, normalizeItem({
        id: createItemId(),
        type: "photo",
        parentId: activeFolderId,
        x: slot.px,
        y: slot.py,
        w: size.w,
        h: size.h,
        color: "yellow",
        rotation: randomRotation(),
        title: "",
        body: caption,
        caption,
        imageUrl: url,
        imagePath,
        locked: false,
        zIndex: topZ + 1,
        badges: [],
        createdAt: new Date().toISOString(),
      })],
      topZ: topZ + 1,
    });
  },

  updateNote: (id, patch) =>
    set((s) => ({
      notes: s.notes.map((n) => {
        if (n.id !== id) return normalizeItem(n);
        const next = normalizeItem({ ...n, ...patch });
        if (next.type === "folder") {
          next.folderName = patch.folderName ?? patch.title ?? next.folderName ?? "Untitled Folder";
          next.title = next.folderName;
        }
        if (next.type === "photo") {
          next.caption = patch.caption ?? patch.body ?? next.caption ?? "";
          next.body = next.caption;
        }
        return next;
      }),
    })),

  deleteNote: (id) => get().deleteItemTree(id),

  deleteItemTree: (id) =>
    set((s) => {
      const notes = s.notes.map(normalizeItem);
      const ids = new Set(collectDescendantIds(notes, id));
      return {
        notes: notes.filter((n) => !ids.has(n.id)),
        connections: s.connections.filter((c) => !ids.has(c.sourceId) && !ids.has(c.targetId)),
        selectedItemIds: s.selectedItemIds.filter((selectedId) => !ids.has(selectedId)),
        pendingDeletedItemIds: [...new Set([...s.pendingDeletedItemIds, ...ids])],
        activeFolderId: ids.has(s.activeFolderId ?? "") ? null : s.activeFolderId,
      };
    }),

  consumeDeletedItemIds: (ids) =>
    set((s) => ({
      pendingDeletedItemIds: s.pendingDeletedItemIds.filter((id) => !ids.includes(id)),
    })),

  bringToFront: (id) => {
    const next = get().topZ + 1;
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...normalizeItem(n), zIndex: next } : normalizeItem(n))),
      topZ: next,
    }));
  },

  setPan: (x, y) =>
    set((s) => {
      const key = folderKey(s.activeFolderId);
      return {
        canvas: { panX: x, panY: y },
        folderPan: { ...s.folderPan, [key]: { panX: x, panY: y } },
      };
    }),
  setTheme: (t) => set({ theme: t }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setDockPosition: (x, y) => set({ dockX: x, dockY: y }),
  setCoffeeVisible: (v) => set({ coffeeVisible: v }),
  setBadgeMode: (id) => set({ badgeMode: id }),
  setNewNoteId: (id) => set({ newNoteId: id }),
  addConnection: (sourceId, targetId, color = "#e74c3c") =>
    set((s) => ({ connections: [...s.connections, { id: nanoid(), sourceId, targetId, color }] })),
  deleteConnection: (id) =>
    set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),
  setConnectionMode: (id) => set({ connectionMode: id }),

  openFolder: (id) =>
    set((s) => {
      const key = folderKey(id);
      const canvas = s.folderPan[key] ?? { panX: 320, panY: 240 };
      return { activeFolderId: id, canvas, selectedItemIds: [], badgeFilter: null, connectionMode: null, selectionMode: "normal" };
    }),

  goToParentFolder: () =>
    set((s) => {
      const active = s.notes.map(normalizeItem).find((n) => n.id === s.activeFolderId);
      const parentId = active?.parentId ?? null;
      const canvas = s.folderPan[folderKey(parentId)] ?? { panX: 320, panY: 240 };
      return { activeFolderId: parentId, canvas, selectedItemIds: [], badgeFilter: null, connectionMode: null, selectionMode: "normal" };
    }),

  setActiveFolderId: (id) =>
    set((s) => ({
      activeFolderId: id,
      canvas: s.folderPan[folderKey(id)] ?? { panX: 320, panY: 240 },
      selectedItemIds: [],
      badgeFilter: null,
      connectionMode: null,
    })),

  moveItemsToFolder: (itemIds, folderId) =>
    set((s) => {
      const notes = s.notes.map(normalizeItem);
      const safeIds = itemIds.filter((id) => {
        if (!folderId) return true;
        const item = notes.find((n) => n.id === id);
        if (!item) return false;
        if (item.type !== "folder") return true;
        return id !== folderId && !get().isDescendantFolder(id, folderId);
      });
      return {
        notes: moveIntoFolder(notes, safeIds, folderId),
        selectedItemIds: [],
      };
    }),

  moveItemsByGrid: (itemIds, dx, dy) =>
    set((s) => ({
      notes: s.notes.map((n) => itemIds.includes(n.id) ? { ...normalizeItem(n), x: n.x + dx, y: n.y + dy } : normalizeItem(n)),
    })),

  isDescendantFolder: (folderId, possibleDescendantId) => {
    const notes = get().notes.map(normalizeItem);
    let cursor = notes.find((n) => n.id === possibleDescendantId);
    while (cursor?.parentId) {
      if (cursor.parentId === folderId) return true;
      cursor = notes.find((n) => n.id === cursor?.parentId);
    }
    return false;
  },

  setFocusedNoteId: (id) => set({ focusedNoteId: id }),
  setPendingInsert: (type) => set({ pendingInsert: type }),
  setBadgeFilter: (id) => set({ badgeFilter: id }),
  setNoteSearch: (query) => set({ noteSearch: query }),
  setHighlightedNoteId: (id) => set({ highlightedNoteId: id }),
  setCustomBadges: (badges) => set({ customBadges: badges }),
  addCustomBadge: (badge) => set((s) => ({ customBadges: [...s.customBadges, badge] })),
  deleteCustomBadge: (badgeId) =>
    set((s) => ({
      customBadges: s.customBadges.filter((badge) => badge.id !== badgeId),
      notes: s.notes.map((note) => (
        note.badges.includes(badgeId)
          ? { ...normalizeItem(note), badges: note.badges.filter((id) => id !== badgeId) }
          : normalizeItem(note)
      )),
      badgeMode: s.badgeMode === badgeId ? null : s.badgeMode,
      badgeFilter: s.badgeFilter === badgeId ? null : s.badgeFilter,
    })),
  toggleNoteBadge: (noteId, badgeId) =>
    set((s) => ({
      notes: s.notes.map((n) => {
        const item = normalizeItem(n);
        if (item.id !== noteId) return item;
        const has = item.badges.includes(badgeId);
        return { ...item, badges: has ? item.badges.filter((b) => b !== badgeId) : [...item.badges, badgeId] };
      }),
    })),
  toggleSelectedItem: (id) =>
    set((s) => ({
      selectedItemIds: s.selectedItemIds.includes(id)
        ? s.selectedItemIds.filter((itemId) => itemId !== id)
        : [...s.selectedItemIds, id],
    })),
  setSelectedItems: (ids) => set({ selectedItemIds: ids }),
  clearSelection: () => set({ selectedItemIds: [] }),
  setSelectionMode: (mode) => set({ selectionMode: mode }),
}));
