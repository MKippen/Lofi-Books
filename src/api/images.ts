import { apiUrl, getAuthHeaders } from './client';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '') + '/api';

/** Get the URL for an image by its ID. */
export function imageUrl(imageId: string | null | undefined): string | null {
  if (!imageId) return null;
  return `${BASE}/images/${imageId}`;
}

/** Upload an image file, returns the image ID. */
export async function uploadImage(bookId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const headers = await getAuthHeaders();

  const response = await fetch(`${BASE}/images/upload/${bookId}`, {
    method: 'POST',
    body: formData,
    headers,
    // Don't set Content-Type — browser sets it with boundary for multipart
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed ${response.status}: ${text}`);
  }

  const { id } = await response.json();
  return id;
}

/** Delete an image by ID. */
export async function deleteImageApi(id: string): Promise<void> {
  const url = apiUrl(`/images/${id}`);
  const headers = await getAuthHeaders();
  const response = await fetch(url, { method: 'DELETE', headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Delete failed ${response.status}: ${text}`);
  }
}
