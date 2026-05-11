"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useNotesStore } from "@/store/notes";
import type { Note } from "@/store/notes";
import type { User } from "@supabase/supabase-js";

const CACHE_KEY  = "nxtaker_notes";
const USER_CACHE_PREFIX = "nxtaker_user_notes_";
const USER_CACHE_BACKUP_PREFIX = "nxtaker_user_notes_backup_";
const GUEST_CACHE_BACKUP_KEY = "nxtaker_notes_backup";
const MISSING_NOTE_COLUMNS_KEY = "nxtaker_missing_note_columns";
const PHOTOS_BUCKET_DISABLED_KEY = "nxtaker_photos_bucket_disabled";
const DEBOUNCE   = 800;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CANVAS_DB_COLUMNS = ["type", "parent_id", "folder_name", "image_url", "image_path", "caption", "stroke_points", "stroke_color", "stroke_width"] as const;
const OPTIONAL_DB_COLUMNS = ["badges", "font_size", ...CANVAS_DB_COLUMNS] as const;

type GuestCache = {
  version: 2;
  notes: Note[];
  topZ: number;
  savedAt: string;
};

function createCloudId() {
  return globalThis.crypto?.randomUUID?.() ?? crypto.randomUUID();
}

function hasCloudId(note: Note) {
  return UUID_RE.test(note.id);
}

function withCloudId(note: Note): Note {
  return hasCloudId(note) ? note : { ...note, id: createCloudId() };
}

function safeTopZ(notes: Note[]) {
  return Math.max(10, ...notes.map((n) => n.zIndex));
}

function normalizeNote(note: Note): Note {
  const type = note.type ?? "note";
  return {
    ...note,
    type,
    parentId: note.parentId ?? null,
    fontSize: note.fontSize ?? 13,
    folderName: type === "folder" ? note.folderName ?? note.title ?? "Untitled Folder" : note.folderName,
    caption: type === "photo" ? note.caption ?? note.body ?? "" : note.caption,
    imagePath: note.imagePath ?? null,
    strokePoints: Array.isArray(note.strokePoints) ? note.strokePoints : [],
    strokeColor: note.strokeColor ?? "#7c8fd8",
    strokeWidth: note.strokeWidth ?? 4,
  };
}

function readNotesCache(key: string): Note[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Note[] | GuestCache;
    if (Array.isArray(parsed)) return parsed.map(normalizeNote);
    if (Array.isArray(parsed.notes)) return parsed.notes.map(normalizeNote);
  } catch {}
  return [];
}

