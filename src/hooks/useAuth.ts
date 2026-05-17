"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  // Start false so server HTML and client initial render both agree (no disabled attr).
  // Set to true only inside useEffect (client-only) before the async auth check.
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setLoading(true);
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch((error) => {
        console.warn("[useAuth] getUser failed:", error.message);
        setUser(null);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

  const signOut = () => supabase.auth.signOut();

  return { user, loading, signInWithGoogle, signOut };
}
