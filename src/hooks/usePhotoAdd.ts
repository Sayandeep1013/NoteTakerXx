"use client";

import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useNotesStore } from "@/store/notes";
import { resizeImageFile } from "@/lib/resizeImage";

const PHOTOS_BUCKET_DISABLED_KEY = "nxtaker_photos_bucket_disabled";

export function usePhotoAdd(user: { id: string } | null) {
  const addPhoto = useNotesStore((s) => s.addPhoto);

  const handlePhotoUpload = useCallback(async (file: File) => {
    const resized = await resizeImageFile(file);
    let url = resized.dataUrl;
    let path: string | null = null;

    if (user && localStorage.getItem(PHOTOS_BUCKET_DISABLED_KEY) !== "1") {
      const sb = createClient();
      path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage
        .from("photos")
        .upload(path, resized.blob, { upsert: true, contentType: "image/jpeg" });
      if (!error) {
        const { data } = sb.storage.from("photos").getPublicUrl(path);
        url = data.publicUrl;
      } else {
        if (error.message.toLowerCase().includes("bucket not found")) {
          localStorage.setItem(PHOTOS_BUCKET_DISABLED_KEY, "1");
        } else {
          console.warn("[usePhotoAdd] upload:", error.message);
        }
        path = null;
      }
    }

    const caption = file.name.replace(/\.[^.]+$/, "");
    addPhoto(url, path, caption, resized.width, resized.height);
  }, [user, addPhoto]);

  return { handlePhotoUpload };
}
