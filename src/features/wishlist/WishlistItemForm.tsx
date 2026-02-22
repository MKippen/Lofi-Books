import { useState, useEffect } from 'react';
import { Bug, Sparkles, Lightbulb } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import TextArea from '@/components/ui/TextArea';
import Button from '@/components/ui/Button';
import { createWishlistItem, updateWishlistItem } from '@/hooks/useWishlist';
import type { WishlistItem, WishlistItemType } from '@/types';

interface WishlistItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  item?: WishlistItem;
  createdByName: string;
}

const TYPE_OPTIONS: { value: WishlistItemType; label: string; icon: typeof Bug; hint: string; color: string }[] = [
  {
    value: 'bug',
    label: 'Bug',
    icon: Bug,
    hint: 'Something is broken or not working right',
    color: 'bg-red-100 text-red-700 border-red-300',
  },
  {
    value: 'feature',
    label: 'Feature',
    icon: Sparkles,
    hint: 'A new thing I want the site to do',
    color: 'bg-green-100 text-green-700 border-green-300',
  },
  {
    value: 'idea',
    label: 'Idea',
    icon: Lightbulb,
    hint: 'Just a thought or suggestion for later',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
  },
];

export default function WishlistItemForm({ isOpen, onClose, onSaved, item, createdByName }: WishlistItemFormProps) {
  const isEditing = !!item;
  const [type, setType] = useState<WishlistItemType>('idea');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setType(item.type);
        setTitle(item.title);
        setDescription(item.description);
      } else {
        setType('idea');
        setTitle('');
        setDescription('');
      }
    }
  }, [isOpen, item]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      if (isEditing && item) {
        await updateWishlistItem(item.id, {
          type,
          title: title.trim(),
          description: description.trim(),
        });
      } else {
        await createWishlistItem({
          type,
          title: title.trim(),
          description: description.trim(),
          createdByName,
        });
      }
      onSaved();
    } catch (error) {
      console.error('Failed to save wish list item:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = TYPE_OPTIONS.find((t) => t.value === type);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Wish' : 'Make a Wish'}
      size="md"
    >
      <div className="space-y-5">
        {/* Type selector */}
        <div>
          <label className="font-semibold text-sm text-indigo/70 block mb-2">
            What kind of wish is this?
          </label>
          <div className="flex gap-2">
            {TYPE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = type === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold
                    transition-all duration-200 cursor-pointer
                    ${isSelected ? opt.color : 'border-transparent bg-cream text-indigo/40 hover:bg-cream/80'}
                  `}
                >
                  <Icon size={16} />
                  {opt.label}
                </button>
              );
            })}
          </div>
          {selectedType && (
            <p className="text-xs text-indigo/40 mt-1.5 ml-1">{selectedType.hint}</p>
          )}
        </div>

        {/* Title */}
        <Input
          label="What's your wish?"
          value={title}
          onChange={setTitle}
          placeholder={
            type === 'bug'
              ? 'e.g. The save button doesn\'t work sometimes'
              : type === 'feature'
                ? 'e.g. Add dark mode to the reader'
                : 'e.g. Maybe add stickers to the storyboard'
          }
          required
        />

        {/* Description */}
        <TextArea
          label="Tell me more (optional)"
          value={description}
          onChange={setDescription}
          placeholder="Describe what you found, what you want, or how you think it should work..."
          rows={3}
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
          >
            {submitting ? 'Saving...' : isEditing ? 'Update Wish' : 'Add Wish'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
