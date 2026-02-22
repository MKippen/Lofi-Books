import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Users, Wrench, ZoomIn, ZoomOut, Type } from 'lucide-react';
import { useWritingTools } from '@/components/layout/WritingToolsContext';
import { getBook } from '@/api/books';
import { listChapters } from '@/api/chapters';
import { listCharacters } from '@/api/characters';
import type { Book, Chapter, Character } from '@/types';
import { paginateHTML } from '@/utils/textUtils';
import BookPage from './BookPage';
import ReaderControls from './ReaderControls';
import PageFlipAnimation from './PageFlipAnimation';

const FONT_SIZE_KEY = 'reader-font-size';
const FONT_FAMILY_KEY = 'reader-font-family';

const FONT_FAMILIES = [
  { label: 'Serif', value: 'serif', css: "'Lora', serif" },
  { label: 'Sans', value: 'sans', css: "'Nunito', sans-serif" },
  { label: 'Mono', value: 'mono', css: "'JetBrains Mono', monospace" },
] as const;

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 28;
const FONT_SIZE_STEP = 2;

/** Hook to track whether we have enough width for a two-page spread. */
function useTwoPageMode(breakpoint = 1024): boolean {
  const [twoPage, setTwoPage] = useState(() => window.innerWidth >= breakpoint);
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setTwoPage(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);
  return twoPage;
}

