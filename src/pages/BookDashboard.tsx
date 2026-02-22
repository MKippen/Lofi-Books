import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Users,
  StickyNote,
  Clock,
  BookText,
  BookOpen,
  Pencil,
  Trash2,
  MoreHorizontal,
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
    <Card hover onClick={onClick} className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/5 shrink-0">
          <Icon size={20} className={iconColor} strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <h3 className="font-heading text-sm text-indigo leading-tight">{label}</h3>
          <p className="text-xs text-indigo/40 truncate">{stat}</p>
        </div>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

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

        {/* More menu (contains Delete) */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-indigo/30 hover:text-indigo hover:bg-primary/10 transition-colors cursor-pointer"
            title="More options"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-surface border border-primary/15 rounded-xl shadow-xl py-1 z-50 min-w-[140px]">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setShowDeleteConfirm(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                Delete Book
              </button>
            </div>
          )}
        </div>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
