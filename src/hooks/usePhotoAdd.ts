"use client";

import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useNotesStore } from "@/store/notes";
import { useSession } from "@/lib/session";
import { resizeImageFile } from "@/lib/resizeImage";

export const PHOTOS_BUCKET_DISABLED_KEY = "nxtaker_photos_bucket_disabled";

export function usePhotoAdd() {
  const handlePhotoUpload = useCallback(async (file: File) => {
    const resized = await resizeImageFile(file);
    let url = resized.dataUrl;
    let path: string | null = null;
    const user = useSession.getState().user;

    if (user && localStorage.getItem(PHOTOS_BUCKET_DISABLED_KEY) !== "1") {
      const sb = createClient();
      path = `${user.id}/${crypto.randomUUID()}.${resized.ext}`;
      const { error } = await sb.storage
        .from("photos")
        .upload(path, resized.blob, { upsert: true, contentType: resized.mime, cacheControl: "31536000" });
      if (!error) {
        url = sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
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
    useNotesStore.getState().addPhoto(url, path, caption, resized.width, resized.height);
  }, []);

  return { handlePhotoUpload };
}
