import { useState } from 'react';
import { createBook } from '@/hooks/useProjects';
import { storeImage } from '@/hooks/useImageStore';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import TextArea from '@/components/ui/TextArea';
import ImageUploader from '@/components/ui/ImageUploader';
import Button from '@/components/ui/Button';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleImageSelected = (file: File) => {
    setImageFile(file);
    // Create a local preview URL
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setGenre('');
    setImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      let coverImageId: string | null = null;

      // Create the book first to get an ID for the image storage
      const bookId = await createBook({
        title: title.trim(),
        description: description.trim(),
        genre: genre.trim(),
        coverImageId: null,
      });

      // If there's an image, store it and update the book
      if (imageFile) {
        coverImageId = await storeImage(bookId, imageFile);
        const { updateBook } = await import('@/hooks/useProjects');
        await updateBook(bookId, { coverImageId });
      }

      resetForm();
      onClose();
    } catch (error) {
      console.error('Failed to create book:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Book" size="md">
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
            imageUrl={imagePreviewUrl}
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
            {submitting ? 'Creating...' : 'Create Book'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
