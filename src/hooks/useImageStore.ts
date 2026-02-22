import { useState, useEffect } from 'react';
import { db, subscribe, notifyChange } from '@/db/database';

const MAX_IMAGE_WIDTH = 800;

// ---------------------------------------------------------------------------
// Query Hook
// ---------------------------------------------------------------------------

/**
 * Returns an object URL for a stored image blob.
 * The URL is revoked automatically when the component unmounts or the
 * imageId changes.
 */
export function useImage(imageId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let currentUrl: string | null = null;

    const load = async () => {
      if (!imageId) {
        setUrl(null);
        setLoading(false);
        return;
      }
      const stored = await db.storedImages.get(imageId);
      if (stored) {
        currentUrl = URL.createObjectURL(stored.blob);
        setUrl(currentUrl);
      } else {
        setUrl(null);
      }
      setLoading(false);
    };

    load();
    const unsubscribe = subscribe(() => {
      // Revoke old URL before refreshing
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        currentUrl = null;
      }
      load();
    });

    return () => {
      unsubscribe();
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [imageId]);

  return { url, loading };
}

// ---------------------------------------------------------------------------
// Mutation Functions
// ---------------------------------------------------------------------------

/**
 * Compress an image file to a maximum width using an OffscreenCanvas (or
 * regular canvas if OffscreenCanvas is unavailable). Returns a Blob of the
 * compressed image.
 */
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  // If the image is already within bounds, return the original file as-is
  if (bitmap.width <= MAX_IMAGE_WIDTH) {
    bitmap.close();
    return file;
  }

  const scale = MAX_IMAGE_WIDTH / bitmap.width;
  const targetWidth = MAX_IMAGE_WIDTH;
  const targetHeight = Math.round(bitmap.height * scale);

  let blob: Blob;

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context from OffscreenCanvas');
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  } else {
    // Fallback for environments without OffscreenCanvas
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context from canvas');
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))),
        'image/jpeg',
        0.85,
      );
    });
  }

  bitmap.close();
  return blob;
}

/**
 * Compresses an image file (if needed) and stores it in the storedImages
 * table. Returns the generated image id.
 */
export async function storeImage(bookId: string, file: File): Promise<string> {
  const id = crypto.randomUUID();
  const blob = await compressImage(file);
  const now = new Date();

  await db.storedImages.add({
    id,
    bookId,
    blob,
    filename: file.name,
    mimeType: blob.type || file.type,
    size: blob.size,
    createdAt: now,
  });
  notifyChange();
  return id;
}

/**
 * Deletes a stored image by id.
 */
export async function deleteImage(id: string): Promise<void> {
  await db.storedImages.delete(id);
  notifyChange();
}
