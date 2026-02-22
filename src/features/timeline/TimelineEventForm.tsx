import { useState, useEffect } from 'react';
import { createTimelineEvent, updateTimelineEvent } from '@/hooks/useTimeline';
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
  const isEditing = !!event;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<TimelineEventType>('plot');
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens or event changes
  useEffect(() => {
    if (isOpen) {
      if (event) {
        setTitle(event.title);
        setDescription(event.description);
        setEventType(event.eventType);
      } else {
        setTitle('');
        setDescription('');
        setEventType('plot');
      }
    }
  }, [isOpen, event]);

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      if (isEditing && event) {
        await updateTimelineEvent(event.id, {
          title: title.trim(),
          description: description.trim(),
          eventType,
          color: TIMELINE_EVENT_COLORS[eventType],
        });
      } else {
        await createTimelineEvent({
          bookId,
          chapterId: null,
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

        {/* Chapter link placeholder */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-sm text-indigo/70">Linked Chapter</label>
          <div className="w-full rounded-xl border-2 border-secondary/20 px-4 py-2.5 bg-surface text-indigo/30 text-sm">
            None
          </div>
        </div>

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
