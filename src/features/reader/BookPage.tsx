import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import type { Character } from '@/types';
import type { ChapterContext } from '@/components/layout/WritingToolsContext';
import { useImage } from '@/hooks/useImageStore';
import HanakoGhostPopover from '@/features/hanako/HanakoGhostPopover';

const IMG_BASE = import.meta.env.BASE_URL.replace(/\/$/, '') + '/api';

/** Extract a data-attribute value from a tag string (order-independent). */
function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

/**
 * Replace <illustration-embed> custom elements with styled illustration cards.
 */
function renderIllustrations(html: string): string {
  return html.replace(
    /<illustration-embed[^>]*?>(?:<\/illustration-embed>)?/g,
    (tag) => {
      const imageId = attr(tag, 'data-image-id');
      if (!imageId) return '';
      const rawCaption = attr(tag, 'data-caption') || '';
      const h = parseInt(attr(tag, 'data-height') || '200', 10);
      const fy = parseInt(attr(tag, 'data-focal-y') || '50', 10);
      const decodedCaption = rawCaption
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
      // max-height prevents illustration from exceeding the column height
      return `<div class="illustration-reader-card" style="height:${h}px;max-height:calc(100% - 2rem)">
        <img src="${IMG_BASE}/images/${imageId}" alt="${decodedCaption}" style="object-position:center ${fy}%" />
        ${decodedCaption ? `<div class="illustration-caption">${decodedCaption}</div>` : ''}
      </div>`;
    },
  );
}

/** Build chapter title as inline HTML. */
function buildChapterTitleHTML(title: string): string {
  return `<div class="reader-chapter-header" style="break-inside:avoid;margin-bottom:1.5rem;text-align:center">
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
      <div style="flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(var(--color-primary-rgb,107,114,128),0.3),transparent)"></div>
      <div style="width:8px;height:8px;transform:rotate(45deg);background:rgba(var(--color-primary-rgb,107,114,128),0.6)"></div>
      <div style="flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(var(--color-primary-rgb,107,114,128),0.3),transparent)"></div>
    </div>
    <h2 style="font-family:var(--font-heading);font-size:1.5rem;color:var(--color-primary);margin:0">${title}</h2>
    <div style="display:flex;align-items:center;gap:0.75rem;margin-top:0.75rem">
      <div style="flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(var(--color-primary-rgb,107,114,128),0.3),transparent)"></div>
      <div style="width:8px;height:8px;transform:rotate(45deg);background:rgba(var(--color-primary-rgb,107,114,128),0.6)"></div>
      <div style="flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(var(--color-primary-rgb,107,114,128),0.3),transparent)"></div>
    </div>
  </div>`;
}

