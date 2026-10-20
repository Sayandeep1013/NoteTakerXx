import { create } from "zustand";
import { nanoid } from "nanoid";
import { NoteColor, NOTE_COLOR_KEYS } from "@/lib/colors";
import { ThemeName, DEFAULT_THEME } from "@/lib/themes";
import { GRID, MAX_ZOOM, MIN_NOTE_SIZE, MIN_ZOOM } from "@/lib/constants";

export type { NoteColor };
export type { ThemeName };

const ROTATIONS = [-2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5];
const FOLDER_SIZE = 1;
const PHOTO_W = 4;
const PHOTO_H = 5;
const DEFAULT_ZOOM = 1;
const DEFAULT_VIEW: CanvasViewport = { panX: 320, panY: 240, zoom: DEFAULT_ZOOM };
// Collapsed dock button sits at the bottom-right; keep new items clear of it.
const DOCK_INSET_CLOSED = 48;

export type CanvasItemType = "note" | "folder" | "photo" | "stroke";
export type CanvasParentId = string | null;
export type DockSide = "bottom" | "left";

export interface StrokePoint {
  x: number;
  y: number;
}

function createItemId() {
  return globalThis.crypto?.randomUUID?.() ?? nanoid();
}

export interface CustomBadge {
  id: string;
  label: string;
  url: string;
}


export type AnchorSide = "top" | "bottom" | "left" | "right";

export interface DemoNoteSeed {
  title: string;
  body: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: NoteColor;
  rotation?: number;
}

export interface DemoPhotoSeed {
  url: string;
  caption: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
}

export interface DemoStrokeSeed {
  points: StrokePoint[];
  color: string;
  width?: number;
}

export interface DemoConnectionSeed {
  sourceType: "note" | "photo";
  sourceIdx: number;
  targetType: "note" | "photo";
  targetIdx: number;
  connectionType: "rope" | "arrow";
  sourceAnchor?: AnchorSide;
  targetAnchor?: AnchorSide;
  color?: string;
}

export interface FullDemoSpec {
  notes: DemoNoteSeed[];
  photos?: DemoPhotoSeed[];
  strokes?: DemoStrokeSeed[];
  connections?: DemoConnectionSeed[];
  initialCanvas?: { panX: number; panY: number; zoom: number };
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  color: string;
  connectionType?: "rope" | "arrow";
  sourceAnchor?: AnchorSide;
  targetAnchor?: AnchorSide;
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
  strokePoints?: StrokePoint[];
  strokeColor?: string;
  strokeWidth?: number;
}

export interface CanvasViewport {
  panX: number;
  panY: number;
  zoom: number;
}

type ExclusiveMode = "drawingMode" | "eraserMode" | "arrowMode" | "ropeMode";

interface NotesStore {
  notes: Note[];
  canvas: CanvasViewport;
  folderPan: Record<string, CanvasViewport>;
  activeFolderId: CanvasParentId;
  topZ: number;
  theme: ThemeName;
  sidebarOpen: boolean;
  dockSide: DockSide;
  coffeeVisible: boolean;
  badgeMode: string | null;
  customBadges: CustomBadge[];
  newNoteId: string | null;
  connections: Connection[];
  connectionMode: string | null;
  selectedItemIds: string[];
  pendingDeletedItemIds: string[];
  selectionMode: "normal" | "import";
  universalSearchOpen: boolean;
  drawingMode: boolean;
  eraserMode: boolean;
  strokeColor: string;
  dotGridEffect: boolean;
  arrowMode: boolean;
  arrowSourceId: string | null;
  arrowSourceAnchor: AnchorSide | null;
  ropeMode: boolean;
  syncReady: boolean;
  badgeFilter: string | null;
  highlightedNoteId: string | null;

