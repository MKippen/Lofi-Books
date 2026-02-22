import { useState, useEffect } from 'react';
import type { Book } from '@/types';
import { updateBook } from '@/hooks/useProjects';
import { useImage, storeImage } from '@/hooks/useImageStore';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import TextArea from '@/components/ui/TextArea';
import ImageUploader from '@/components/ui/ImageUploader';
import Button from '@/components/ui/Button';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
}

export default function EditProjectModal({ isOpen, onClose, book }: EditProjectModalProps) {
  const [title, setTitle] = useState(book.title);
  const [description, setDescription] = useState(book.description);
  const [genre, setGenre] = useState(book.genre);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { url: existingImageUrl } = useImage(book.coverImageId);

  // Reset form when book changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(book.title);
      setDescription(book.description);
      setGenre(book.genre);
      setImageFile(null);
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
      setLocalPreviewUrl(null);
    }
  }, [isOpen, book]);

  const handleImageSelected = (file: File) => {
    setImageFile(file);
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    const url = URL.createObjectURL(file);
    setLocalPreviewUrl(url);
  };

  const handleClose = () => {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
    setImageFile(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      const updates: Partial<Book> = {
        title: title.trim(),
        description: description.trim(),
        genre: genre.trim(),
      };

      // If a new image was selected, store it
      if (imageFile) {
        const newImageId = await storeImage(book.id, imageFile);
        updates.coverImageId = newImageId;
      }

      await updateBook(book.id, updates);

      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl(null);
      }
      setImageFile(null);
      onClose();
    } catch (error) {
      console.error('Failed to update book:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Show the local preview if a new image was selected, otherwise show existing
  const displayImageUrl = localPreviewUrl || existingImageUrl;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Book" size="md">
      <div className="space-y-4">
        <Input
          label="Book Title"
          value={title}
          onChange={setTitle}
          placeholder="Enter your book title"
          required
        />

        <TextArea
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="What's your story about?"
          rows={3}
        />

        <Input
          label="Genre"
          value={genre}
          onChange={setGenre}
          placeholder="Fantasy, Sci-Fi, Mystery..."
        />

        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-sm text-indigo/70">Cover Image</label>
          <ImageUploader
            imageUrl={displayImageUrl}
            onImageSelected={handleImageSelected}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
