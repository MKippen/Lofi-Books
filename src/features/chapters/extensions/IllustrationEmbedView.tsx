import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { imageUrl } from '@/api/images';
import { X, ImageIcon } from 'lucide-react';

/**
 * Renders an embedded illustration inside the TipTap editor.
 * Shows a thumbnail with caption and a delete button.
 */
export default function IllustrationEmbedView({ node, deleteNode }: NodeViewProps) {
  const { imageId, caption } = node.attrs;
  const url = imageId ? imageUrl(imageId) : null;

  return (
    <NodeViewWrapper className="illustration-embed-wrapper" contentEditable={false}>
      <div className="my-4 mx-auto max-w-[240px] rounded-xl border-2 border-accent/20 bg-surface shadow-sm overflow-hidden relative group">
        {url ? (
          <img
            src={url}
            alt={caption || 'Illustration'}
            className="w-full h-auto max-h-[200px] object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-24 flex items-center justify-center bg-accent/5">
            <ImageIcon size={28} className="text-accent/30" />
          </div>
        )}

        {caption && (
          <p className="px-2 py-1.5 text-[11px] text-indigo/60 text-center font-body italic leading-tight">
            {caption}
          </p>
        )}

        {/* Delete button — appears on hover */}
        <button
          type="button"
          onClick={deleteNode}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-indigo/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-500"
          title="Remove illustration"
        >
          <X size={12} />
        </button>
      </div>
    </NodeViewWrapper>
  );
}