  addNote: () => void;
  addNoteWithContent: (content: { title?: string; body?: string }) => void;
  addFolder: (itemIds?: string[]) => string;
  addPhoto: (url: string, imagePath?: string | null, caption?: string, naturalWidth?: number, naturalHeight?: number) => void;
  addStroke: (points: StrokePoint[], color: string, width?: number) => void;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  deleteItemTree: (id: string) => void;
  consumeDeletedItemIds: (ids: string[]) => void;
  bringToFront: (id: string) => void;
  setPan: (x: number, y: number) => void;
  setView: (view: CanvasViewport) => void;
  setZoom: (zoom: number, anchor?: { x: number; y: number }) => void;
  zoomBy: (factor: number, anchor?: { x: number; y: number }) => void;
  resetZoom: () => void;
  focusItem: (id: string) => void;
  setTheme: (t: ThemeName) => void;
  setSidebarOpen: (v: boolean) => void;
  setDockSide: (side: DockSide) => void;
  setCoffeeVisible: (v: boolean) => void;
  setBadgeMode: (id: string | null) => void;
  toggleNoteBadge: (noteId: string, badgeId: string) => void;
  addCustomBadge: (badge: CustomBadge) => void;
  deleteCustomBadge: (badgeId: string) => void;
  setCustomBadges: (badges: CustomBadge[]) => void;
  setNewNoteId: (id: string | null) => void;
  addConnection: (sourceId: string, targetId: string, color?: string, connectionType?: "rope" | "arrow", sourceAnchor?: AnchorSide, targetAnchor?: AnchorSide) => void;
  deleteConnection: (id: string) => void;
  setConnectionMode: (id: string | null) => void;
  setDotGridEffect: (v: boolean) => void;
  setArrowMode: (active: boolean) => void;
  setArrowSource: (noteId: string | null, anchor?: AnchorSide) => void;
  setRopeMode: (active: boolean) => void;
  setSyncReady: (v: boolean) => void;
  seedFullDemo: (spec: FullDemoSpec) => void;
  openFolder: (id: string) => void;
  goToParentFolder: () => void;
  setActiveFolderId: (id: CanvasParentId) => void;
  moveItemsToFolder: (itemIds: string[], folderId: CanvasParentId) => void;
  moveItemsByGrid: (itemIds: string[], dx: number, dy: number) => void;
  isDescendantFolder: (folderId: string, possibleDescendantId: string) => boolean;
  setBadgeFilter: (id: string | null) => void;
  setHighlightedNoteId: (id: string | null) => void;
  toggleSelectedItem: (id: string) => void;
  setSelectedItems: (ids: string[]) => void;
  clearSelection: () => void;
  setSelectionMode: (mode: "normal" | "import") => void;
  setUniversalSearchOpen: (open: boolean) => void;
  setDrawingMode: (active: boolean) => void;
  setEraserMode: (active: boolean) => void;
  setStrokeColor: (color: string) => void;
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

function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function noteSizeForZoom(zoom: number) {
  const screenSize = MIN_NOTE_SIZE * GRID;
  return Math.max(MIN_NOTE_SIZE, Math.min(12, Math.round(screenSize / (GRID * zoom))));
}

function photoGridSize(naturalWidth?: number, naturalHeight?: number) {
  const aspect = naturalWidth && naturalHeight ? naturalWidth / naturalHeight : 0.8;
  if (!Number.isFinite(aspect) || aspect <= 0) return { w: PHOTO_W, h: PHOTO_H };
  if (aspect >= 1.25) return { w: Math.min(8, Math.max(5, Math.round(4 * aspect))), h: 4 };
  if (aspect <= 0.8) return { w: 4, h: Math.min(9, Math.max(5, Math.round(4 / aspect) + 1)) };
  return { w: PHOTO_W, h: PHOTO_H };
}

function strokeBounds(points: StrokePoint[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    x: Math.floor(minX / GRID),
    y: Math.floor(minY / GRID),
    w: Math.max(1, Math.ceil((maxX - minX) / GRID)),
    h: Math.max(1, Math.ceil((maxY - minY) / GRID)),
  };
}

function normalizeItem(item: Partial<Note> & { id: string }): Note {
  const type = item.type ?? "note";
  const folderName = item.folderName ?? (type === "folder" ? item.title || "Untitled Folder" : undefined);
  const caption = item.caption ?? (type === "photo" ? item.body || "" : undefined);
  const strokePoints = Array.isArray(item.strokePoints) ? item.strokePoints : [];
  return {
    id: item.id,
    type,
    parentId: item.parentId ?? null,
    x: item.x ?? 0,
    y: item.y ?? 0,
    w: item.w ?? (type === "folder" ? FOLDER_SIZE : type === "photo" ? PHOTO_W : type === "stroke" ? 1 : MIN_NOTE_SIZE),
    h: item.h ?? (type === "folder" ? FOLDER_SIZE : type === "photo" ? PHOTO_H : type === "stroke" ? 1 : MIN_NOTE_SIZE),
    color: item.color ?? randomNoteColor(),
    rotation: item.rotation ?? (type === "folder" || type === "stroke" ? 0 : randomRotation()),
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
    strokePoints,
    strokeColor: item.strokeColor ?? "#7c8fd8",
    strokeWidth: item.strokeWidth ?? 4,
  };
}

function isSlotFree(occupied: Set<string>, col: number, row: number, size = MIN_NOTE_SIZE): boolean {
  for (let dx = 0; dx < size; dx++)
    for (let dy = 0; dy < size; dy++)
      if (occupied.has(`${col + dx},${row + dy}`)) return false;
  return true;
}

function freeSlots(
  occupied: Set<string>,
  colStart: number,
  rowStart: number,
  colEnd: number,
  rowEnd: number,
  size: number,
  firstOnly: boolean,
): { px: number; py: number }[] {
  const slots: { px: number; py: number }[] = [];
  for (let row = rowStart; row <= rowEnd - size; row++)
    for (let col = colStart; col <= colEnd - size; col++)
      if (isSlotFree(occupied, col, row, size)) {
        slots.push({ px: col, py: row });
        if (firstOnly) return slots;
      }
  return slots;
}

function occupiedCells(notes: Note[], parentId: CanvasParentId) {
  const cells = new Set<string>();
  for (const n of notes) {
    if (n.parentId !== parentId || n.type === "stroke") continue;
    for (let cx = n.x; cx < n.x + n.w; cx++)
      for (let cy = n.y; cy < n.y + n.h; cy++)
        cells.add(`${cx},${cy}`);
  }
  return cells;
}

function visibleGridBounds(canvas: CanvasViewport, sidebarOpen: boolean) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const inset = sidebarOpen ? 0 : DOCK_INSET_CLOSED;
  const z = canvas.zoom || DEFAULT_ZOOM;
  return {
    left: Math.ceil((-canvas.panX + inset) / (GRID * z)),
    top: Math.floor(-canvas.panY / (GRID * z)),
    right: Math.ceil((-canvas.panX + vw) / (GRID * z)),
    bottom: Math.ceil((-canvas.panY + vh) / (GRID * z)),
  };
}

