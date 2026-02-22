import { useMemo, useRef } from 'react';
import type { Character } from '@/types';
import type { ChapterContext } from '@/components/layout/WritingToolsContext';
import { useImage } from '@/hooks/useImageStore';
import HanakoGhostPopover from '@/features/hanako/HanakoGhostPopover';

const IMG_BASE = import.meta.env.BASE_URL.replace(/\/$/, '') + '/api';

/**
 * Replace <illustration-embed> custom elements with styled illustration cards
 * for the reader view. These are embedded by the chapter editor.
 */
function renderIllustrations(html: string): string {
  return html.replace(
    /<illustration-embed[^>]*?data-image-id="([^"]*)"[^>]*?data-caption="([^"]*)"[^>]*?>(?:<\/illustration-embed>)?/g,
    (_match, imageId: string, caption: string) => {
      const decodedCaption = caption
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
      return `<div class="illustration-reader-card">
        <img src="${IMG_BASE}/images/${imageId}" alt="${decodedCaption}" />
        ${decodedCaption ? `<p class="illustration-caption">${decodedCaption}</p>` : ''}
      </div>`;
    },
  );
}

interface BookPageProps {
  content: string;
  chapterTitle: string | null;
  pageNumber: number;
  showCharacterPortraits: boolean;
  characters: Character[];
  chapterContext?: ChapterContext | null;
  fontSize?: number;
  fontCss?: string;
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

export default function BookPage({
  content,
  chapterTitle,
  pageNumber,
  showCharacterPortraits,
  characters,
  chapterContext,
  fontSize = 18,
  fontCss,
}: BookPageProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Find which characters are mentioned in this page's text
  const mentionedCharacters = useMemo(() => {
    if (!showCharacterPortraits || characters.length === 0) return [];
    // Strip HTML tags for plain text matching
    const plainText = content.replace(/<[^>]*>/g, '').toLowerCase();
    return characters.filter((c) => plainText.includes(c.name.toLowerCase()));
  }, [content, characters, showCharacterPortraits]);

  return (
    <div className="bg-surface px-8 py-6 h-full shadow-lg rounded-lg border border-primary/5 relative flex flex-col overflow-hidden">
      {/* Chapter title header on first page */}
      {chapterTitle && (
        <div className="mb-4 shrink-0">
          {/* Top decorative line */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="w-2 h-2 rotate-45 bg-primary/60" />
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          </div>

          <h2 className="font-heading text-2xl text-primary text-center">
            {chapterTitle}
          </h2>

          {/* Bottom decorative line */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="w-2 h-2 rotate-45 bg-primary/60" />
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          </div>
        </div>
      )}

      {/* Character portraits row */}
      {mentionedCharacters.length > 0 && (
        <div className="flex items-start gap-3 mb-4 pb-3 border-b border-primary/5 shrink-0">
          {mentionedCharacters.map((character) => (
            <CharacterPortrait key={character.id} character={character} />
          ))}
        </div>
      )}

      {/* Rendered HTML content (with illustration embeds resolved) */}
      <div
        ref={contentRef}
        className="flex-1 min-h-0 overflow-hidden text-indigo leading-relaxed reader-content"
        style={{ fontSize: `${fontSize}px`, fontFamily: fontCss }}
        dangerouslySetInnerHTML={{ __html: renderIllustrations(content) }}
      />

      {/* Page number at bottom center */}
      <div className="text-center mt-2 shrink-0">
        <span className="text-xs text-indigo/30">{pageNumber + 1}</span>
      </div>

      {/* Hanako ghost popover for text selection */}
      <HanakoGhostPopover
        containerRef={contentRef}
        chapterContext={chapterContext ?? null}
      />
    </div>
  );
}
