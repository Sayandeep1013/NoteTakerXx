export async function resizeImageFile(
  file: File,
  maxSide = 1600,
  quality = 0.86,
): Promise<{ dataUrl: string; blob: Blob; width: number; height: number }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const cvs = document.createElement("canvas");
  cvs.width = Math.max(1, Math.round(img.width * scale));
  cvs.height = Math.max(1, Math.round(img.height * scale));
  const ctx = cvs.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
  const resizedDataUrl = cvs.toDataURL("image/jpeg", quality);
  const blob = await new Promise<Blob>((resolve, reject) => {
    cvs.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", quality);
  });
  return { dataUrl: resizedDataUrl, blob, width: cvs.width, height: cvs.height };
}
