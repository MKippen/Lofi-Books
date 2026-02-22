import { useState, useCallback, useRef } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { imageUrl } from '@/api/images';
import { X, ImageIcon, GripHorizontal, Move } from 'lucide-react';

/**
 * Renders an embedded illustration inside the TipTap editor.
 * - Full-width with object-fit: cover
 * - Draggable bottom edge to resize height
 * - Click+drag on image to reposition the focal point (object-position Y)
 */
export default function IllustrationEmbedView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const { imageId, caption, height, focalY } = node.attrs;
  const url = imageId ? imageUrl(imageId) : null;
  const [resizing, setResizing] = useState(false);
  const [panning, setPanning] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Height resize (bottom drag handle) ──
  const handleResizeDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizing(true);
      startY.current = e.clientY;
      startVal.current = height ?? 200;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY.current;
        const newH = Math.max(80, Math.min(600, startVal.current + delta));
        updateAttributes({ height: Math.round(newH) });
      };
      const onUp = () => {
        setResizing(false);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [height, updateAttributes],
  );

  // ── Focal-point pan (drag image up/down) ──
  const handlePanDown = useCallback(
    (e: React.MouseEvent) => {
      // Only respond to direct image clicks (not buttons overlaid on top)
      if ((e.target as HTMLElement).tagName !== 'IMG') return;
      e.preventDefault();
      e.stopPropagation();
      setPanning(true);
      startY.current = e.clientY;
      startVal.current = focalY ?? 50;

      const containerH = containerRef.current?.clientHeight ?? 200;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY.current;
        // Moving mouse down should move focal point up (reveal lower part)
        // Scale: 1px mouse movement = roughly 0.5% focal shift
        const scale = 100 / containerH;
        const newFocal = Math.max(0, Math.min(100, startVal.current - delta * scale));
        updateAttributes({ focalY: Math.round(newFocal) });
      };
      const onUp = () => {
        setPanning(false);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [focalY, updateAttributes],
  );

  const busy = resizing || panning;

  return (
    <NodeViewWrapper className="illustration-embed-wrapper" contentEditable={false}>
      <div
        ref={containerRef}
        className={`my-3 w-full rounded-xl overflow-hidden relative group border border-primary/10 ${busy ? 'select-none' : ''}`}
        style={{ height: `${height ?? 200}px` }}
        onMouseDown={handlePanDown}
      >
        {url ? (
          <img
            src={url}
            alt={caption || 'Illustration'}
            className={`w-full h-full object-cover ${panning ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ objectPosition: `center ${focalY ?? 50}%` }}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-accent/5">
            <ImageIcon size={36} className="text-accent/30" />
          </div>
        )}

        {/* Pan hint — appears on hover */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/40 text-white/70 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <Move size={10} />
          Drag to reposition
        </div>

        {/* Caption overlay at bottom */}
        {caption && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-4 py-3 pt-8 pointer-events-none">
            <p className="text-sm text-white/90 text-center font-body italic leading-tight drop-shadow-sm">
              {caption}
            </p>
          </div>
        )}

        {/* Delete button — appears on hover */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); deleteNode(); }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-500"
          title="Remove illustration"
        >
          <X size={14} />
        </button>

        {/* Drag handle at bottom to resize height */}
        <div
          onMouseDown={handleResizeDown}
          className="absolute bottom-0 left-0 right-0 h-5 flex items-center justify-center cursor-row-resize opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/20 to-transparent"
          title="Drag to resize height"
        >
          <GripHorizontal size={14} className="text-white/70" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