export default function ReaderPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { openWritingTools } = useWritingTools();
  const twoPage = useTwoPageMode();

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [showCharacterPortraits, setShowCharacterPortraits] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [showFontPicker, setShowFontPicker] = useState(false);

  // Reader customization — persisted to localStorage
  const [fontSize, setFontSize] = useState(() => {
    try { return parseInt(localStorage.getItem(FONT_SIZE_KEY) || '18', 10); } catch { return 18; }
  });
  const [fontFamily, setFontFamily] = useState(() => {
    try { return localStorage.getItem(FONT_FAMILY_KEY) || 'serif'; } catch { return 'serif'; }
  });

  const fontConfig = FONT_FAMILIES.find((f) => f.value === fontFamily) ?? FONT_FAMILIES[0];

  useEffect(() => {
    try { localStorage.setItem(FONT_SIZE_KEY, String(fontSize)); } catch { /* ignore */ }
  }, [fontSize]);
  useEffect(() => {
    try { localStorage.setItem(FONT_FAMILY_KEY, fontFamily); } catch { /* ignore */ }
  }, [fontFamily]);

  const zoomIn = useCallback(() => setFontSize((s) => Math.min(s + FONT_SIZE_STEP, MAX_FONT_SIZE)), []);
  const zoomOut = useCallback(() => setFontSize((s) => Math.max(s - FONT_SIZE_STEP, MIN_FONT_SIZE)), []);

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

  // In two-page mode, snap currentPage to even numbers
  useEffect(() => {
    if (twoPage && currentPage % 2 !== 0) {
      setCurrentPage((p) => Math.max(0, p - 1));
    }
  }, [twoPage, currentPage]);

  const currentChapter = chapters[currentChapterIndex] ?? null;
  const step = twoPage ? 2 : 1;

  // Can we navigate backward?
  const canGoPrev = currentPage > 0 || currentChapterIndex > 0;
  // Can we navigate forward?
  const canGoNext = (twoPage ? currentPage + 1 : currentPage) < pages.length - 1 || currentChapterIndex < chapters.length - 1;

  const goNext = useCallback(() => {
    setDirection(1);
    const lastVisible = twoPage ? currentPage + 1 : currentPage;
    if (lastVisible < pages.length - 1) {
      setCurrentPage((p) => Math.min(p + step, pages.length - 1));
    } else if (currentChapterIndex < chapters.length - 1) {
      setCurrentChapterIndex((i) => i + 1);
    }
  }, [currentPage, pages.length, currentChapterIndex, chapters.length, step, twoPage]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    if (currentPage > 0) {
      setCurrentPage((p) => Math.max(0, p - step));
    } else if (currentChapterIndex > 0) {
      const prevChapter = chapters[currentChapterIndex - 1];
      const prevPages = paginateHTML(prevChapter.content);
      setCurrentChapterIndex((i) => i - 1);
      setTimeout(() => {
        // In two-page mode, snap to even page
        const lastPage = prevPages.length - 1;
        setCurrentPage(twoPage ? (lastPage % 2 === 0 ? lastPage : Math.max(0, lastPage - 1)) : lastPage);
      }, 0);
    }
  }, [currentPage, currentChapterIndex, chapters, step, twoPage]);

  // Keyboard navigation + zoom shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, zoomIn, zoomOut]);

  // Close font picker on outside click
  useEffect(() => {
    if (!showFontPicker) return;
    const handleClick = () => setShowFontPicker(false);
    // Delay to avoid closing immediately from the button click
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClick); };
  }, [showFontPicker]);

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
  const leftPageIndex = currentPage;
  const rightPageIndex = currentPage + 1;
  const hasRightPage = rightPageIndex < pages.length;

  // Build chapter context for Hanako ghost popover
  const readerChapterContext = currentChapter ? {
    chapterId: currentChapter.id,
    title: currentChapter.title,
    content: currentChapter.content,
    wordCount: currentChapter.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length,
  } : null;

  // Page display for the top bar
  const displayPage = twoPage
    ? (hasRightPage ? `${leftPageIndex + 1}-${rightPageIndex + 1}` : `${leftPageIndex + 1}`)
    : `${currentPage + 1}`;

  return (
    <div className="h-screen bg-cream flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="shrink-0 z-50 bg-surface/90 backdrop-blur-sm border-b border-primary/10">
        <div className="flex items-center justify-between px-6 py-2">
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

          {/* Right: Controls */}
          <div className="flex items-center gap-1.5">
            {/* Zoom out */}
            <button
              type="button"
              onClick={zoomOut}
              disabled={fontSize <= MIN_FONT_SIZE}
              className="p-1.5 rounded-lg text-indigo/30 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Decrease font size"
            >
              <ZoomOut size={16} />
            </button>

            {/* Font size indicator */}
            <span className="text-xs text-indigo/40 w-6 text-center tabular-nums">{fontSize}</span>

            {/* Zoom in */}
            <button
              type="button"
              onClick={zoomIn}
              disabled={fontSize >= MAX_FONT_SIZE}
              className="p-1.5 rounded-lg text-indigo/30 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Increase font size"
            >
              <ZoomIn size={16} />
            </button>

            {/* Font picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFontPicker((v) => !v)}
                className="p-1.5 rounded-lg text-indigo/30 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                title="Change font"
              >
                <Type size={16} />
              </button>
              {showFontPicker && (
                <div className="absolute right-0 top-full mt-1 bg-surface border border-primary/15 rounded-xl shadow-xl py-1 z-50 min-w-[120px]">
                  {FONT_FAMILIES.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => { setFontFamily(f.value); setShowFontPicker(false); }}
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors cursor-pointer ${
                        fontFamily === f.value
                          ? 'text-primary bg-primary/5 font-semibold'
                          : 'text-indigo/60 hover:bg-primary/5'
                      }`}
                      style={{ fontFamily: f.css }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="w-px h-5 bg-indigo/10 mx-1" />

            {/* Characters toggle */}
            <button
              type="button"
              onClick={() => setShowCharacterPortraits((v) => !v)}
              className={`
                inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-semibold
                transition-all duration-200 cursor-pointer
                ${showCharacterPortraits
                  ? 'bg-primary/15 text-primary'
                  : 'bg-indigo/5 text-indigo/40 hover:text-indigo/60 hover:bg-indigo/10'
                }
              `}
              title="Toggle character portraits"
            >
              <Users size={16} />
            </button>

            {/* Page indicator */}
            <span className="text-xs text-indigo/40 ml-1">
              Pg {displayPage}
            </span>

            {/* Writing Tools */}
            <button
              type="button"
              onClick={() => openWritingTools()}
              className="p-1.5 rounded-lg text-indigo/30 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer group"
              title="Writing Tools"
            >
              <Wrench size={16} className="group-hover:rotate-[-15deg] transition-transform duration-200" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area — fills remaining viewport exactly */}
      <div className="flex-1 min-h-0 px-6 py-4">
        {twoPage ? (
          /* ── Two-page book spread ── */
          <div className="h-full max-w-[95vw] mx-auto">
            <PageFlipAnimation
              pageKey={`${currentChapterIndex}-${currentPage}`}
              direction={direction}
            >
              <div className="flex book-spread h-full">
                {/* Left page */}
                <div className="flex-1 min-w-0 book-page-left h-full">
                  <BookPage
                    content={pages[leftPageIndex] || ''}
                    chapterTitle={isFirstPageOfChapter ? (currentChapter?.title ?? null) : null}
                    pageNumber={leftPageIndex}
                    showCharacterPortraits={showCharacterPortraits}
                    characters={characters}
                    chapterContext={readerChapterContext}
                    fontSize={fontSize}
                    fontCss={fontConfig.css}
                  />
                </div>

                {/* Book spine */}
                <div className="w-px relative shrink-0">
                  <div className="absolute inset-0 w-8 -translate-x-1/2 bg-gradient-to-r from-transparent via-indigo/[0.06] to-transparent pointer-events-none" />
                </div>

                {/* Right page */}
                <div className="flex-1 min-w-0 book-page-right h-full">
                  {hasRightPage ? (
                    <BookPage
                      content={pages[rightPageIndex] || ''}
                      chapterTitle={null}
                      pageNumber={rightPageIndex}
                      showCharacterPortraits={showCharacterPortraits}
                      characters={characters}
                      chapterContext={readerChapterContext}
                      fontSize={fontSize}
                      fontCss={fontConfig.css}
                    />
                  ) : (
                    /* Empty right page — end of chapter */
                    <div className="bg-surface px-12 py-10 h-full shadow-lg rounded-r-lg border border-primary/5 flex items-center justify-center">
                      <div className="text-center text-indigo/20">
                        <p className="text-sm italic font-body">End of chapter</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </PageFlipAnimation>
          </div>
        ) : (
          /* ── Single-page view ── */
          <div className="h-full max-w-2xl mx-auto">
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
                chapterContext={readerChapterContext}
                fontSize={fontSize}
                fontCss={fontConfig.css}
              />
            </PageFlipAnimation>
          </div>
        )}
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
        step={step}
      />
    </div>
  );
}
