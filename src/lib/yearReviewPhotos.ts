// Photos for the memories slides of the year in review.
//
// Put the pictures in `public/memories/<year>/` (for example `public/memories/2026/retreat-1.jpg`)
// and list them here. Say whether each one is a portrait (taller than wide), a landscape (wider than
// tall) or a square. The two memories slides have room for 16 pictures: 6 portraits, 8 landscapes and
// 2 squares. Each picture goes into the next frame of its shape, in the order listed, and is cropped
// to fit. Any frame without a picture shows a placeholder icon. Smaller files (under about 400 KB each)
// keep the slideshow and the PDF / PowerPoint downloads quick.

export interface MemoryPhoto {
  src: string; // e.g. "/memories/2026/retreat-1.jpg"
  orientation: "portrait" | "landscape" | "square";
}

export const MEMORY_PHOTOS: Record<number, MemoryPhoto[]> = {
  // 2026: [
  //   { src: "/memories/2026/retreat-1.jpg", orientation: "landscape" },
  //   { src: "/memories/2026/games-day-1.jpg", orientation: "portrait" },
  // ],
};

/* ------------------------------------------------------------------ */
/* Pictures added on the Year in review card (not saved anywhere)      */
/* ------------------------------------------------------------------ */

// Pictures picked on the planner's Year in review card are kept in memory only: nothing is uploaded
// or stored, so a refresh (or closing the tab) clears them. They are used in place of the list above
// while they are there. Each picture is shrunk when it is added, so a phone photo doesn't weigh down
// the slideshow or the PDF / PowerPoint download.

export interface SessionPhoto extends MemoryPhoto {
  id: string;
  name: string;
}

export const MAX_SESSION_PHOTOS = 24;

let sessionPhotos: SessionPhoto[] = [];

/** The pictures added so far in this browser tab. Survives moving between pages, not a refresh. */
export function getSessionPhotos(): SessionPhoto[] {
  return sessionPhotos;
}

export function setSessionPhotos(next: SessionPhoto[]): void {
  sessionPhotos = next;
}

export function orientationOf(width: number, height: number): MemoryPhoto["orientation"] {
  if (height >= width * 1.15) return "portrait";
  if (width >= height * 1.15) return "landscape";
  return "square";
}

/** Reads a picture file, shrinks it (longest side 1000 px), and works out its shape. */
export async function readPhotoFile(file: File): Promise<SessionPhoto> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Couldn't read ${file.name}`));
      el.src = url;
    });
    const scale = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't prepare the picture");
    ctx.fillStyle = "#ffffff"; // a PNG with see-through parts would otherwise turn black
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      src: canvas.toDataURL("image/jpeg", 0.85),
      orientation: orientationOf(width, height),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
