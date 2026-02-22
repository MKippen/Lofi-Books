import { useMemo } from 'react';
import type { Character } from '@/types';
import { useImage } from '@/hooks/useImageStore';

interface BookPageProps {
  content: string;
  chapterTitle: string | null;
  pageNumber: number;
  showCharacterPortraits: boolean;
  characters: Character[];
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
}: BookPageProps) {
  // Find which characters are mentioned in this page's text
  const mentionedCharacters = useMemo(() => {
    if (!showCharacterPortraits || characters.length === 0) return [];
    // Strip HTML tags for plain text matching
    const plainText = content.replace(/<[^>]*>/g, '').toLowerCase();
    return characters.filter((c) => plainText.includes(c.name.toLowerCase()));
  }, [content, characters, showCharacterPortraits]);

  return (
    <div className="bg-surface px-12 py-10 min-h-[70vh] shadow-lg rounded-lg border border-primary/5 relative">
      {/* Chapter title header on first page */}
      {chapterTitle && (
        <div className="mb-8">
          {/* Top decorative line */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="w-2 h-2 rotate-45 bg-primary/60" />
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          </div>

          <h2 className="font-heading text-2xl text-primary text-center">
            {chapterTitle}
          </h2>

          {/* Bottom decorative line */}
          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="w-2 h-2 rotate-45 bg-primary/60" />
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          </div>
        </div>
      )}

      {/* Character portraits row */}
      {mentionedCharacters.length > 0 && (
        <div className="flex items-start gap-3 mb-6 pb-4 border-b border-primary/5">
          {mentionedCharacters.map((character) => (
            <CharacterPortrait key={character.id} character={character} />
          ))}
        </div>
      )}

      {/* Rendered HTML content */}
      <div
        className="font-reader text-indigo leading-relaxed text-lg reader-content"
        dangerouslySetInnerHTML={{ __html: content }}
      />

      {/* Page number at bottom center */}
      <div className="text-center mt-8">
        <span className="text-xs text-indigo/30">{pageNumber + 1}</span>
      </div>
    </div>
  );
}
