import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Users,
  StickyNote,
  Clock,
  BookText,
  BookOpen,
  Pencil,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useBook, deleteBook } from '@/hooks/useProjects';
import { useCharacters } from '@/hooks/useCharacters';
import { useIdeas } from '@/hooks/useIdeas';
import { useTimelineEvents } from '@/hooks/useTimeline';
import { useChapters } from '@/hooks/useChapters';
import { useImage } from '@/hooks/useImageStore';
import TopBar from '@/components/layout/TopBar';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EditProjectModal from '@/features/projects/EditProjectModal';

interface SectionCardProps {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  stat: string;
  onClick: () => void;
}

function SectionCard({ icon: Icon, iconColor, label, stat, onClick }: SectionCardProps) {
  return (
    <Card hover onClick={onClick} className="p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Icon size={36} className={iconColor} strokeWidth={1.5} />
        <h3 className="font-heading text-lg text-indigo">{label}</h3>
        <p className="text-sm text-indigo/50">{stat}</p>
      </div>
    </Card>
  );
}

export default function BookDashboard() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { book, loading } = useBook(bookId);
  const { characters } = useCharacters(bookId);
  const { ideas } = useIdeas(bookId);
  const { events } = useTimelineEvents(bookId);
  const { chapters } = useChapters(bookId);

  const { url: coverUrl } = useImage(book?.coverImageId);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const totalWordCount = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

  const handleDelete = async () => {
    if (!bookId) return;
    await deleteBook(bookId);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-indigo/50">Book not found.</p>
      </div>
    );
  }

  const sections = [
    {
      icon: Users,
      iconColor: 'text-primary',
      label: 'Characters',
      stat: `${characters.length} character${characters.length !== 1 ? 's' : ''}`,
      path: 'characters',
    },
    {
      icon: StickyNote,
      iconColor: 'text-secondary',
      label: 'Storyboard',
      stat: `${ideas.length} idea${ideas.length !== 1 ? 's' : ''}`,
      path: 'storyboard',
    },
    {
      icon: Clock,
      iconColor: 'text-accent',
      label: 'Timeline',
      stat: `${events.length} event${events.length !== 1 ? 's' : ''}`,
      path: 'timeline',
    },
    {
      icon: BookText,
      iconColor: 'text-success',
      label: 'Chapters',
      stat: `${chapters.length} chapter${chapters.length !== 1 ? 's' : ''} \u00B7 ${totalWordCount.toLocaleString()} words`,
      path: 'chapters',
    },
    {
      icon: BookOpen,
      iconColor: 'text-warning',
      label: 'Read Book',
      stat: 'Read your story',
      path: 'read',
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title={book.title}>
        <Button variant="ghost" size="sm" onClick={() => setShowEditModal(true)}>
          <Pencil size={16} />
          Edit
        </Button>
        <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
          <Trash2 size={16} />
          Delete
        </Button>
      </TopBar>

      <div className="flex-1 p-8">
        {/* Book info with cover */}
        <div className="mb-8 flex items-start gap-6">
          {/* Cover image / placeholder */}
          <div className="shrink-0 w-28 h-40 rounded-md overflow-hidden shadow-md border border-primary/10">
            {coverUrl ? (
              <img src={coverUrl} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <BookOpen size={32} className="text-white/50" strokeWidth={1.5} />
              </div>
            )}
          </div>

          <div className="space-y-2 min-w-0">
            {book.genre && (
              <Badge variant="secondary" size="md">
                {book.genre}
              </Badge>
            )}
            {book.description && (
              <p className="text-indigo/70 text-sm max-w-2xl">{book.description}</p>
            )}
            <p className="text-xs text-indigo/40">
              Created {formatDistanceToNow(book.createdAt, { addSuffix: true })} &middot;
              Updated {formatDistanceToNow(book.updatedAt, { addSuffix: true })}
            </p>
          </div>
        </div>

        {/* Section cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => (
            <SectionCard
              key={section.path}
              icon={section.icon}
              iconColor={section.iconColor}
              label={section.label}
              stat={section.stat}
              onClick={() => navigate(`/book/${bookId}/${section.path}`)}
            />
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      <EditProjectModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        book={book}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Book"
        message={`Are you sure you want to delete "${book.title}"? This will permanently remove all characters, chapters, storyboard ideas, and timeline events. This action cannot be undone.`}
        confirmLabel="Delete Book"
        variant="danger"
      />
    </div>
  );
}