function findFolderSlot(notes: Note[], parentId: CanvasParentId, canvas: CanvasViewport, sidebarOpen: boolean) {
  const v = visibleGridBounds(canvas, sidebarOpen);
  const occupied = occupiedCells(notes, parentId);
  for (let col = v.left; col <= v.right; col += 1) {
    for (let row = v.top; row <= v.bottom; row += 2) {
      if (isSlotFree(occupied, col, row, FOLDER_SIZE)) return { px: col, py: row };
    }
  }
  return freeSlots(occupied, -50, -50, 100, 100, FOLDER_SIZE, true)[0] ?? { px: v.left, py: v.top };
}

function findVisibleSlot(notes: Note[], parentId: CanvasParentId, canvas: CanvasViewport, sidebarOpen: boolean, size = MIN_NOTE_SIZE) {
  const v = visibleGridBounds(canvas, sidebarOpen);
  const occupied = occupiedCells(notes, parentId);
  const fallback = () => freeSlots(occupied, -50, -50, 100, 100, size, true)[0] ?? { px: v.left, py: v.top };
  const rand = Math.random();

  if (rand < 0.2) {
    return freeSlots(occupied, v.left, v.top, v.right, v.bottom, size, true)[0] ?? fallback();
  }
  if (rand < 0.8) {
    const slots = freeSlots(occupied, v.left, v.top, v.right, v.bottom, size, false);
    return slots.length > 0 ? slots[Math.floor(Math.random() * slots.length)] : fallback();
  }
  return {
    px: Math.floor((v.left + v.right) / 2) - Math.floor(size / 2),
    py: Math.floor((v.top + v.bottom) / 2) - Math.floor(size / 2),
  };
}

