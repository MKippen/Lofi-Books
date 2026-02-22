import { useState } from 'react';
import { useParams } from 'react-router';
import { Plus, Clock } from 'lucide-react';
import { useTimelineEvents } from '@/hooks/useTimeline';
import TopBar from '@/components/layout/TopBar';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import TimelineTrack from './TimelineTrack';
import TimelineEventForm from './TimelineEventForm';
import { deleteTimelineEvent } from '@/hooks/useTimeline';
import type { TimelineEvent } from '@/types';

export default function TimelinePage() {
  const { bookId } = useParams<{ bookId: string }>();
  const { events, loading, refresh } = useTimelineEvents(bookId!);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleEdit = (event: TimelineEvent) => {
    setEditingEvent(event);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteTimelineEvent(deleteTarget);
    setDeleteTarget(null);
    await refresh();
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingEvent(undefined);
  };

  const handleSaved = async () => {
    handleCloseForm();
    await refresh();
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Timeline">
        <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
          <Plus size={18} />
          Add Event
        </Button>
      </TopBar>

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No Events Yet!"
            description="Start plotting your story's journey!"
            action={
              <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
                <Plus size={18} />
                Add Event
              </Button>
            }
          />
        ) : (
          <TimelineTrack
            events={events}
            bookId={bookId!}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </div>

      {bookId && (
        <TimelineEventForm
          isOpen={formOpen}
          onClose={handleCloseForm}
          onSaved={handleSaved}
          bookId={bookId}
          event={editingEvent}
        />
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Event"
        message="Are you sure you want to delete this timeline event? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
