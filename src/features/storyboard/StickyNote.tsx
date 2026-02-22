import { X } from 'lucide-react';
import { IDEA_COLORS, IDEA_COLOR_TEXT } from '@/types';
import type { Idea } from '@/types';

interface StickyNoteProps {
  idea: Idea;
  onDelete: (id: string) => void;
}

/**
 * Derive a small deterministic rotation from the idea id so each note
 * looks slightly askew like a real pinned sticky note.
 */
function getRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  // Map to a range of -3 to 3 degrees
  return ((hash % 7) - 3);
}

export default function StickyNote({ idea, onDelete }: StickyNoteProps) {
  const bgColor = IDEA_COLORS[idea.color] ?? IDEA_COLORS['galaxy-purple'];
  const textColor = IDEA_COLOR_TEXT[idea.color] ?? IDEA_COLOR_TEXT['galaxy-purple'];
  const rotation = getRotation(idea.id);

  return (
    <div
      className="group relative rounded-lg shadow-md"
      style={{
        width: idea.width || 200,
        minHeight: idea.height || 180,
        backgroundColor: bgColor,
        color: textColor,
        transform: `rotate(${rotation}deg)`,
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
        className="absolute top-1.5 right-1.5 p-1.5 rounded opacity-0 group-hover:opacity-100 touch-show transition-opacity cursor-pointer hover:bg-black/10"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(idea.id);
        }}
        style={{ color: textColor }}
      >
        <X size={14} />
      </button>

      {/* Content */}
      <div className="p-3 pt-4">
        {idea.title && (
          <h3 className="font-handwriting font-bold text-base leading-tight mb-1">
            {idea.title}
          </h3>
        )}
        {idea.description && (
          <p className="font-handwriting text-sm leading-snug opacity-90 overflow-hidden">
            {idea.description}
          </p>
        )}
      </div>
    </div>
  );
}