function collectDescendantIds(notes: Note[], id: string): string[] {
  const out = [id];
  const walk = (parentId: string) => {
    for (const child of notes) {
      if (child.parentId !== parentId) continue;
      out.push(child.id);
      if (child.type === "folder") walk(child.id);
    }
  };
  walk(id);
  return out;
}

function moveIntoFolder(items: Note[], itemIds: string[], folderId: CanvasParentId): Note[] {
  if (itemIds.length === 0) return items;
  const ids = new Set(itemIds);
  const moving = items.filter((n) => ids.has(n.id));
  if (moving.length === 0) return items;
  const minX = Math.min(...moving.map((n) => n.x));
  const minY = Math.min(...moving.map((n) => n.y));
  return items.map((n) => (ids.has(n.id) ? { ...n, parentId: folderId, x: n.x - minX, y: n.y - minY } : n));
}

/** Turning one tool mode on turns the others off (and cancels pending picks). */
function exclusiveMode(mode: ExclusiveMode, active: boolean): Partial<NotesStore> {
  const patch: Partial<NotesStore> = { [mode]: active, arrowSourceId: null, arrowSourceAnchor: null };
  if (!active) return patch;
  for (const other of ["drawingMode", "eraserMode", "arrowMode", "ropeMode"] as const) {
    if (other !== mode) patch[other] = false;
  }
  patch.badgeMode = null;
  patch.connectionMode = null;
  return patch;
}

