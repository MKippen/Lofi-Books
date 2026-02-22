import { useNavigate } from 'react-router';
import { BookOpen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Book } from '@/types';
import { useImage } from '@/hooks/useImageStore';
import Badge from '@/components/ui/Badge';

interface ProjectCardProps {
  book: Book;
}

// Deterministic gradient based on book id
const COVER_GRADIENTS = [
  ['#7C9A6E', '#5B7A4E'],   // matcha
  ['#C4836A', '#A0634A'],   // terracotta
  ['#8BAEC4', '#6B8EA4'],   // dusty blue
  ['#D4A76A', '#B4874A'],   // amber
  ['#9B7EB4', '#7B5E94'],   // lavender
  ['#C47B8B', '#A45B6B'],   // rose
  ['#6B8A8A', '#4B6A6A'],   // teal
  ['#B89A6A', '#98794A'],   // bronze
];

function getGradientColors(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  const pair = COVER_GRADIENTS[Math.abs(hash) % COVER_GRADIENTS.length];
  return [pair[0], pair[1]];
}

export default function ProjectCard({ book }: ProjectCardProps) {
  const navigate = useNavigate();
  const { url: coverUrl } = useImage(book.coverImageId);
  const [color1, color2] = getGradientColors(book.id);

  return (
    <div
      onClick={() => navigate(`/book/${book.id}`)}
      className="group cursor-pointer flex flex-col items-center"
    >
      {/* 3D Book */}
      <div className="book-3d">
        <div className="book-3d-inner">
          {/* Front cover */}
          <div className="book-cover">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center p-4"
                style={{ background: `linear-gradient(to bottom, ${color1}, ${color2})` }}
              >
                <BookOpen size={36} className="text-white/50 mb-3" strokeWidth={1.5} />
                <span className="text-white/80 font-heading text-sm text-center leading-tight line-clamp-3">
                  {book.title}
                </span>
              </div>
            )}
            {/* Subtle sheen overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-black/15 pointer-events-none" />
          </div>

          {/* Spine */}
          <div className="book-spine" style={{ background: `linear-gradient(to bottom, ${color2}, ${color1})`, filter: 'brightness(0.65) saturate(1.1)' }} />

          {/* Page edges (right side) */}
          <div className="book-pages" />

          {/* Bottom edge (page thickness) */}
          <div className="book-bottom" />
        </div>
      </div>

      {/* Book info below */}
      <div className="mt-3 text-center w-full max-w-[170px]">
        <h3 className="font-heading text-sm text-indigo truncate">{book.title}</h3>
        {book.genre && (
          <div className="mt-1">
            <Badge variant="secondary" size="sm">{book.genre}</Badge>
          </div>
        )}
        <p className="text-[10px] text-indigo/40 mt-1">
          {formatDistanceToNow(book.updatedAt, { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
