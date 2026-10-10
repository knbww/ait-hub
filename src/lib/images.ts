// Photos are shrunk in the browser before upload: at most 1600 px on the long side, WebP (JPEG
// where the browser can't write WebP). Re-drawing also drops the file's metadata — the place
// and the camera a phone records — which matters for pictures of school students.

const MAX_SIDE = 1600

export interface ShrunkPhoto {
  blob: Blob
  ext: 'webp' | 'jpg'
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Throws `photo_unreadable` for files the browser can't open (HEIC on desktop, broken files). */
export async function shrinkPhoto(file: File): Promise<ShrunkPhoto> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch {
      throw new Error('photo_unreadable')
    }
    // Browsers apply the EXIF rotation when drawing, so portrait shots stay upright.
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('photo_unreadable')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const webp = await toBlob(canvas, 'image/webp', 0.82)
    if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp' }
    const jpeg = await toBlob(canvas, 'image/jpeg', 0.85)
    if (!jpeg) throw new Error('photo_unreadable')
    return { blob: jpeg, ext: 'jpg' }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** A storage file name the database accepts: letters, digits, `-` and `_`. */
export function photoName(ext: string): string {
  const random = crypto.getRandomValues(new Uint32Array(2))
  return `${Date.now().toString(36)}-${random[0].toString(36)}${random[1].toString(36)}.${ext}`
}
