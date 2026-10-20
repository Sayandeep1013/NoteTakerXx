"use client";

import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/** Raw `profiles` row. Optional columns may be missing on older schemas. */
export interface ProfileRow {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  theme?: string | null;
  dock_side?: string | null;
  custom_badges?: unknown;
}

interface SessionState {
  user: User | null;
  authLoading: boolean;
  profile: ProfileRow | null;
  profileLoaded: boolean;
}

// One auth subscription and one profile fetch for the whole app, instead of
// every component calling getUser() / select() on its own.
export const useSession = create<SessionState>(() => ({
  user: null,
  authLoading: true,
  profile: null,
  profileLoaded: false,
}));

let started = false;

export function startSession() {
  if (started || typeof window === "undefined") return;
  started = true;
  const sb = createClient();
  sb.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    const prevId = useSession.getState().user?.id ?? null;
    useSession.setState({ user, authLoading: false });
    if (!user) {
      useSession.setState({ profile: null, profileLoaded: true });
    } else if (user.id !== prevId) {
      useSession.setState({ profileLoaded: false });
      // Supabase warns against awaiting client calls inside this callback.
      setTimeout(() => { void loadProfile(user.id); }, 0);
    }
  });
}

async function loadProfile(userId: string) {
  const { data, error } = await createClient().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (useSession.getState().user?.id !== userId) return;
  if (error) console.warn("[session] profile load:", error.message);
  useSession.setState({ profile: (data as ProfileRow | null) ?? null, profileLoaded: true });
}

/** Upsert profile columns for the signed-in user. No-op for guests. */
export async function saveProfile(patch: Omit<Partial<ProfileRow>, "id">) {
  const user = useSession.getState().user;
  if (!user) return;
  useSession.setState((s) => ({ profile: { ...(s.profile ?? { id: user.id }), ...patch } }));
  const { error } = await createClient().from("profiles").upsert({ id: user.id, ...patch }, { onConflict: "id" });
  // Older schemas may lack optional columns (dock_side, custom_badges): stay quiet about those.
  const missingColumn = error && Object.keys(patch).some((col) => error.message.toLowerCase().includes(col));
  if (error && !missingColumn) console.warn("[session] profile save:", error.message);
}

export function signInWithGoogle() {
  return createClient().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

export function signOut() {
  return createClient().auth.signOut();
}
