import { useNavigate } from 'react-router';
import { BookOpen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Book } from '@/types';
import { useImage } from '@/hooks/useImageStore';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface ProjectCardProps {
  book: Book;
}

export default function ProjectCard({ book }: ProjectCardProps) {
  const navigate = useNavigate();
  const { url: coverUrl } = useImage(book.coverImageId);

  return (
    <Card
      hover
      onClick={() => navigate(`/book/${book.id}`)}
      className="overflow-hidden"
    >
      {/* Cover image or gradient placeholder */}
      <div className="h-40 rounded-t-xl overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <BookOpen size={48} className="text-white/60" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 space-y-2">
        <h3 className="font-heading text-lg text-indigo truncate">{book.title}</h3>

        {book.genre && (
          <Badge variant="secondary" size="sm">
            {book.genre}
          </Badge>
        )}

        {book.description && (
          <p className="text-sm text-indigo/60 line-clamp-2">{book.description}</p>
        )}

        <p className="text-xs text-indigo/40">
          Last edited {formatDistanceToNow(book.updatedAt, { addSuffix: true })}
        </p>
      </div>
    </Card>
  );
}
