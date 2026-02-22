import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ReaderControlsProps {
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  currentPage: number;
  totalPages: number;
  chapterTitle: string;
}

export default function ReaderControls({
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
  currentPage,
  totalPages,
  chapterTitle,
}: ReaderControlsProps) {
  const progressPercent = totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-sm border-t border-primary/10 z-50">
      <div className="flex items-center justify-between px-8 py-3">
        {/* Previous button */}
        <button
          type="button"
          onClick={onPrev}
          disabled={!canGoPrev}
          className={`
            w-12 h-12 rounded-full bg-primary/10 hover:bg-primary/20
            text-primary flex items-center justify-center
            transition-all duration-200 active:scale-95 cursor-pointer
            ${!canGoPrev ? 'opacity-30 pointer-events-none' : ''}
          `}
          aria-label="Previous page"
        >
          <ChevronLeft size={24} />
        </button>

        {/* Center: progress bar and chapter title */}
        <div className="flex-1 mx-6 max-w-md">
          <div className="h-1.5 rounded-full bg-indigo/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-indigo/40 text-center mt-1 truncate">
            {chapterTitle}
          </p>
        </div>

        {/* Next button */}
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className={`
            w-12 h-12 rounded-full bg-primary/10 hover:bg-primary/20
            text-primary flex items-center justify-center
            transition-all duration-200 active:scale-95 cursor-pointer
            ${!canGoNext ? 'opacity-30 pointer-events-none' : ''}
          `}
          aria-label="Next page"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}
