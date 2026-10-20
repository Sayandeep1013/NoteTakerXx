"use client";

import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveProfile, useSession } from "@/lib/session";

export function useProfile() {
  const profile = useSession((s) => s.profile);

  const updateUsername = useCallback((username: string) => saveProfile({ username }), []);

  const uploadAvatar = useCallback(async (file: File): Promise<string | null> => {
    const user = useSession.getState().user;
    if (!user) return null;
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`; // cache-bust
    await saveProfile({ avatar_url: url });
    return url;
  }, []);

  return {
    username: profile?.username ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    updateUsername,
    uploadAvatar,
  };
}
