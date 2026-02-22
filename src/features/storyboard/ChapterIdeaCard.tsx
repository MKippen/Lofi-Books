import { X, BookText } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import type { Idea } from '@/types';

interface ChapterIdeaCardProps {
  idea: Idea;
  onDelete: (id: string) => void;
}

export default function ChapterIdeaCard({ idea, onDelete }: ChapterIdeaCardProps) {
  return (
    <div
      className="group relative rounded-lg shadow-md bg-amber-50 border-l-4 border-l-primary"
      style={{
        width: idea.width || 240,
      }}
    >
      {/* Pushpin */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -top-[6px] z-10"
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 35%, #ef4444, #7f1d1d)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}
      />

      {/* Delete button */}
      <button
        className="absolute top-1.5 right-1.5 p-1.5 rounded opacity-0 group-hover:opacity-100 touch-show transition-opacity cursor-pointer hover:bg-black/10 z-10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(idea.id);
        }}
      >
        <X size={14} className="text-gray-500" />
      </button>

      {/* Book icon in bottom-right corner */}
      <BookText
        size={16}
        className="absolute bottom-2 right-2 text-primary/20"
        strokeWidth={1.5}
      />

      {/* Content */}
      <div className="p-3 pt-4">
        <div className="mb-2">
          <Badge variant="primary" size="sm">
            {idea.linkedChapterId ? `Chapter Linked` : 'Chapter Idea'}
          </Badge>
        </div>

        {idea.title && (
          <h3 className="font-heading font-bold text-sm text-indigo leading-tight mb-1">
            {idea.title}
          </h3>
        )}

        {idea.description && (
          <p className="text-xs text-indigo/70 leading-snug overflow-hidden">
            {idea.description}
          </p>
        )}
      </div>
    </div>
  );
}