/** Small portrait circle for a single character. */
function CharacterPortrait({ character }: { character: Character }) {
  const { url } = useImage(character.mainImageId);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20 bg-primary/5 flex-shrink-0">
        {url ? (
          <img src={url} alt={character.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-primary/40 text-xs font-bold">
            {character.name.charAt(0)}
          </div>
        )}
      </div>
      <span className="text-[10px] text-indigo/40 leading-tight text-center max-w-[3.5rem] truncate">
        {character.name}
      </span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BookPageProps {
  content: string;
  chapterTitle: string | null;
  showCharacterPortraits: boolean;
  characters: Character[];
  chapterContext?: ChapterContext | null;
  fontSize?: number;
  fontCss?: string;
  /** 1 = single page, 2 = two-page spread */
  columnCount?: number;
  /** Gap between columns in px */
  columnGap?: number;
  /** Current spread index (0-based) */
  spreadIndex: number;
  /** Called when the total number of spreads changes after layout */
  onTotalSpreadsChange?: (total: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookPage({
  content,
  chapterTitle,
  showCharacterPortraits,
  characters,
  chapterContext,
  fontSize = 18,
  fontCss,
  columnCount = 2,
  columnGap = 48,
  spreadIndex,
  onTotalSpreadsChange,
}: BookPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  /** Computed single-page/column width in px */
  const [pageW, setPageW] = useState(0);

  // ── Mentioned characters for portraits ──
  const mentionedCharacters = useMemo(() => {
    if (!showCharacterPortraits || characters.length === 0) return [];
    const plainText = content.replace(/<[^>]*>/g, '').toLowerCase();
    return characters.filter((c) => plainText.includes(c.name.toLowerCase()));
  }, [content, characters, showCharacterPortraits]);

  // ── Build full HTML: chapter title + content with illustrations ──
  const fullHTML = useMemo(() => {
    const titleHTML = chapterTitle ? buildChapterTitleHTML(chapterTitle) : '';
    return titleHTML + renderIllustrations(content);
  }, [chapterTitle, content]);

  // ── Compute page width from scroll container dimensions ──
  const updateDimensions = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    // Each column is: (containerWidth - totalGaps) / columnCount
    // For 2 columns: (w - 48) / 2 ≈ each column width
    const pw = columnCount >= 2
      ? Math.floor((w - columnGap) / columnCount)
      : w;
    setPageW(pw);
  }, [columnCount, columnGap]);

  // ── Count total spreads from scrollWidth ──
  const remeasure = useCallback(() => {
    // Double-rAF ensures the browser has finished layout and paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (!el || pageW <= 0) return;

        const viewW = el.clientWidth;
        if (viewW <= 0) return;

        // Total spreads = how many full viewports fit in the scroll width.
        // Use a small tolerance (2px) to avoid rounding errors creating an
        // extra empty spread when scrollWidth ≈ clientWidth.
        const total = Math.max(1, Math.ceil((el.scrollWidth - 2) / viewW));
        onTotalSpreadsChange?.(total);
      });
    });
  }, [pageW, columnGap, columnCount, onTotalSpreadsChange]);

  // ── ResizeObserver: recalculate dimensions on any resize ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      updateDimensions();
    });
    ro.observe(el);
    updateDimensions(); // initial
    return () => ro.disconnect();
  }, [updateDimensions]);

  // ── Remeasure when pageW, content, or font changes ──
  useEffect(() => {
    if (pageW <= 0) return;
    remeasure();
  }, [pageW, fullHTML, fontSize, fontCss, columnCount, remeasure]);

  // ── Image load detection: remeasure after all images settle ──
  useEffect(() => {
    const el = contentRef.current;
    if (!el || pageW <= 0) return;

    const imgs = el.querySelectorAll('img');
    if (imgs.length === 0) return;

    let loaded = 0;
    const total = imgs.length;

    const onSettled = () => {
      loaded++;
      if (loaded >= total) remeasure();
    };

    imgs.forEach((img) => {
      if (img.complete) {
        loaded++;
      } else {
        img.addEventListener('load', onSettled, { once: true });
        img.addEventListener('error', onSettled, { once: true });
      }
    });

    // All images already loaded
    if (loaded >= total) remeasure();

    // Fallback timeout in case load events don't fire
    const fallback = setTimeout(remeasure, 2000);

    return () => {
      clearTimeout(fallback);
      imgs.forEach((img) => {
        img.removeEventListener('load', onSettled);
        img.removeEventListener('error', onSettled);
      });
    };
  }, [fullHTML, pageW, remeasure]);

  // ── Navigate via scrollLeft ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || pageW <= 0) return;

    // Scroll exactly one viewport width per spread — this matches
    // the browser's own column layout which fills clientWidth exactly.
    el.scrollLeft = spreadIndex * el.clientWidth;
  }, [spreadIndex, pageW, columnCount, columnGap]);

  // ── Page numbers ──
  const leftPageNum = spreadIndex * columnCount + 1;
  const rightPageNum = leftPageNum + 1;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full relative overflow-hidden" ref={containerRef}>
      {/* Book surface card */}
      <div className="bg-surface h-full shadow-lg rounded-lg border border-primary/5 flex flex-col overflow-hidden">

        {/* Character portraits — first spread only */}
        {mentionedCharacters.length > 0 && spreadIndex === 0 && (
          <div className="flex items-start gap-3 py-3 px-8 border-b border-primary/5 shrink-0">
            {mentionedCharacters.map((c) => (
              <CharacterPortrait key={c.id} character={c} />
            ))}
          </div>
        )}

        {/* Content area — padding wrapper */}
        <div data-content-area className="flex-1 min-h-0 px-8 py-6">
          {/* Scroll/clip container — NO padding, pure overflow clip */}
          <div
            ref={scrollRef}
            style={{
              width: '100%',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            {/* CSS multi-column content */}
            {pageW > 0 && (
              <div
                ref={contentRef}
                className="reader-content text-indigo leading-relaxed"
                style={{
                  height: '100%',
                  columnWidth: `${pageW}px`,
                  columnGap: `${columnGap}px`,
                  columnFill: 'auto',
                  fontSize: `${fontSize}px`,
                  fontFamily: fontCss,
                }}
                dangerouslySetInnerHTML={{ __html: fullHTML }}
              />
            )}
          </div>
        </div>

        {/* Page numbers */}
        <div className="shrink-0 flex items-center px-8 py-2">
          {columnCount >= 2 ? (
            <>
              <span className="flex-1 text-xs text-indigo/30 text-left">
                {leftPageNum}
              </span>
              <span className="flex-1 text-xs text-indigo/30 text-right">
                {rightPageNum}
              </span>
            </>
          ) : (
            <span className="flex-1 text-xs text-indigo/30 text-center">
              {leftPageNum}
            </span>
          )}
        </div>
      </div>

      {/* Full-height book spine */}
      {columnCount >= 2 && (
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 pointer-events-none z-10"
          style={{ width: '2px' }}
        >
          <div className="absolute inset-0 bg-primary/10" />
          <div
            className="absolute inset-y-0 -left-4 w-8"
            style={{
              background:
                'linear-gradient(to right, transparent, rgba(0,0,0,0.03) 35%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.03) 65%, transparent)',
            }}
          />
        </div>
      )}

      {/* Hanako ghost popover for text selection */}
      <HanakoGhostPopover
        containerRef={containerRef}
        chapterContext={chapterContext ?? null}
      />
    </div>
  );
}
