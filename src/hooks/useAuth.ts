"use client";

import { useEffect } from "react";
import { signInWithGoogle, signOut, startSession, useSession } from "@/lib/session";

export function useAuth() {
  const user = useSession((s) => s.user);
  const loading = useSession((s) => s.authLoading);
  useEffect(startSession, []);
  return { user, loading, signInWithGoogle, signOut };
}