export const useNotesStore = create<NotesStore>((set, get) => {
  /** Adds a plain note in a free visible slot. Returns the new id. */
  const createNote = (title: string, body: string) => {
    const { notes, topZ, canvas, sidebarOpen, activeFolderId } = get();
    const size = noteSizeForZoom(canvas.zoom || DEFAULT_ZOOM);
    const slot = findVisibleSlot(notes, activeFolderId, canvas, sidebarOpen, size);
    const id = createItemId();
    set({
      notes: [...notes, normalizeItem({
        id, type: "note", parentId: activeFolderId,
        x: slot.px, y: slot.py, w: size, h: size,
        title, body, zIndex: topZ + 1,
      })],
      topZ: topZ + 1,
    });
    return id;
  };

  const saveView = (s: NotesStore, canvas: CanvasViewport) => ({
    canvas,
    folderPan: { ...s.folderPan, [folderKey(s.activeFolderId)]: canvas },
  });

  return {
    notes: [],
    canvas: DEFAULT_VIEW,
    folderPan: { root: DEFAULT_VIEW },
    activeFolderId: null,
    topZ: 10,
    theme: DEFAULT_THEME,
    sidebarOpen: true,
    dockSide: "bottom",
    coffeeVisible: true,
    badgeMode: null,
    customBadges: [],
    newNoteId: null,
    connections: [],
    connectionMode: null,
    selectedItemIds: [],
    pendingDeletedItemIds: [],
    selectionMode: "normal",
    universalSearchOpen: false,
    drawingMode: false,
    eraserMode: false,
    strokeColor: "#7c8fd8",
    dotGridEffect: true,
    arrowMode: false,
    arrowSourceId: null,
    arrowSourceAnchor: null,
    ropeMode: false,
    syncReady: false,
    badgeFilter: null,
    highlightedNoteId: null,

    addNote: () => {
      const id = createNote("", "");
      set({ newNoteId: id });
    },

    // Pasted content doesn't need auto-focus, so no newNoteId here.
    addNoteWithContent: ({ title = "", body = "" }) => { createNote(title, body); },

    addFolder: (itemIds = get().selectedItemIds) => {
      const state = get();
      const folderId = createItemId();
      const slot = findFolderSlot(state.notes, state.activeFolderId, state.canvas, state.sidebarOpen);
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
        zIndex: state.topZ + 1,
      });
      set({
        notes: moveIntoFolder([...state.notes, folder], itemIds.filter((id) => id !== folderId), folderId),
        selectedItemIds: [],
        topZ: state.topZ + 1,
      });
      return folderId;
    },

    addPhoto: (url, imagePath = null, caption = "", naturalWidth, naturalHeight) => {
      const { notes, topZ, canvas, sidebarOpen, activeFolderId } = get();
      const size = photoGridSize(naturalWidth, naturalHeight);
      const slot = findVisibleSlot(notes, activeFolderId, canvas, sidebarOpen, Math.max(size.w, size.h));
      set({
        notes: [...notes, normalizeItem({
          id: createItemId(),
          type: "photo",
          parentId: activeFolderId,
          x: slot.px,
          y: slot.py,
          w: size.w,
          h: size.h,
          color: "yellow",
          title: "",
          body: caption,
          caption,
          imageUrl: url,
          imagePath,
          zIndex: topZ + 1,
        })],
        topZ: topZ + 1,
      });
    },

    addStroke: (points, color, width = 4) => {
      if (points.length < 2) return;
      const state = get();
      set({
        notes: [...state.notes, normalizeItem({
          id: createItemId(),
          type: "stroke",
          parentId: state.activeFolderId,
          ...strokeBounds(points),
          color: "lavender",
          zIndex: state.topZ + 1,
          strokePoints: points,
          strokeColor: color,
          strokeWidth: width,
        })],
        topZ: state.topZ + 1,
      });
    },

    updateNote: (id, patch) =>
      set((s) => ({
        notes: s.notes.map((n) => {
          if (n.id !== id) return n;
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
        const ids = new Set(collectDescendantIds(s.notes, id));
        const nextFolderPan = { ...s.folderPan };
        ids.forEach((deletedId) => { delete nextFolderPan[deletedId]; });
        return {
          notes: s.notes.filter((n) => !ids.has(n.id)),
          connections: s.connections.filter((c) => !ids.has(c.sourceId) && !ids.has(c.targetId)),
          selectedItemIds: s.selectedItemIds.filter((selectedId) => !ids.has(selectedId)),
          pendingDeletedItemIds: [...new Set([...s.pendingDeletedItemIds, ...ids])],
          activeFolderId: ids.has(s.activeFolderId ?? "") ? null : s.activeFolderId,
          folderPan: nextFolderPan,
        };
      }),

    consumeDeletedItemIds: (ids) =>
      set((s) => ({
        pendingDeletedItemIds: s.pendingDeletedItemIds.filter((id) => !ids.includes(id)),
      })),

    bringToFront: (id) => {
      const { notes, topZ } = get();
      // Already on top: skip the write so we don't trigger a re-render + cloud save.
      if (notes.find((n) => n.id === id)?.zIndex === topZ) return;
      const next = topZ + 1;
      set({
        notes: notes.map((n) => (n.id === id ? { ...n, zIndex: next } : n)),
        topZ: next,
      });
    },

    setPan: (x, y) => set((s) => saveView(s, { panX: x, panY: y, zoom: s.canvas.zoom || DEFAULT_ZOOM })),
    setView: (view) => set((s) => saveView(s, { ...view, zoom: clampZoom(view.zoom) })),
    setZoom: (zoom, anchor) =>
      set((s) => {
        const nextZoom = clampZoom(zoom);
        const prevZoom = s.canvas.zoom || DEFAULT_ZOOM;
        if (nextZoom === prevZoom) return {};
        const point = anchor ?? {
          x: typeof window !== "undefined" ? window.innerWidth / 2 : 640,
          y: typeof window !== "undefined" ? window.innerHeight / 2 : 400,
        };
        const worldX = (point.x - s.canvas.panX) / prevZoom;
        const worldY = (point.y - s.canvas.panY) / prevZoom;
        return saveView(s, {
          panX: point.x - worldX * nextZoom,
          panY: point.y - worldY * nextZoom,
          zoom: nextZoom,
        });
      }),
    zoomBy: (factor, anchor) => get().setZoom((get().canvas.zoom || DEFAULT_ZOOM) * factor, anchor),
    resetZoom: () => get().setZoom(DEFAULT_ZOOM),

    focusItem: (id) => {
      const item = get().notes.find((n) => n.id === id);
      if (!item) return;
      // Only switch canvases when needed: switching resets pending rope/selection state.
      if ((item.parentId ?? null) !== get().activeFolderId) get().setActiveFolderId(item.parentId ?? null);
      const z = get().canvas.zoom || DEFAULT_ZOOM;
      get().setPan(
        window.innerWidth / 2 - (item.x + item.w / 2) * GRID * z,
        window.innerHeight / 2 - (item.y + item.h / 2) * GRID * z,
      );
      get().bringToFront(id);
      set({ highlightedNoteId: id });
    },

    setTheme: (t) => set({ theme: t }),
    setSidebarOpen: (v) => set({ sidebarOpen: v }),
    setDockSide: (side) => set({ dockSide: side }),
    setCoffeeVisible: (v) => set({ coffeeVisible: v }),
    setBadgeMode: (id) =>
      set(id
        ? { badgeMode: id, drawingMode: false, eraserMode: false, arrowMode: false, ropeMode: false, connectionMode: null, arrowSourceId: null, arrowSourceAnchor: null }
        : { badgeMode: null }),
    setNewNoteId: (id) => set({ newNoteId: id }),
    addConnection: (sourceId, targetId, color = "#e74c3c", connectionType = "rope", sourceAnchor, targetAnchor) =>
      set((s) => ({ connections: [...s.connections, { id: createItemId(), sourceId, targetId, color, connectionType, sourceAnchor, targetAnchor }] })),
    deleteConnection: (id) =>
      set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),
    setConnectionMode: (id) => set({ connectionMode: id }),
    setDotGridEffect: (v) => set({ dotGridEffect: v }),
    setArrowMode: (active) => set(exclusiveMode("arrowMode", active)),
    setRopeMode: (active) => set(active ? exclusiveMode("ropeMode", true) : { ropeMode: false, connectionMode: null }),
    setDrawingMode: (active) => set(exclusiveMode("drawingMode", active)),
    setEraserMode: (active) => set(exclusiveMode("eraserMode", active)),
    setSyncReady: (v) => set({ syncReady: v }),

    seedFullDemo: (spec) => {
      const state = get();
      let nextZ = state.topZ;
      const now = new Date().toISOString();

      const noteIds: string[] = [];
      const demoNotes = spec.notes.map((seed) => {
        const id = createItemId();
        noteIds.push(id);
        nextZ += 1;
        return normalizeItem({
          id, type: "note", parentId: null,
          x: seed.x, y: seed.y, w: seed.w, h: seed.h,
          color: seed.color, rotation: seed.rotation ?? 0,
          title: seed.title, body: seed.body,
          zIndex: nextZ, createdAt: now,
        });
      });

      const photoIds: string[] = [];
      const demoPhotos = (spec.photos ?? []).map((seed) => {
        const id = createItemId();
        photoIds.push(id);
        nextZ += 1;
        return normalizeItem({
          id, type: "photo", parentId: null,
          x: seed.x, y: seed.y, w: seed.w, h: seed.h,
          color: "yellow", rotation: seed.rotation ?? 0,
          title: "", body: seed.caption, caption: seed.caption,
          imageUrl: seed.url, imagePath: null,
          zIndex: nextZ, createdAt: now,
        });
      });

      const demoStrokes = (spec.strokes ?? [])
        .filter((seed) => seed.points.length >= 2)
        .map((seed) => {
          nextZ += 1;
          return normalizeItem({
            id: createItemId(), type: "stroke", parentId: null,
            ...strokeBounds(seed.points),
            color: "lavender", rotation: 0,
            zIndex: nextZ, createdAt: now,
            strokePoints: seed.points, strokeColor: seed.color, strokeWidth: seed.width ?? 4,
          });
        });

      const demoConnections = (spec.connections ?? []).map((conn): Connection => ({
        id: createItemId(),
        sourceId: conn.sourceType === "note" ? noteIds[conn.sourceIdx] : photoIds[conn.sourceIdx],
        targetId: conn.targetType === "note" ? noteIds[conn.targetIdx] : photoIds[conn.targetIdx],
        color: conn.color ?? "#e74c3c",
        connectionType: conn.connectionType,
        sourceAnchor: conn.sourceAnchor,
        targetAnchor: conn.targetAnchor,
      }));

      const nextCanvas = spec.initialCanvas ?? state.canvas;
      set({
        notes: [...state.notes, ...demoNotes, ...demoPhotos, ...demoStrokes],
        connections: [...state.connections, ...demoConnections],
        topZ: nextZ,
        canvas: nextCanvas,
        folderPan: { ...state.folderPan, [folderKey(state.activeFolderId)]: nextCanvas },
      });
    },

    setArrowSource: (noteId, anchor) => set({ arrowSourceId: noteId ?? null, arrowSourceAnchor: anchor ?? null }),

    openFolder: (id) =>
      set((s) => ({
        activeFolderId: id,
        canvas: s.folderPan[folderKey(id)] ?? DEFAULT_VIEW,
        selectedItemIds: [],
        badgeFilter: null,
        connectionMode: null,
        selectionMode: "normal",
      })),

    goToParentFolder: () =>
      set((s) => {
        const parentId = s.notes.find((n) => n.id === s.activeFolderId)?.parentId ?? null;
        return {
          activeFolderId: parentId,
          canvas: s.folderPan[folderKey(parentId)] ?? DEFAULT_VIEW,
          selectedItemIds: [],
          badgeFilter: null,
          connectionMode: null,
          selectionMode: "normal",
        };
      }),

    setActiveFolderId: (id) =>
      set((s) => ({
        activeFolderId: id,
        canvas: s.folderPan[folderKey(id)] ?? DEFAULT_VIEW,
        selectedItemIds: [],
        badgeFilter: null,
        connectionMode: null,
      })),

    moveItemsToFolder: (itemIds, folderId) =>
      set((s) => {
        const safeIds = itemIds.filter((id) => {
          if (!folderId) return true;
          const item = s.notes.find((n) => n.id === id);
          if (!item) return false;
          if (item.type !== "folder") return true;
          return id !== folderId && !get().isDescendantFolder(id, folderId);
        });
        return {
          notes: moveIntoFolder(s.notes, safeIds, folderId),
          selectedItemIds: [],
        };
      }),

    moveItemsByGrid: (itemIds, dx, dy) =>
      set((s) => {
        const ids = new Set(itemIds);
        return { notes: s.notes.map((n) => (ids.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)) };
      }),

    isDescendantFolder: (folderId, possibleDescendantId) => {
      const notes = get().notes;
      let cursor = notes.find((n) => n.id === possibleDescendantId);
      while (cursor?.parentId) {
        if (cursor.parentId === folderId) return true;
        cursor = notes.find((n) => n.id === cursor?.parentId);
      }
      return false;
    },

    setBadgeFilter: (id) => set({ badgeFilter: id }),
    setHighlightedNoteId: (id) => set({ highlightedNoteId: id }),
    setCustomBadges: (badges) => set({ customBadges: badges }),
    addCustomBadge: (badge) => set((s) => ({ customBadges: [...s.customBadges, badge] })),
    deleteCustomBadge: (badgeId) =>
      set((s) => ({
        customBadges: s.customBadges.filter((badge) => badge.id !== badgeId),
        notes: s.notes.map((note) =>
          note.badges.includes(badgeId)
            ? { ...note, badges: note.badges.filter((id) => id !== badgeId) }
            : note
        ),
        badgeMode: s.badgeMode === badgeId ? null : s.badgeMode,
        badgeFilter: s.badgeFilter === badgeId ? null : s.badgeFilter,
      })),
    toggleNoteBadge: (noteId, badgeId) =>
      set((s) => ({
        notes: s.notes.map((n) => {
          if (n.id !== noteId) return n;
          const has = n.badges.includes(badgeId);
          return { ...n, badges: has ? n.badges.filter((b) => b !== badgeId) : [...n.badges, badgeId] };
        }),
      })),
    toggleSelectedItem: (id) =>
      set((s) => ({
        selectedItemIds: s.selectedItemIds.includes(id)
          ? s.selectedItemIds.filter((itemId) => itemId !== id)
          : [...s.selectedItemIds, id],
      })),
    setSelectedItems: (ids) => set({ selectedItemIds: ids }),
    clearSelection: () => { if (get().selectedItemIds.length) set({ selectedItemIds: [] }); },
    setSelectionMode: (mode) => set({ selectionMode: mode }),
    setUniversalSearchOpen: (open) => set({ universalSearchOpen: open }),
    setStrokeColor: (color) => set({ strokeColor: color }),
  };
});
