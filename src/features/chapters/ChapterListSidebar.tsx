import { useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { Chapter, ChapterStatus } from '@/types';

const statusDotColor: Record<ChapterStatus, string> = {
  draft: 'bg-secondary',
  'in-progress': 'bg-warning',
  complete: 'bg-success',
};

interface ChapterListSidebarProps {
  bookId: string;
  currentChapterId: string;
  chapters: Chapter[];
  onNewChapter: () => void;
}

export default function ChapterListSidebar({
  bookId,
  currentChapterId,
  chapters,
  onNewChapter,
}: ChapterListSidebarProps) {
  const navigate = useNavigate();

  return (
    <div className="w-64 bg-indigo/5 border-r border-primary/10 h-full overflow-y-auto flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <span className="font-heading text-sm text-indigo/50 uppercase tracking-wider">
          Chapters
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chapters.map((chapter) => {
          const isActive = chapter.id === currentChapterId;
          return (
            <button
              key={chapter.id}
              type="button"
              onClick={() => navigate(`/book/${bookId}/chapters/${chapter.id}`)}
              className={`
                w-full text-left py-2 px-4 transition-colors duration-150 cursor-pointer
                ${isActive
                  ? 'bg-primary/10 border-r-2 border-primary'
                  : 'hover:bg-primary/5'
                }
              `}
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm text-indigo font-medium">
                  {chapter.title}
                </span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotColor[chapter.status]}`} />
              </div>
              <span className="text-xs text-indigo/40 mt-0.5 block">
                {chapter.wordCount.toLocaleString()} words
              </span>
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-primary/10">
        <Button variant="ghost" size="sm" onClick={onNewChapter} className="w-full">
          <Plus size={16} />
          New Chapter
        </Button>
      </div>
    </div>
  );
}
