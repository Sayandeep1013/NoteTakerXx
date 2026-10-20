/**
 * Generates the paper-grain tile once and exposes it as the --paper-noise CSS
 * variable. ~10 KB, decoded once, then reused by every note.
 */
export function installPaperNoise(size = 96) {
  if (typeof document === "undefined" || document.documentElement.style.getPropertyValue("--paper-noise")) return;
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 0;
    img.data[i + 3] = Math.random() * 255;
  }
  ctx.putImageData(img, 0, 0);
  cvs.toBlob((blob) => {
    if (blob) document.documentElement.style.setProperty("--paper-noise", `url(${URL.createObjectURL(blob)})`);
  });
}
