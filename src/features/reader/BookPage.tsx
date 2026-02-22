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
 * Replace <illustration-embed> custom elements with styled illustration cards
 * for the reader view. These are embedded by the chapter editor.
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
      return `<div class="illustration-reader-card" style="height:${h}px">
        <img src="${IMG_BASE}/images/${imageId}" alt="${decodedCaption}" style="object-position:center ${fy}%" />
        ${decodedCaption ? `<div class="illustration-caption">${decodedCaption}</div>` : ''}
      </div>`;
    },
  );
}

/**
 * Build the chapter title header as an HTML string so it flows inside the
 * CSS column layout (appears at the top of the left/first column).
 */
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
          <img
            src={url}
            alt={character.name}
            className="w-full h-full object-cover"
          />
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

interface BookPageProps {
  /** Full chapter HTML content */
  content: string;
  chapterTitle: string | null;
  showCharacterPortraits: boolean;
  characters: Character[];
  chapterContext?: ChapterContext | null;
  fontSize?: number;
  fontCss?: string;
  /** Number of CSS columns (1 = single page, 2 = two-page spread) */
  columnCount?: number;
  /** Gap between columns in px */
  columnGap?: number;
  /** Current "spread" index (0-based). Each spread shows `columnCount` columns. */
  spreadIndex: number;
  /** Callback: total number of spreads changed after layout */
  onTotalSpreadsChange?: (total: number) => void;
}

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
  const contentRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  /** Measured width of the clip wrapper — one "spread" is exactly this wide. */
  const [clipWidth, setClipWidth] = useState(0);

  // Find mentioned characters for portraits
  const mentionedCharacters = useMemo(() => {
    if (!showCharacterPortraits || characters.length === 0) return [];
    const plainText = content.replace(/<[^>]*>/g, '').toLowerCase();
    return characters.filter((c) => plainText.includes(c.name.toLowerCase()));
  }, [content, characters, showCharacterPortraits]);

  // Build full HTML: chapter title (inline at top) + content
  const fullHTML = useMemo(() => {
    const titleHTML = chapterTitle ? buildChapterTitleHTML(chapterTitle) : '';
    return titleHTML + renderIllustrations(content);
  }, [chapterTitle, content]);

  // Compute the exact column width so that `columnCount` columns + gaps = clipWidth.
  // e.g. 2 columns with 48px gap in 1000px container: colW = (1000 - 48) / 2 = 476px
  const colW = clipWidth > 0
    ? Math.floor((clipWidth - columnGap * (columnCount - 1)) / columnCount)
    : 0;

  // Measure the clip wrapper and recompute spreads whenever layout changes.
  const measure = useCallback(() => {
    const clip = clipRef.current;
    const el = contentRef.current;
    if (!clip || !el) return;

    const w = clip.clientWidth;
    if (w <= 0) return;
    setClipWidth(w);

    // Wait for browser to re-layout with the correct column-width
    requestAnimationFrame(() => {
      // scrollWidth = total width of all columns + gaps
      const scrollW = el.scrollWidth;
      // Each spread = clipWidth (columnCount columns + gaps between them)
      // Between spreads there's also a columnGap, so total =
      //   numSpreads * (columnCount * colW + (columnCount-1) * gap) + (numSpreads-1) * gap
      // But since we set width = large number, the browser just lays out columns sequentially.
      // The simplest: count total columns = scrollW / (colW + gap), then spreads = ceil(totalCols / columnCount)
      const cw = Math.floor((w - columnGap * (columnCount - 1)) / columnCount);
      if (cw <= 0) return;
      const totalCols = Math.max(1, Math.round(scrollW / (cw + columnGap)));
      const spreads = Math.max(1, Math.ceil(totalCols / columnCount));
      onTotalSpreadsChange?.(spreads);
    });
  }, [columnCount, columnGap, onTotalSpreadsChange]);

  // Measure on mount, content/font/layout change
  useEffect(() => {
    measure();
    const t1 = setTimeout(measure, 80);
    const t2 = setTimeout(measure, 250);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [content, fontSize, fontCss, columnCount, columnGap, measure]);

  // Measure on resize
  useEffect(() => {
    const handleResize = () => measure();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [measure]);

  // Compute translateX to show the current spread.
  // Each spread = columnCount columns + (columnCount-1) inner gaps.
  // Between spreads there's one columnGap.
  // So offset for spread N = N * (columnCount * (colW + columnGap))
  // = N * columnCount * (colW + columnGap)
  // Because each column slot is (colW + gap), and the last gap of a spread
  // runs into the next spread's first column, there's no extra gap.
  const spreadWidth = colW > 0 ? columnCount * (colW + columnGap) : 0;
  const translateX = -(spreadIndex * spreadWidth);

  return (
    <div className="h-full relative overflow-hidden">
      {/* The two-page surface with spine */}
      <div className="bg-surface h-full shadow-lg rounded-lg border border-primary/5 flex flex-col overflow-hidden">
        {/* Character portraits row — only on first spread */}
        {mentionedCharacters.length > 0 && spreadIndex === 0 && (
          <div className="flex items-start gap-3 py-3 px-8 border-b border-primary/5 shrink-0">
            {mentionedCharacters.map((character) => (
              <CharacterPortrait key={character.id} character={character} />
            ))}
          </div>
        )}

        {/* CSS-column paginated content — fills the page */}
        <div className="flex-1 min-h-0 px-8 py-6">
          {/* Clip wrapper — overflow:hidden masks the translateX sliding */}
          <div ref={clipRef} className="h-full overflow-hidden">
            <div
              ref={contentRef}
              className="h-full text-indigo leading-relaxed reader-content"
              style={{
                fontSize: `${fontSize}px`,
                fontFamily: fontCss,
                // Use a very large width so the browser creates as many columns as needed,
                // each exactly colW pixels wide. This avoids column-count constraining
                // the layout to the visible width (which causes overflow/clipping issues).
                width: colW > 0 ? '100000px' : undefined,
                columnWidth: colW > 0 ? `${colW}px` : undefined,
                columnGap: `${columnGap}px`,
                columnFill: 'auto',
                transform: `translateX(${translateX}px)`,
                transition: 'transform 0.3s ease-in-out',
              }}
              dangerouslySetInnerHTML={{ __html: fullHTML }}
            />
          </div>
        </div>

        {/* Page numbers at bottom */}
        <div className="shrink-0 flex items-center px-8 py-2">
          {columnCount >= 2 ? (
            <>
              <span className="flex-1 text-xs text-indigo/30 text-left">
                {spreadIndex * 2 + 1}
              </span>
              <span className="flex-1 text-xs text-indigo/30 text-right">
                {spreadIndex * 2 + 2}
              </span>
            </>
          ) : (
            <span className="flex-1 text-xs text-indigo/30 text-center">
              {spreadIndex + 1}
            </span>
          )}
        </div>
      </div>

      {/* Full-height book spine — top to bottom of the entire card */}
      {columnCount >= 2 && (
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ width: '2px' }}
        >
          {/* Thin center line */}
          <div className="absolute inset-0 bg-primary/10" />
          {/* Wider shadow glow */}
          <div
            className="absolute inset-y-0 -left-4 w-8"
            style={{
              background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.03) 35%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.03) 65%, transparent)',
            }}
          />
        </div>
      )}

      {/* Hanako ghost popover for text selection */}
      <HanakoGhostPopover
        containerRef={contentRef}
        chapterContext={chapterContext ?? null}
      />
    </div>
  );
}
