"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useNotesStore } from "@/store/notes";
import type { Note } from "@/store/notes";
import type { User } from "@supabase/supabase-js";

const CACHE_KEY = "nxtaker_notes";
const DEBOUNCE_MS = 700;

function toRow(n: Note, userId: string) {
  return {
    id:         n.id,
    user_id:    userId,
    x: n.x,    y: n.y,
    w: n.w,    h: n.h,
    color:      n.color,
    rotation:   n.rotation,
    locked:     n.locked,
    z_index:    n.zIndex,
    title:      n.title,
    body:       n.body,
    badges:     n.badges,
    created_at: n.createdAt,
  };
}

function fromRow(r: Record<string, unknown>): Note {
  return {
    id:        r.id as string,
    x:         r.x as number,  y:  r.y as number,
    w:         r.w as number,  h:  r.h as number,
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

export function useNoteSync(user: User | null) {
  const { notes } = useNotesStore();
  const [showMergePrompt, setShowMergePrompt] = useState(false);
  const [cachedCount, setCachedCount]         = useState(0);
  const supabase = createClient();

  // Refs to avoid stale closures
  const notesRef     = useRef(notes);
  const prevNotesRef = useRef<Note[]>([]);
  const timers       = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  notesRef.current   = notes;

  // Track which user we've already loaded for
  const loadedForUserRef = useRef<string | null>(null);

  // ── Load: runs whenever the logged-in user changes ─────────────
  useEffect(() => {
    const userId = user?.id ?? null;

    // Already loaded for this user — skip
    if (loadedForUserRef.current === userId) return;
    loadedForUserRef.current = userId;

    if (user) {
      // Authenticated: load from Supabase
      supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at")
        .then(({ data, error }) => {
          if (error) {
            console.warn("useNoteSync: load error:", error.message);
            return;
          }
          if (data) {
            const dbNotes = data.map(fromRow);
            useNotesStore.setState({
              notes: dbNotes,
              topZ: dbNotes.length > 0 ? Math.max(...dbNotes.map((n) => n.zIndex), 10) : 10,
            });
            prevNotesRef.current = dbNotes;
          }

          // Check for locally cached notes from a guest session
          try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (raw) {
              const cached: Note[] = JSON.parse(raw);
              if (cached.length > 0) {
                setCachedCount(cached.length);
                setShowMergePrompt(true);
              }
            }
          } catch { /* ignore */ }
        });

    } else {
      // Guest: load from localStorage
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached: Note[] = JSON.parse(raw);
          if (cached.length > 0) {
            useNotesStore.setState({
              notes: cached,
              topZ: Math.max(...cached.map((n) => n.zIndex), 10),
            });
            prevNotesRef.current = cached;
          }
        }
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Auto-persist whenever notes change ──────────────────────────
  useEffect(() => {
    if (user) {
      // Detect and delete removed notes from DB
      const prevIds = new Set(prevNotesRef.current.map((n) => n.id));
      const currIds = new Set(notes.map((n) => n.id));
      const deleted = [...prevIds].filter((id) => !currIds.has(id));
      if (deleted.length > 0) {
        supabase
          .from("notes")
          .delete()
          .in("id", deleted)
          .eq("user_id", user.id)
          .then(({ error }) => { if (error) console.warn("delete error:", error.message); });
      }

      // Debounced upsert for each changed note
      const prev = new Map(prevNotesRef.current.map((n) => [n.id, n]));
      notes.forEach((note) => {
        const p = prev.get(note.id);
        if (p &&
          p.title === note.title && p.body === note.body &&
          p.x === note.x && p.y === note.y && p.w === note.w && p.h === note.h &&
          p.rotation === note.rotation && p.locked === note.locked &&
          p.color === note.color && p.zIndex === note.zIndex &&
          JSON.stringify(p.badges) === JSON.stringify(note.badges)) return;

        const t = timers.current.get(note.id);
        if (t) clearTimeout(t);
        timers.current.set(note.id, setTimeout(() => {
          supabase
            .from("notes")
            .upsert(toRow(note, user.id))
            .then(({ error }) => { if (error) console.warn("upsert error:", error.message); });
          timers.current.delete(note.id);
        }, DEBOUNCE_MS));
      });

    } else {
      // Guest: persist to localStorage
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(notes)); } catch { /* quota */ }
    }

    prevNotesRef.current = [...notes];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  // ── Merge helpers ────────────────────────────────────────────────
  const mergeLocalToCloud = async () => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) { setShowMergePrompt(false); return; }
      const cached: Note[] = JSON.parse(raw);
      await supabase.from("notes").upsert(cached.map((n) => toRow(n, user.id)));
      localStorage.removeItem(CACHE_KEY);
      const { data } = await supabase.from("notes").select("*").eq("user_id", user.id).order("created_at");
      if (data) {
        const merged = data.map(fromRow);
        useNotesStore.setState({ notes: merged, topZ: Math.max(...merged.map((n) => n.zIndex), 10) });
        prevNotesRef.current = merged;
      }
    } catch { /* ignore */ }
    setShowMergePrompt(false);
  };

  const discardLocal = () => {
    localStorage.removeItem(CACHE_KEY);
    setShowMergePrompt(false);
  };

  return { showMergePrompt, cachedCount, mergeLocalToCloud, discardLocal };
}
