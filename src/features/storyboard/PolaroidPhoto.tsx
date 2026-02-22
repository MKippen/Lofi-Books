import { X, ImageIcon } from 'lucide-react';
import { useImage } from '@/hooks/useImageStore';
import type { Idea } from '@/types';

interface PolaroidPhotoProps {
  idea: Idea;
  onDelete: (id: string) => void;
}

/**
 * Derive a small deterministic rotation from the idea id so each polaroid
 * looks slightly tilted.
 */
function getRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 37 + id.charCodeAt(i)) | 0;
  }
  // Map to a range of -4 to 4 degrees
  return ((hash % 9) - 4);
}

export default function PolaroidPhoto({ idea, onDelete }: PolaroidPhotoProps) {
  const { url: imageUrl, loading: imageLoading } = useImage(idea.imageId);
  const rotation = getRotation(idea.id);

  return (
    <div
      className="group relative shadow-lg"
      style={{
        width: idea.width || 220,
        backgroundColor: '#FFFFFF',
        border: '1px solid #e5e5e5',
        padding: '8px 8px 32px 8px',
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
        className="absolute top-1.5 right-1.5 p-1.5 rounded opacity-0 group-hover:opacity-100 touch-show transition-opacity cursor-pointer hover:bg-black/10 z-10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(idea.id);
        }}
      >
        <X size={14} className="text-gray-500" />
      </button>

      {/* Image area */}
      <div className="w-full aspect-square overflow-hidden bg-gray-100">
        {imageLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={idea.title || 'Photo'}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-indigo-100 to-purple-100">
            <ImageIcon size={32} className="text-indigo-300" strokeWidth={1.5} />
            <span className="text-xs text-indigo-300">No image</span>
          </div>
        )}
      </div>

      {/* Caption */}
      {idea.title && (
        <p className="font-handwriting text-sm text-center text-gray-700 mt-2 leading-tight px-1">
          {idea.title}
        </p>
      )}
    </div>
  );
}
