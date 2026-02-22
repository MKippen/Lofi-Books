import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Users } from 'lucide-react';
import { getBook } from '@/api/books';
import { listChapters } from '@/api/chapters';
import { listCharacters } from '@/api/characters';
import type { Book, Chapter, Character } from '@/types';
import { paginateHTML } from '@/utils/textUtils';
import BookPage from './BookPage';
import ReaderControls from './ReaderControls';
import PageFlipAnimation from './PageFlipAnimation';

export default function ReaderPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [showCharacterPortraits, setShowCharacterPortraits] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Fetch book, chapters, and characters on mount
  useEffect(() => {
    if (!bookId) return;

    async function load() {
      try {
        const [fetchedBook, fetchedChapters, fetchedCharacters] = await Promise.all([
          getBook(bookId!),
          listChapters(bookId!),
          listCharacters(bookId!),
        ]);

        setBook(fetchedBook ?? null);
        setChapters(fetchedChapters);
        setCharacters(fetchedCharacters);
      } catch {
        setBook(null);
      }
      setLoading(false);
    }

    load();
  }, [bookId]);

  // Paginate the current chapter content
  const pages = useMemo(() => {
    if (chapters.length === 0) return [''];
    const chapter = chapters[currentChapterIndex];
    if (!chapter) return [''];
    return paginateHTML(chapter.content);
  }, [chapters, currentChapterIndex]);

  // Reset page to 0 when chapter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [currentChapterIndex]);

  const currentChapter = chapters[currentChapterIndex] ?? null;

  // Can we navigate backward?
  const canGoPrev = currentPage > 0 || currentChapterIndex > 0;
  // Can we navigate forward?
  const canGoNext = currentPage < pages.length - 1 || currentChapterIndex < chapters.length - 1;

  const goNext = useCallback(() => {
    setDirection(1);
    if (currentPage < pages.length - 1) {
      setCurrentPage((p) => p + 1);
    } else if (currentChapterIndex < chapters.length - 1) {
      setCurrentChapterIndex((i) => i + 1);
      // currentPage will reset to 0 via the useEffect above
    }
  }, [currentPage, pages.length, currentChapterIndex, chapters.length]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    if (currentPage > 0) {
      setCurrentPage((p) => p - 1);
    } else if (currentChapterIndex > 0) {
      // Go to previous chapter's last page
      const prevChapter = chapters[currentChapterIndex - 1];
      const prevPages = paginateHTML(prevChapter.content);
      setCurrentChapterIndex((i) => i - 1);
      // We need to set page after the chapter changes, but the effect resets to 0.
      // Use a microtask to override after the reset effect runs.
      setTimeout(() => {
        setCurrentPage(prevPages.length - 1);
      }, 0);
    }
  }, [currentPage, currentChapterIndex, chapters]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  const handleChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = Number(e.target.value);
    setDirection(idx > currentChapterIndex ? 1 : -1);
    setCurrentChapterIndex(idx);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <p className="text-indigo/50">Book not found.</p>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-cream gap-4">
        <p className="text-indigo/50 font-body">No chapters to read yet.</p>
        <button
          type="button"
          onClick={() => navigate(`/book/${bookId}`)}
          className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-semibold transition-colors cursor-pointer"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isFirstPageOfChapter = currentPage === 0;

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-surface/90 backdrop-blur-sm border-b border-primary/10">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Left: Back button */}
          <button
            type="button"
            onClick={() => navigate(`/book/${bookId}`)}
            className="inline-flex items-center gap-2 text-indigo/60 hover:text-primary font-semibold transition-colors text-sm cursor-pointer"
          >
            <ArrowLeft size={18} />
            Back
          </button>

          {/* Center: Book title + chapter select */}
          <div className="flex items-center gap-4">
            <h1 className="font-heading text-lg text-indigo hidden sm:block">
              {book.title}
            </h1>
            <select
              value={currentChapterIndex}
              onChange={handleChapterChange}
              className="bg-surface border border-primary/20 rounded-lg px-3 py-1.5 text-sm text-indigo font-body focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              {chapters.map((ch, idx) => (
                <option key={ch.id} value={idx}>
                  {ch.title || `Chapter ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Right: Character toggle + page indicator */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCharacterPortraits((v) => !v)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold
                transition-all duration-200 cursor-pointer
                ${showCharacterPortraits
                  ? 'bg-primary/15 text-primary'
                  : 'bg-indigo/5 text-indigo/40 hover:text-indigo/60 hover:bg-indigo/10'
                }
              `}
              title="Toggle character portraits"
            >
              <Users size={16} />
              <span className="hidden sm:inline">Characters</span>
            </button>
            <span className="text-sm text-indigo/40">
              Page {currentPage + 1}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-4 py-8 pb-24">
        <div className="max-w-2xl mx-auto">
          <PageFlipAnimation
            pageKey={`${currentChapterIndex}-${currentPage}`}
            direction={direction}
          >
            <BookPage
              content={pages[currentPage] || ''}
              chapterTitle={isFirstPageOfChapter ? (currentChapter?.title ?? null) : null}
              pageNumber={currentPage}
              showCharacterPortraits={showCharacterPortraits}
              characters={characters}
            />
          </PageFlipAnimation>
        </div>
      </div>

      {/* Bottom Controls */}
      <ReaderControls
        onPrev={goPrev}
        onNext={goNext}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        currentPage={currentPage}
        totalPages={pages.length}
        chapterTitle={currentChapter?.title ?? ''}
      />
    </div>
  );
}
