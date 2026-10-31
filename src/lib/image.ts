const MAX_SIDE = 1280;
const MAX_INPUT = 15 * 1024 * 1024;

/** Resizes a photo in the browser and returns a compact JPEG data URL. */
export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't a photo. Use a JPG, PNG or WebP image.`);
  if (file.size > MAX_INPUT) throw new Error(`${file.name} is larger than 15 MB. Choose a smaller photo.`);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(`${file.name} couldn't be opened. Try a JPG or PNG.`));
      i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't process this photo.");
    ctx.drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}
