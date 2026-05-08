"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    setLoading(true);
    supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          // Table may not exist yet — fail silently
          console.warn("profiles table not ready:", error.message);
        } else {
          setProfile(data);
        }
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const updateUsername = useCallback(async (username: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, username })
      .select()
      .single();
    if (!error && data) setProfile(data);
    else if (error) console.warn("updateUsername error:", error.message);
  }, [user, supabase]);

  const uploadAvatar = useCallback(async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`; // cache-bust
    await supabase.from("profiles").upsert({ id: user.id, avatar_url: url });
    setProfile((p) => p ? { ...p, avatar_url: url } : p);
    return url;
  }, [user, supabase]);

  return { profile, loading, updateUsername, uploadAvatar };
}
