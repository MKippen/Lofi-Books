import { useState, useEffect } from 'react';
import { createTimelineEvent, updateTimelineEvent } from '@/hooks/useTimeline';
import { useChapters } from '@/hooks/useChapters';
import { useCharacters } from '@/hooks/useCharacters';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import TextArea from '@/components/ui/TextArea';
import Button from '@/components/ui/Button';
import type { TimelineEvent, TimelineEventType } from '@/types';
import { TIMELINE_EVENT_COLORS } from '@/types';

interface TimelineEventFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  bookId: string;
  event?: TimelineEvent;
}

const EVENT_TYPES: { type: TimelineEventType; label: string }[] = [
  { type: 'plot', label: 'Plot' },
  { type: 'character', label: 'Character' },
  { type: 'setting', label: 'Setting' },
  { type: 'conflict', label: 'Conflict' },
  { type: 'resolution', label: 'Resolution' },
];

export default function TimelineEventForm({
  isOpen,
  onClose,
  onSaved,
  bookId,
  event,
}: TimelineEventFormProps) {
  const { chapters } = useChapters(bookId);
  const { characters } = useCharacters(bookId);
  const isEditing = !!event;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<TimelineEventType>('plot');
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [characterIds, setCharacterIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens or event changes
  useEffect(() => {
    if (isOpen) {
      if (event) {
        setTitle(event.title);
        setDescription(event.description);
        setEventType(event.eventType);
        setChapterId(event.chapterId);
        setCharacterIds(event.characterIds || []);
      } else {
        setTitle('');
        setDescription('');
        setEventType('plot');
        setChapterId(null);
        setCharacterIds([]);
      }
    }
  }, [isOpen, event]);

  const toggleCharacter = (id: string) => {
    setCharacterIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      if (isEditing && event) {
        await updateTimelineEvent(event.id, {
          title: title.trim(),
          description: description.trim(),
          eventType,
          chapterId,
          characterIds,
          color: TIMELINE_EVENT_COLORS[eventType],
        });
      } else {
        await createTimelineEvent({
          bookId,
          chapterId,
          characterIds,
          title: title.trim(),
          description: description.trim(),
          eventType,
          sortOrder: Date.now(),
          color: TIMELINE_EVENT_COLORS[eventType],
        });
      }
      onSaved();
    } catch (error) {
      console.error('Failed to save timeline event:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Event' : 'Add Event'}
      size="md"
    >
      <div className="space-y-4">
        <Input
          label="Event Title"
          value={title}
          onChange={setTitle}
          placeholder="What happens in your story?"
          required
        />

        <TextArea
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="Describe this event..."
          rows={3}
        />

        {/* Event Type selector */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-sm text-indigo/70">Event Type</label>
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map(({ type, label }) => {
              const isSelected = eventType === type;
              const color = TIMELINE_EVENT_COLORS[type];

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEventType(type)}
                  className={`
                    inline-flex items-center gap-2 px-3 py-1.5
                    rounded-full text-sm font-semibold
                    transition-all duration-200 cursor-pointer
                    ${isSelected ? 'ring-2 ring-offset-1' : 'hover:opacity-80'}
                  `}
                  style={{
                    backgroundColor: isSelected ? `${color}20` : `${color}10`,
                    color: color,
                    outlineColor: isSelected ? color : undefined,
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chapter dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-sm text-indigo/70">Linked Chapter</label>
          <select
            value={chapterId || ''}
            onChange={(e) => setChapterId(e.target.value || null)}
            className="w-full rounded-xl border-2 border-secondary/20 px-4 py-2.5 bg-surface text-indigo text-sm focus:border-primary focus:outline-none transition-colors"
          >
            <option value="">None</option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.title}
              </option>
            ))}
          </select>
        </div>

        {/* Character checkboxes */}
        {characters.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-sm text-indigo/70">Characters</label>
            <div className="flex flex-wrap gap-2">
              {characters.map((char) => {
                const isSelected = characterIds.includes(char.id);
                return (
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => toggleCharacter(char.id)}
                    className={`
                      inline-flex items-center gap-1.5 px-3 py-1.5
                      rounded-full text-sm font-medium
                      transition-all duration-200 cursor-pointer border-2
                      ${isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-secondary/20 bg-surface text-indigo/50 hover:border-secondary/40'
                      }
                    `}
                  >
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-primary' : 'bg-indigo/20'}`} />
                    {char.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
          >
            {submitting
              ? isEditing
                ? 'Saving...'
                : 'Creating...'
              : isEditing
                ? 'Save Changes'
                : 'Add Event'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
