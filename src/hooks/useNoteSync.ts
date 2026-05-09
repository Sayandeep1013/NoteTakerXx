"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useNotesStore } from "@/store/notes";
import type { Note } from "@/store/notes";
import type { User } from "@supabase/supabase-js";

const CACHE_KEY  = "nxtaker_notes";
const USER_CACHE_PREFIX = "nxtaker_user_notes_";
const DEBOUNCE   = 800;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  return { ...note, fontSize: note.fontSize ?? 13 };
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

function readGuestCache(): Note[] {
  return readNotesCache(CACHE_KEY);
}

function readUserCache(userId: string): Note[] {
  return readNotesCache(userCacheKey(userId));
}

function writeGuestCache(notes: Note[]) {
  writeNotesCache(CACHE_KEY, notes);
}

function writeUserCache(userId: string, notes: Note[]) {
  writeNotesCache(userCacheKey(userId), notes);
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
    // created_at is set only on INSERT (DB default) — not touched on UPDATE
  };
  if (includeBadges) row.badges = n.badges;
  return row;
}

function fromRow(r: Record<string, unknown>): Note {
  return {
    id:        r.id as string,
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
  };
}

// Try upsert; if 'badges' column is missing, retry without it
async function resilientUpsert(
  supabase: ReturnType<typeof createClient>,
  note: Note,
  userId: string,
) {
  const fullRow = toRow(note, userId, true);
  let { error } = await supabase.from("notes").upsert(fullRow);
  if (error) {
    // If the error is about the badges column, retry without it
    const isBadgesError = error.message.toLowerCase().includes("badges") ||
      error.code === "42703"; // undefined_column in postgres
    if (isBadgesError) {
      const retry = await supabase.from("notes").upsert(toRow(note, userId, false));
      error = retry.error;
    }
    const isFontSizeError = error?.message.toLowerCase().includes("font_size") ||
      error?.code === "42703";
    if (isFontSizeError) {
      const retryRow = { ...fullRow };
      delete retryRow.font_size;
      const retry = await supabase.from("notes").upsert(retryRow);
      error = retry.error;
    }
    if (error?.code === "42703") {
      const retryRow = { ...fullRow };
      delete retryRow.font_size;
      delete retryRow.badges;
      const retry = await supabase.from("notes").upsert(retryRow);
      error = retry.error;
    }
  }
  return error;
}

// ── Main hook ──────────────────────────────────────────────────────

export function useNoteSync(user: User | null, authLoading = false) {
  const { notes } = useNotesStore();
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
            const rows = data.map(fromRow);
            const chosen = rows.length === 0 && cachedForUser.length > 0 ? cachedForUser : rows;
            useNotesStore.setState({ notes: chosen, topZ: safeTopZ(chosen) });
            prevNotes.current = chosen;
            writeUserCache(user.id, chosen);
            if (rows.length === 0 && cachedForUser.length > 0) {
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
    const deleted = [...prevIds].filter((id) => !currIds.has(id));
    if (deleted.length > 0) {
      supabase.from("notes").delete().in("id", deleted).eq("user_id", user.id)
        .then(({ error }) => { if (error) console.error("[useNoteSync] delete:", error.message); });
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
        const error = await resilientUpsert(supabase, withCloudId(note), user.id);
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
