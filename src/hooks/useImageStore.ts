import { imageUrl, uploadImage, deleteImageApi } from '@/api/images';
import { notifyChange } from '@/api/notify';

// ---------------------------------------------------------------------------
// Query Hook
// ---------------------------------------------------------------------------

/**
 * Returns a URL for an image by its ID.
 * With server-side storage, this is simply the API URL -- no blob management.
 */
export function useImage(imageId: string | null | undefined) {
  const url = imageUrl(imageId);
  return { url, loading: false };
}

// ---------------------------------------------------------------------------
// Mutation Functions
// ---------------------------------------------------------------------------

/**
 * Uploads an image file to the server. Returns the generated image ID.
 */
export async function storeImage(bookId: string, file: File): Promise<string> {
  const id = await uploadImage(bookId, file);
  notifyChange();
  return id;
}

/**
 * Deletes a stored image by id.
 */
export async function deleteImage(id: string): Promise<void> {
  await deleteImageApi(id);
  notifyChange();
}