function writeNotesCache(key: string, notes: Note[]) {
  const existing = readNotesCache(key);
  if (notes.length === 0 && existing.length > 0) {
    writeNotesCache(`${key}_empty_guard_backup`, existing);
    return;
  }
  const payload: GuestCache = {
    version: 2,
    notes: notes.map(normalizeNote),
    topZ: safeTopZ(notes),
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(key, JSON.stringify(payload));
}

function userCacheKey(userId: string) {
  return `${USER_CACHE_PREFIX}${userId}`;
}

function userBackupCacheKey(userId: string) {
  return `${USER_CACHE_BACKUP_PREFIX}${userId}`;
}

function readGuestCache(): Note[] {
  return readNotesCache(CACHE_KEY);
}

function readUserCache(userId: string): Note[] {
  return readNotesCache(userCacheKey(userId));
}

function writeGuestCache(notes: Note[]) {
  const existing = readGuestCache();
  if (existing.length > 0) writeNotesCache(GUEST_CACHE_BACKUP_KEY, existing);
  writeNotesCache(CACHE_KEY, notes);
}

function writeUserCache(userId: string, notes: Note[]) {
  const existing = readUserCache(userId);
  if (existing.length > 0) writeNotesCache(userBackupCacheKey(userId), existing);
  writeNotesCache(userCacheKey(userId), notes);
}

function readMissingColumns() {
  try {
    const raw = localStorage.getItem(MISSING_NOTE_COLUMNS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set<string>(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

function rememberMissingColumn(column: string) {
  const missing = readMissingColumns();
  missing.add(column);
  localStorage.setItem(MISSING_NOTE_COLUMNS_KEY, JSON.stringify([...missing]));
}

function stripMissingColumns(row: Record<string, unknown>, missing = readMissingColumns()) {
  const next: Record<string, unknown> = { ...row };
  missing.forEach((column) => delete next[column]);
  return next;
}

function columnFromSchemaError(message: string) {
  const quoted = message.match(/'([^']+)' column/i)?.[1];
  if (quoted) return quoted;
  return OPTIONAL_DB_COLUMNS.find((column) => message.toLowerCase().includes(column));
}

// ── Row mapping ────────────────────────────────────────────────────

function toRow(n: Note, userId: string, includeBadges: boolean) {
  const row: Record<string, unknown> = {
    id:       n.id,
    user_id:  userId,
    x: n.x,  y: n.y,
    w: n.w,  h: n.h,
    color:    n.color,
    rotation: n.rotation,
    locked:   n.locked,
    z_index:  n.zIndex,
    title:    n.title,
    body:     n.body,
    font_size: n.fontSize ?? 13,
    type: n.type ?? "note",
    parent_id: n.parentId,
    folder_name: n.folderName ?? null,
    image_url: n.imageUrl ?? null,
    image_path: n.imagePath ?? null,
    caption: n.caption ?? null,
    // created_at is set only on INSERT (DB default) — not touched on UPDATE
  };
  if (n.type === "stroke") {
    row.stroke_points = n.strokePoints ?? [];
    row.stroke_color = n.strokeColor ?? "#7c8fd8";
    row.stroke_width = n.strokeWidth ?? 4;
  }
  if (includeBadges) row.badges = n.badges;
  return row;
}

function fromRow(r: Record<string, unknown>): Note {
  return normalizeNote({
    id:        r.id as string,
    type:      (r.type as Note["type"] | undefined) ?? "note",
    parentId:  (r.parent_id as string | null | undefined) ?? null,
    x:         r.x as number,      y:  r.y as number,
    w:         r.w as number,      h:  r.h as number,
    color:     r.color as Note["color"],
    rotation:  r.rotation as number,
    locked:    r.locked as boolean,
    zIndex:    r.z_index as number,
    title:     r.title as string,
    body:      r.body as string,
    fontSize:  (r.font_size as number | undefined) ?? 13,
    badges:    (r.badges as string[] | null) ?? [],
    createdAt: (r.created_at as string | undefined) ?? new Date().toISOString(),
    folderName: r.folder_name as string | undefined,
    imageUrl:   r.image_url as string | undefined,
    imagePath:  (r.image_path as string | null | undefined) ?? null,
    caption:    r.caption as string | undefined,
    strokePoints: (r.stroke_points as Note["strokePoints"] | null | undefined) ?? [],
    strokeColor: r.stroke_color as string | undefined,
    strokeWidth: r.stroke_width as number | undefined,
  } as Note);
}

// Try upsert; if 'badges' column is missing, retry without it
async function resilientUpsert(
  supabase: ReturnType<typeof createClient>,
  note: Note,
  userId: string,
) {
  const fullRow = toRow(note, userId, true);
  let row = stripMissingColumns(fullRow);
  let { error } = await supabase.from("notes").upsert(row);
  if (error) {
    const msg = error.message.toLowerCase();
    const schemaCacheMiss = msg.includes("schema cache") || error.code === "PGRST204" || error.code === "42703";

    if (schemaCacheMiss) {
      const missingColumn = columnFromSchemaError(error.message);
      if (missingColumn) rememberMissingColumn(missingColumn);
      const retryRow = stripMissingColumns(fullRow);

      let retry = await supabase.from("notes").upsert(retryRow);
      error = retry.error;

      if (error) {
        const broadRow: Record<string, unknown> = { ...fullRow };
        CANVAS_DB_COLUMNS.forEach((column) => {
          delete broadRow[column];
          rememberMissingColumn(column);
        });
        retry = await supabase.from("notes").upsert(broadRow);
        error = retry.error;
      }
    }

    if (error?.code === "42703" || error?.code === "PGRST204") {
      const retryRow: Record<string, unknown> = { ...fullRow };
      delete retryRow.type;
      delete retryRow.parent_id;
      delete retryRow.folder_name;
      delete retryRow.image_url;
      delete retryRow.image_path;
      delete retryRow.caption;
      delete retryRow.font_size;
      delete retryRow.badges;
      const retry = await supabase.from("notes").upsert(retryRow);
      error = retry.error;
    }
  }
  return error;
}

async function uploadGuestPhotoIfNeeded(
  supabase: ReturnType<typeof createClient>,
  note: Note,
  userId: string,
): Promise<Note> {
  if (note.type !== "photo" || !note.imageUrl?.startsWith("data:")) return note;
  if (localStorage.getItem(PHOTOS_BUCKET_DISABLED_KEY) === "1") return note;
  const response = await fetch(note.imageUrl);
  const blob = await response.blob();
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("photos").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) {
    if (error.message.toLowerCase().includes("bucket not found")) {
      localStorage.setItem(PHOTOS_BUCKET_DISABLED_KEY, "1");
    }
    return note;
  }
  const { data } = supabase.storage.from("photos").getPublicUrl(path);
  return { ...note, imageUrl: data.publicUrl, imagePath: path };
}

// ── Main hook ──────────────────────────────────────────────────────

export function useNoteSync(user: User | null, authLoading = false) {
  const { notes, pendingDeletedItemIds, consumeDeletedItemIds } = useNotesStore();
  const [showMergePrompt, setShowMergePrompt] = useState(false);
  const [cachedCount, setCachedCount]         = useState(0);
  const [dbError, setDbError]                 = useState<string | null>(null);
  const [syncReady, setSyncReady]             = useState(false);
  const supabase = createClient();

  const prevNotes  = useRef<Note[]>([]);
  const timers     = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const repairTimers = useRef<number[]>([]);
  const loadedFor  = useRef<string | null | undefined>(undefined); // which userId we've loaded
  const guestHydratedFromCache = useRef(false);
  const latestNotes = useRef<Note[]>(notes);

  useEffect(() => {
    latestNotes.current = notes;
  }, [notes]);

  const clearRepairQueue = () => {
    repairTimers.current.forEach((timer) => clearTimeout(timer));
    repairTimers.current = [];
  };

  const scheduleCloudRepair = (cachedNotes: Note[], userId: string) => {
    clearRepairQueue();
    cachedNotes.map(withCloudId).forEach((note, index) => {
      const timer = window.setTimeout(async () => {
        const error = await resilientUpsert(supabase, note, userId);
        if (error) {
          console.error("[useNoteSync] cache repair:", note.id, error.message);
          return;
        }
        repairTimers.current = repairTimers.current.filter((t) => t !== timer);
      }, 1200 + index * 350);
      repairTimers.current.push(timer);
    });
  };

  // ── Load: fires when the logged-in user changes ───────────────────
  useEffect(() => {
    if (authLoading) return;
    const uid = user?.id ?? null;
    if (loadedFor.current === uid) return;
    loadedFor.current = uid;
    setSyncReady(false);
    setDbError(null);
    clearRepairQueue();

    if (user) {
      const cachedForUser = readUserCache(user.id);
      // First, verify connection with a lightweight probe
      supabase
        .from("notes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .then(({ error: probeErr }) => {
          if (probeErr) {
            setDbError(`DB connection error: ${probeErr.message}. Run the schema SQL in Supabase.`);
            console.error("[useNoteSync] probe failed:", probeErr);
            if (cachedForUser.length > 0) {
              useNotesStore.setState({ notes: cachedForUser, topZ: safeTopZ(cachedForUser) });
              prevNotes.current = cachedForUser;
              scheduleCloudRepair(cachedForUser, user.id);
              setSyncReady(true);
            }
            return;
          }
          // Full load
          return supabase
            .from("notes")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at");
        })
        .then((res) => {
          if (!res) return;
          const { data, error } = res;
          if (error) {
            setDbError(`Load error: ${error.message}`);
            if (cachedForUser.length > 0) {
              useNotesStore.setState({ notes: cachedForUser, topZ: safeTopZ(cachedForUser) });
              prevNotes.current = cachedForUser;
              scheduleCloudRepair(cachedForUser, user.id);
            }
            setSyncReady(true);
            return;
          }
          if (data) {
            const cachedById = new Map(cachedForUser.map((note) => [note.id, normalizeNote(note)]));
            const dbIds = new Set<string>();
            const rows = data.map((row) => {
              const dbItem = fromRow(row);
              dbIds.add(dbItem.id);
              const cached = cachedById.get(dbItem.id);
              if (!cached) return dbItem;
              const hasType = Object.prototype.hasOwnProperty.call(row, "type");
              const hasParent = Object.prototype.hasOwnProperty.call(row, "parent_id");
              const hasFolderName = Object.prototype.hasOwnProperty.call(row, "folder_name");
              const hasImageUrl = Object.prototype.hasOwnProperty.call(row, "image_url");
              const hasImagePath = Object.prototype.hasOwnProperty.call(row, "image_path");
              const hasCaption = Object.prototype.hasOwnProperty.call(row, "caption");
              const hasStrokePoints = Object.prototype.hasOwnProperty.call(row, "stroke_points");
              const cachedHasCanvasIdentity =
                cached.type !== "note" ||
                cached.parentId !== null ||
                Boolean(cached.folderName) ||
                Boolean(cached.imageUrl) ||
                Boolean(cached.caption);
              const preserveCachedCanvasIdentity =
                cachedHasCanvasIdentity &&
                (
                  !hasType ||
                  dbItem.type === "note" ||
                  (!hasParent && cached.parentId !== null) ||
                  (!hasImageUrl && Boolean(cached.imageUrl))
                );
              return normalizeNote({
                ...dbItem,
                type: preserveCachedCanvasIdentity || !hasType ? cached.type : dbItem.type,
                parentId: preserveCachedCanvasIdentity || !hasParent ? cached.parentId : dbItem.parentId,
                folderName: preserveCachedCanvasIdentity || !hasFolderName ? cached.folderName : dbItem.folderName,
                imageUrl: preserveCachedCanvasIdentity || !hasImageUrl ? cached.imageUrl : dbItem.imageUrl,
                imagePath: preserveCachedCanvasIdentity || !hasImagePath ? cached.imagePath : dbItem.imagePath,
                caption: preserveCachedCanvasIdentity || !hasCaption ? cached.caption : dbItem.caption,
                strokePoints: preserveCachedCanvasIdentity || !hasStrokePoints ? cached.strokePoints : dbItem.strokePoints,
                strokeColor: preserveCachedCanvasIdentity ? cached.strokeColor : dbItem.strokeColor,
                strokeWidth: preserveCachedCanvasIdentity ? cached.strokeWidth : dbItem.strokeWidth,
                w: preserveCachedCanvasIdentity || !hasType ? cached.w : dbItem.w,
                h: preserveCachedCanvasIdentity || !hasType ? cached.h : dbItem.h,
                title: preserveCachedCanvasIdentity || !hasType ? cached.title : dbItem.title,
                body: preserveCachedCanvasIdentity || !hasCaption ? cached.body : dbItem.body,
              });
            });
            const cachedOnly = cachedForUser.filter((note) => !dbIds.has(note.id));
            const chosen = rows.length === 0 && cachedForUser.length > 0 ? cachedForUser : [...rows, ...cachedOnly];
            useNotesStore.setState({ notes: chosen, topZ: safeTopZ(chosen) });
            prevNotes.current = chosen;
            writeUserCache(user.id, chosen);
            if (cachedForUser.length > 0) {
              scheduleCloudRepair(cachedForUser, user.id);
            }
          }
          setSyncReady(true);
          // Check for cached guest notes
          const cached = readGuestCache();
          if (cached.length > 0) { setCachedCount(cached.length); setShowMergePrompt(true); }
        });

    } else {
      // Guest — load from localStorage
      const cachedNotes = readGuestCache();
      if (cachedNotes.length > 0) {
        useNotesStore.setState({ notes: cachedNotes, topZ: safeTopZ(cachedNotes) });
        prevNotes.current = cachedNotes;
        guestHydratedFromCache.current = true;
      } else {
        prevNotes.current = [];
        guestHydratedFromCache.current = false;
      }
      const readyTimer = window.setTimeout(() => setSyncReady(true), 0);
      return () => window.clearTimeout(readyTimer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  // ── Persist whenever notes change ─────────────────────────────────
  useEffect(() => {
    if (authLoading || !syncReady) return;
    if (!user) {
      if (notes.length === 0 && guestHydratedFromCache.current) return;
      guestHydratedFromCache.current = false;
      try { writeGuestCache(notes); } catch { /* quota */ }
      prevNotes.current = [...notes];
      return;
    }

    const hasLegacyIds = notes.some((note) => !hasCloudId(note));
    if (hasLegacyIds) {
      const cloudNotes = notes.map(withCloudId);
      useNotesStore.setState({ notes: cloudNotes });
      prevNotes.current = [];
      try { writeUserCache(user.id, cloudNotes); } catch {}
      return;
    }

    try { writeUserCache(user.id, notes); } catch { /* quota */ }

    // Detect deletions
    const prevIds = new Set(prevNotes.current.map((n) => n.id));
    const currIds = new Set(notes.map((n) => n.id));
    const deleted = [...prevIds].filter((id) => !currIds.has(id) && pendingDeletedItemIds.includes(id));
    if (deleted.length > 0) {
      const deletedPhotoPaths = prevNotes.current
        .filter((n) => deleted.includes(n.id) && n.type === "photo" && n.imagePath)
        .map((n) => n.imagePath as string);
      if (deletedPhotoPaths.length > 0) {
        supabase.storage.from("photos").remove(deletedPhotoPaths)
          .then(({ error }) => { if (error) console.error("[useNoteSync] photo delete:", error.message); });
      }
      supabase.from("notes").delete().in("id", deleted).eq("user_id", user.id)
        .then(({ error }) => {
          if (error) console.error("[useNoteSync] delete:", error.message);
          else consumeDeletedItemIds(deleted);
        });
    }

    // Debounced upsert for changed notes
    const prev = new Map(prevNotes.current.map((n) => [n.id, n]));
    notes.forEach((note) => {
      const p = prev.get(note.id);
      const unchanged = p &&
        p.title === note.title && p.body === note.body &&
        p.x === note.x && p.y === note.y && p.w === note.w && p.h === note.h &&
        p.rotation === note.rotation && p.locked === note.locked &&
        p.color === note.color && p.zIndex === note.zIndex &&
        p.type === note.type && (p.parentId ?? null) === (note.parentId ?? null) &&
        (p.folderName ?? "") === (note.folderName ?? "") &&
        (p.imageUrl ?? "") === (note.imageUrl ?? "") &&
        (p.imagePath ?? "") === (note.imagePath ?? "") &&
        (p.caption ?? "") === (note.caption ?? "") &&
        JSON.stringify(p.strokePoints ?? []) === JSON.stringify(note.strokePoints ?? []) &&
        (p.strokeColor ?? "") === (note.strokeColor ?? "") &&
        (p.strokeWidth ?? 4) === (note.strokeWidth ?? 4) &&
        (p.fontSize ?? 13) === (note.fontSize ?? 13) &&
        JSON.stringify(p.badges) === JSON.stringify(note.badges);
      if (unchanged) return;

      const t = timers.current.get(note.id);
      if (t) clearTimeout(t);
      timers.current.set(note.id, setTimeout(async () => {
        setDbError(null);
        const error = await resilientUpsert(supabase, note, user.id);
        if (error) {
          setDbError(`Save error: ${error.message}`);
          console.error("[useNoteSync] upsert:", note.id, error.message);
        }
        timers.current.delete(note.id);
      }, DEBOUNCE));
    });

    prevNotes.current = [...notes];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, notes, syncReady, user?.id]);

  // ── Merge helpers ─────────────────────────────────────────────────
  const mergeLocalToCloud = async () => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) { setShowMergePrompt(false); return; }
      const cached = readGuestCache();
      for (const note of cached) {
        const cloudReady = await uploadGuestPhotoIfNeeded(supabase, withCloudId(note), user.id);
        const error = await resilientUpsert(supabase, cloudReady, user.id);
        if (error) throw error;
      }
      localStorage.removeItem(CACHE_KEY);
      const { data } = await supabase.from("notes").select("*").eq("user_id", user.id).order("created_at");
      if (data) {
        const merged = data.map(fromRow);
        useNotesStore.setState({ notes: merged, topZ: safeTopZ(merged) });
        prevNotes.current = merged;
        writeUserCache(user.id, merged);
      }
    } catch (e) { console.error("[useNoteSync] merge:", e); }
    setShowMergePrompt(false);
  };

  const discardLocal = () => { localStorage.removeItem(CACHE_KEY); setShowMergePrompt(false); };

  useEffect(() => {
    if (authLoading) return;
    const flush = () => {
      try {
        if (user) writeUserCache(user.id, latestNotes.current);
        else writeGuestCache(latestNotes.current);
      } catch {}
    };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [authLoading, user]);

  useEffect(() => () => clearRepairQueue(), []);

  return { showMergePrompt, cachedCount, mergeLocalToCloud, discardLocal, dbError };
}
