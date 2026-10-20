// Downscale + re-encode an image before it is stored. WebP is ~30–50% smaller
// than JPEG at the same visual quality; browsers that can't encode WebP from a
// canvas (older Safari) silently fall back to JPEG.

export interface ResizedImage {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  mime: string;
  ext: string;
}

function encode(cvs: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => cvs.toBlob(resolve, type, quality));
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function loadBitmap(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {}
  }
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

export async function resizeImageFile(file: File, maxSide = 1600, quality = 0.82): Promise<ResizedImage> {
  const bmp = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const cvs = document.createElement("canvas");
  cvs.width = Math.max(1, Math.round(bmp.width * scale));
  cvs.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = cvs.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp.source, 0, 0, cvs.width, cvs.height);
  bmp.close();

  let blob = await encode(cvs, "image/webp", quality);
  if (!blob || blob.type !== "image/webp") blob = await encode(cvs, "image/jpeg", quality);
  if (!blob) throw new Error("Could not encode image");
  const mime = blob.type || "image/jpeg";
  return {
    dataUrl: await blobToDataUrl(blob),
    blob,
    width: cvs.width,
    height: cvs.height,
    mime,
    ext: mime === "image/webp" ? "webp" : "jpg",
  };
}
