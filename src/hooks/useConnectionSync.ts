"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useNotesStore, type Connection } from "@/store/notes";
import type { User } from "@supabase/supabase-js";

const DEBOUNCE = 1000;

function toRow(c: Connection, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    source_note_id: c.sourceId,
    target_note_id: c.targetId,
    color: c.color,
    connection_type: c.connectionType ?? "rope",
    source_anchor: c.sourceAnchor ?? null,
    target_anchor: c.targetAnchor ?? null,
  };
}

function fromRow(r: Record<string, unknown>): Connection {
  return {
    id: r.id as string,
    sourceId: r.source_note_id as string,
    targetId: r.target_note_id as string,
    color: (r.color as string) ?? "#e74c3c",
    connectionType: (r.connection_type as "rope" | "arrow") ?? "rope",
    sourceAnchor: (r.source_anchor as Connection["sourceAnchor"]) ?? undefined,
    targetAnchor: (r.target_anchor as Connection["targetAnchor"]) ?? undefined,
  };
}

export function useConnectionSync(user: User | null, syncReady = true) {
  const { connections } = useNotesStore();
  const prevConnections = useRef<Connection[]>([]);
  const loadedFor = useRef<string | null | undefined>(undefined);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const supabase = createClient();

  // Load connections when user logs in
  useEffect(() => {
    if (!syncReady) return;
    const uid = user?.id ?? null;
    if (loadedFor.current === uid) return;
    loadedFor.current = uid;

    if (!uid) {
      prevConnections.current = [];
      return;
    }

    supabase
      .from("connections")
      .select("*")
      .eq("user_id", uid)
      .then(({ data, error }) => {
        if (error) { console.error("[useConnectionSync] load:", error.message); return; }
        if (data && data.length > 0) {
          const loaded = data.map(fromRow);
          useNotesStore.setState({ connections: loaded });
          prevConnections.current = loaded;
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, syncReady]);

  // Sync on change
  useEffect(() => {
    if (!syncReady || !user) return;

    const prevById = new Map(prevConnections.current.map((c) => [c.id, c]));
    const currIds = new Set(connections.map((c) => c.id));

    // Detect deletions
    const deleted = prevConnections.current.filter((c) => !currIds.has(c.id));
    if (deleted.length > 0) {
      supabase
        .from("connections")
        .delete()
        .in("id", deleted.map((c) => c.id))
        .eq("user_id", user.id)
        .then(({ error }) => { if (error) console.error("[useConnectionSync] delete:", error.message); });
    }

    // Upsert added/changed connections (debounced)
    connections.forEach((conn) => {
      const prev = prevById.get(conn.id);
      const unchanged = prev &&
        prev.sourceId === conn.sourceId &&
        prev.targetId === conn.targetId &&
        prev.color === conn.color &&
        (prev.connectionType ?? "rope") === (conn.connectionType ?? "rope") &&
        (prev.sourceAnchor ?? null) === (conn.sourceAnchor ?? null) &&
        (prev.targetAnchor ?? null) === (conn.targetAnchor ?? null);
      if (unchanged) return;

      const t = timers.current.get(conn.id);
      if (t) clearTimeout(t);
      timers.current.set(conn.id, setTimeout(async () => {
        const { error } = await supabase.from("connections").upsert(toRow(conn, user.id));
        if (error) console.error("[useConnectionSync] upsert:", conn.id, error.message);
        timers.current.delete(conn.id);
      }, DEBOUNCE));
    });

    prevConnections.current = [...connections];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, user?.id, syncReady]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
  }, []);
}
