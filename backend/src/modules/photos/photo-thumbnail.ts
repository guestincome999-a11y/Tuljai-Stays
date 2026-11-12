import sharp from 'sharp';

let processing = false;

/** Best-effort derivative. Never queue decoded photographs on a small backend instance. */
export async function createPhotoThumbnail(contents: Buffer): Promise<Buffer | null> {
  if (processing) return null;
  processing = true;
  try {
    return await sharp(contents, { limitInputPixels: 40_000_000, sequentialRead: true })
      .rotate()
      .resize({ width: 640, height: 480, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 76, effort: 3 })
      .toBuffer();
  } finally {
    processing = false;
  }
}
