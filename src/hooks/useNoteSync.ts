"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useNotesStore } from "@/store/notes";
import type { Note } from "@/store/notes";
import type { User } from "@supabase/supabase-js";

const CACHE_KEY  = "nxtaker_notes";
const DEBOUNCE   = 800;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createCloudId() {
  return globalThis.crypto?.randomUUID?.() ?? crypto.randomUUID();
}

function hasCloudId(note: Note) {
  return UUID_RE.test(note.id);
}

function withCloudId(note: Note): Note {
  return hasCloudId(note) ? note : { ...note, id: createCloudId() };
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
  let { error } = await supabase.from("notes").upsert(toRow(note, userId, true));
  if (error) {
    // If the error is about the badges column, retry without it
    const isBadgesError = error.message.toLowerCase().includes("badges") ||
      error.code === "42703"; // undefined_column in postgres
    if (isBadgesError) {
      const retry = await supabase.from("notes").upsert(toRow(note, userId, false));
      error = retry.error;
    }
  }
  return error;
}

// ── Main hook ──────────────────────────────────────────────────────

export function useNoteSync(user: User | null) {
  const { notes } = useNotesStore();
  const [showMergePrompt, setShowMergePrompt] = useState(false);
  const [cachedCount, setCachedCount]         = useState(0);
  const [dbError, setDbError]                 = useState<string | null>(null);
  const supabase = createClient();

  const prevNotes  = useRef<Note[]>([]);
  const timers     = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const loadedFor  = useRef<string | null>(null); // which userId we've loaded

  // ── Load: fires when the logged-in user changes ───────────────────
  useEffect(() => {
    const uid = user?.id ?? null;
    if (loadedFor.current === uid) return;
    loadedFor.current = uid;
    setDbError(null);

    if (user) {
      // First, verify connection with a lightweight probe
      supabase
        .from("notes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .then(({ error: probeErr }) => {
          if (probeErr) {
            setDbError(`DB connection error: ${probeErr.message}. Run the schema SQL in Supabase.`);
            console.error("[useNoteSync] probe failed:", probeErr);
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
          if (error) { setDbError(`Load error: ${error.message}`); return; }
          if (data) {
            const rows = data.map(fromRow);
            useNotesStore.setState({ notes: rows, topZ: Math.max(...rows.map((n) => n.zIndex), 10) });
            prevNotes.current = rows;
          }
          // Check for cached guest notes
          try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (raw) {
              const cached: Note[] = JSON.parse(raw);
              if (cached.length > 0) { setCachedCount(cached.length); setShowMergePrompt(true); }
            }
          } catch { /* ignore */ }
        });

    } else {
      // Guest — load from localStorage
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached: Note[] = JSON.parse(raw);
          if (cached.length > 0) {
            useNotesStore.setState({ notes: cached, topZ: Math.max(...cached.map((n) => n.zIndex), 10) });
            prevNotes.current = cached;
          }
        }
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Persist whenever notes change ─────────────────────────────────
  useEffect(() => {
    if (!user) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(notes)); } catch { /* quota */ }
      prevNotes.current = [...notes];
      return;
    }

    const hasLegacyIds = notes.some((note) => !hasCloudId(note));
    if (hasLegacyIds) {
      const cloudNotes = notes.map(withCloudId);
      useNotesStore.setState({ notes: cloudNotes });
      prevNotes.current = [];
      return;
    }

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
  }, [notes, user?.id]);

  // ── Merge helpers ─────────────────────────────────────────────────
  const mergeLocalToCloud = async () => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) { setShowMergePrompt(false); return; }
      const cached: Note[] = JSON.parse(raw);
      for (const note of cached) {
        const error = await resilientUpsert(supabase, withCloudId(note), user.id);
        if (error) throw error;
      }
      localStorage.removeItem(CACHE_KEY);
      const { data } = await supabase.from("notes").select("*").eq("user_id", user.id).order("created_at");
      if (data) {
        const merged = data.map(fromRow);
        useNotesStore.setState({ notes: merged, topZ: Math.max(...merged.map((n) => n.zIndex), 10) });
        prevNotes.current = merged;
      }
    } catch (e) { console.error("[useNoteSync] merge:", e); }
    setShowMergePrompt(false);
  };

  const discardLocal = () => { localStorage.removeItem(CACHE_KEY); setShowMergePrompt(false); };

  return { showMergePrompt, cachedCount, mergeLocalToCloud, discardLocal, dbError };
}
