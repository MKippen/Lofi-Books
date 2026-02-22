import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Plus, BookText, Pencil, Trash2 } from 'lucide-react';
import { useChapters, createChapter, deleteChapter } from '@/hooks/useChapters';
import TopBar from '@/components/layout/TopBar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { ChapterStatus } from '@/types';

const statusBadgeVariant: Record<ChapterStatus, 'secondary' | 'warning' | 'success'> = {
  draft: 'secondary',
  'in-progress': 'warning',
  complete: 'success',
};

const statusLabel: Record<ChapterStatus, string> = {
  draft: 'Draft',
  'in-progress': 'In Progress',
  complete: 'Complete',
};

export default function ChaptersPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { chapters, loading } = useChapters(bookId);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleNewChapter = async () => {
    if (!bookId) return;
    const nextNumber = chapters.length + 1;
    const id = await createChapter({
      bookId,
      title: `Chapter ${nextNumber}`,
      notes: '',
    });
    navigate(`/book/${bookId}/chapters/${id}`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteChapter(deleteTarget);
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Chapters">
        <Button variant="primary" size="sm" onClick={handleNewChapter}>
          <Plus size={18} />
          New Chapter
        </Button>
      </TopBar>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 rounded-2xl border border-primary/10 bg-surface animate-pulse"
                />
              ))}
            </div>
          ) : chapters.length === 0 ? (
            <EmptyState
              icon={BookText}
              title="No Chapters Yet!"
              description="Start writing your first chapter!"
              action={
                <Button variant="primary" size="sm" onClick={handleNewChapter}>
                  <Plus size={18} />
                  New Chapter
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-4">
              {chapters.map((chapter) => (
                <Card
                  key={chapter.id}
                  hover
                  onClick={() => navigate(`/book/${bookId}/chapters/${chapter.id}`)}
                  className="p-4"
                >
                  <div className="flex items-center gap-4">
                    {/* Sort order number */}
                    <div className="min-w-[60px] flex items-center justify-center">
                      <span className="font-heading text-2xl text-primary">
                        {chapter.sortOrder + 1}
                      </span>
                    </div>

                    {/* Chapter info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-lg text-indigo truncate">
                        {chapter.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-indigo/50">
                          {chapter.wordCount.toLocaleString()} words
                        </span>
                        <Badge variant={statusBadgeVariant[chapter.status]}>
                          {statusLabel[chapter.status]}
                        </Badge>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/book/${bookId}/chapters/${chapter.id}`);
                        }}
                      >
                        <Pencil size={16} />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(chapter.id);
                        }}
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Chapter"
        message="Are you sure you want to delete this chapter? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
