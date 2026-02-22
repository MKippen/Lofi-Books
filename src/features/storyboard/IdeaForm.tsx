import { useState, useEffect } from 'react';
import { createIdea, updateIdea } from '@/hooks/useIdeas';
import { storeImage, useImage } from '@/hooks/useImageStore';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import TextArea from '@/components/ui/TextArea';
import ImageUploader from '@/components/ui/ImageUploader';
import Button from '@/components/ui/Button';
import { IDEA_COLORS, IDEA_COLOR_TEXT } from '@/types';
import type { Idea, IdeaType, IdeaColor } from '@/types';

interface IdeaFormProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  ideaType: IdeaType;
  idea?: Idea;
}

const GALAXY_COLORS: IdeaColor[] = ['galaxy-purple', 'galaxy-blue', 'galaxy-teal', 'galaxy-pink'];
const SAKURA_COLORS: IdeaColor[] = ['sakura-pink', 'sakura-white', 'sakura-rose', 'sakura-blush'];

const TYPE_LABELS: Record<IdeaType, { create: string; edit: string }> = {
  note: { create: 'New Sticky Note', edit: 'Edit Sticky Note' },
  image: { create: 'New Photo', edit: 'Edit Photo' },
  'chapter-idea': { create: 'New Chapter Idea', edit: 'Edit Chapter Idea' },
  sticker: { create: 'New Sticker', edit: 'Edit Sticker' },
};

const DEFAULT_DIMENSIONS: Record<IdeaType, { width: number; height: number }> = {
  note: { width: 200, height: 180 },
  image: { width: 220, height: 260 },
  'chapter-idea': { width: 240, height: 160 },
  sticker: { width: 80, height: 80 },
};

export default function IdeaForm({ isOpen, onClose, bookId, ideaType, idea }: IdeaFormProps) {
  const isEditing = !!idea;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<IdeaColor>('galaxy-purple');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Load existing image URL when editing a photo idea
  const { url: existingImageUrl } = useImage(idea?.imageId);

  // Reset form when modal opens or idea changes
  useEffect(() => {
    if (isOpen) {
      setSaveError('');
      if (idea) {
        setTitle(idea.title);
        setDescription(idea.description);
        setColor(idea.color);
        setImageFile(null);
        setImagePreviewUrl(null);
      } else {
        setTitle('');
        setDescription('');
        setColor('galaxy-purple');
        setImageFile(null);
        setImagePreviewUrl(null);
      }
    }
  }, [isOpen, idea]);

  const handleImageSelected = (file: File) => {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
  };

  const handleClose = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(null);
    setImageFile(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    setSaveError('');

    try {
      if (isEditing && idea) {
        // Update existing idea
        const updates: Partial<Idea> = {
          title: title.trim(),
          description: description.trim(),
          color,
        };

        // Handle image upload for photo type
        if (ideaType === 'image' && imageFile) {
          const imageId = await storeImage(bookId, imageFile);
          updates.imageId = imageId;
        }

        await updateIdea(idea.id, updates);
      } else {
        // Create new idea with random position within a visible area
        const positionX = Math.floor(Math.random() * 700) + 100;
        const positionY = Math.floor(Math.random() * 500) + 100;
        const dims = DEFAULT_DIMENSIONS[ideaType];

        let imageId: string | null = null;
        if (ideaType === 'image' && imageFile) {
          imageId = await storeImage(bookId, imageFile);
        }

        await createIdea({
          bookId,
          type: ideaType,
          title: title.trim(),
          description: description.trim(),
          imageId,
          color,
          positionX,
          positionY,
          width: dims.width,
          height: dims.height,
          linkedChapterId: null,
        });
      }

      handleClose();
    } catch (error) {
      console.error('Failed to save idea:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle = isEditing
    ? TYPE_LABELS[ideaType].edit
    : TYPE_LABELS[ideaType].create;

  // Determine image preview: new file takes precedence, then existing stored image
  const displayImageUrl = imagePreviewUrl ?? existingImageUrl ?? null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} size="md">
      <div className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="Give your idea a name"
          required
        />

        <TextArea
          label={ideaType === 'chapter-idea' ? 'Notes' : 'Description'}
          value={description}
          onChange={setDescription}
          placeholder={
            ideaType === 'chapter-idea'
              ? 'Jot down your chapter notes...'
              : 'Add some details...'
          }
          rows={3}
        />

        {/* Image uploader for photo type */}
        {ideaType === 'image' && (
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-sm text-indigo/70">Photo</label>
            <ImageUploader
              imageUrl={displayImageUrl}
              onImageSelected={handleImageSelected}
            />
          </div>
        )}

        {/* Color picker for notes and photos */}
        {(ideaType === 'note' || ideaType === 'image') && (
          <div className="flex flex-col gap-2">
            <label className="font-semibold text-sm text-indigo/70">Color</label>

            {/* Galaxy Pack */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-indigo/40">Galaxy Pack</span>
              <div className="flex items-center gap-2">
                {GALAXY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`
                      w-8 h-8 rounded-full border-2 transition-all cursor-pointer
                      ${color === c ? 'border-indigo ring-2 ring-indigo/30 scale-110' : 'border-transparent hover:scale-105'}
                    `}
                    style={{ backgroundColor: IDEA_COLORS[c] }}
                    title={c}
                  >
                    {/* Show a small text preview dot */}
                    <span
                      className="block w-2 h-2 rounded-full mx-auto"
                      style={{ backgroundColor: IDEA_COLOR_TEXT[c] }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Sakura Pack */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-indigo/40">Sakura Pack</span>
              <div className="flex items-center gap-2">
                {SAKURA_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`
                      w-8 h-8 rounded-full border-2 transition-all cursor-pointer
                      ${color === c ? 'border-indigo ring-2 ring-indigo/30 scale-110' : 'border-transparent hover:scale-105'}
                    `}
                    style={{ backgroundColor: IDEA_COLORS[c] }}
                    title={c}
                  >
                    <span
                      className="block w-2 h-2 rounded-full mx-auto"
                      style={{ backgroundColor: IDEA_COLOR_TEXT[c] }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {saveError && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
          >
            {submitting
              ? 'Saving...'
              : isEditing
                ? 'Save Changes'
                : 'Pin to Board'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
