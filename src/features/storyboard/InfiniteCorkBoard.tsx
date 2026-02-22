import { useRef, useCallback, useState, useEffect } from 'react';
import { updateIdea, bringToFront, deleteIdea } from '@/hooks/useIdeas';
import StickyNote from './StickyNote';
import PolaroidPhoto from './PolaroidPhoto';
import ChapterIdeaCard from './ChapterIdeaCard';
import type { Idea } from '@/types';
import { IDEA_COLORS } from '@/types';

// Fixed canvas dimensions
const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 2000;
const EDGE_PADDING = 16;
const CARD_WIDTH = 220;
const CARD_HEIGHT = 180;

// Mini-map dimensions
const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = (MINIMAP_WIDTH / CANVAS_WIDTH) * CANVAS_HEIGHT; // keeps aspect ratio

interface InfiniteCorkBoardProps {
  ideas: Idea[];
  bookId: string;
  onEditIdea: (idea: Idea) => void;
}

interface DragState {
  ideaId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  hasMoved: boolean;
}

export default function InfiniteCorkBoard({ ideas, bookId, onEditIdea }: InfiniteCorkBoardProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const minimapDragRef = useRef<boolean>(false);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffsets, setDragOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [viewport, setViewport] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Track scroll position + viewport size for the mini-map
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const update = () => {
      setViewport({
        x: container.scrollLeft,
        y: container.scrollTop,
        w: container.clientWidth,
        h: container.clientHeight,
      });
    };

    update();
    container.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(container);

    return () => {
      container.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);

  const clampX = useCallback(
    (x: number) => Math.max(EDGE_PADDING, Math.min(CANVAS_WIDTH - CARD_WIDTH - EDGE_PADDING, x)),
    [],
  );

  const clampY = useCallback(
    (y: number) => Math.max(EDGE_PADDING, Math.min(CANVAS_HEIGHT - CARD_HEIGHT - EDGE_PADDING, y)),
    [],
  );

  // -----------------------------------------------------------------------
  // Idea dragging
  // -----------------------------------------------------------------------

  const handleIdeaPointerDown = useCallback((e: React.PointerEvent, idea: Idea) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    dragRef.current = {
      ideaId: idea.id,
      startX: e.clientX,
      startY: e.clientY,
      originX: idea.positionX,
      originY: idea.positionY,
      hasMoved: false,
    };
    setDraggingId(idea.id);
  }, []);

  const handleIdeaPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (!drag.hasMoved && Math.abs(dx) + Math.abs(dy) > 3) {
      drag.hasMoved = true;
    }

    if (drag.hasMoved) {
      const newX = clampX(drag.originX + dx);
      const newY = clampY(drag.originY + dy);

      setDragOffsets((prev) => ({
        ...prev,
        [drag.ideaId]: { x: newX - drag.originX, y: newY - drag.originY },
      }));
    }
  }, [clampX, clampY]);

  const handleIdeaPointerUp = useCallback(async (e: React.PointerEvent, idea: Idea) => {
    const drag = dragRef.current;
    if (!drag) return;

    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture(e.pointerId);

    if (drag.hasMoved) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const newX = clampX(drag.originX + dx);
      const newY = clampY(drag.originY + dy);

      setDragOffsets((prev) => {
        const next = { ...prev };
        delete next[drag.ideaId];
        return next;
      });

      await updateIdea(idea.id, { positionX: newX, positionY: newY });
    } else {
      await bringToFront(idea.id, bookId);
    }

    dragRef.current = null;
    setDraggingId(null);
  }, [bookId, clampX, clampY]);

  const handleIdeaDoubleClick = useCallback((e: React.MouseEvent, idea: Idea) => {
    e.stopPropagation();
    onEditIdea(idea);
  }, [onEditIdea]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteIdea(id);
  }, []);

  // -----------------------------------------------------------------------
  // Canvas panning (drag empty space to scroll)
  // -----------------------------------------------------------------------

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (e.target !== e.currentTarget) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
  }, []);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    const pan = panRef.current;
    if (!pan) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollLeft = pan.scrollLeft - (e.clientX - pan.startX);
    container.scrollTop = pan.scrollTop - (e.clientY - pan.startY);
  }, []);

  const handleCanvasPointerUp = useCallback((e: React.PointerEvent) => {
    if (!panRef.current) return;
    panRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).style.cursor = '';
  }, []);

  // -----------------------------------------------------------------------
  // Mini-map interaction: click or drag to scroll the main view
  // -----------------------------------------------------------------------

  const scrollToMinimapPos = useCallback((clientX: number, clientY: number, minimapEl: HTMLElement) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const rect = minimapEl.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    // Convert mini-map coords to canvas coords, centering the viewport
    const canvasX = (mx / MINIMAP_WIDTH) * CANVAS_WIDTH - container.clientWidth / 2;
    const canvasY = (my / MINIMAP_HEIGHT) * CANVAS_HEIGHT - container.clientHeight / 2;

    container.scrollLeft = Math.max(0, Math.min(CANVAS_WIDTH - container.clientWidth, canvasX));
    container.scrollTop = Math.max(0, Math.min(CANVAS_HEIGHT - container.clientHeight, canvasY));
  }, []);

  const handleMinimapPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    minimapDragRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scrollToMinimapPos(e.clientX, e.clientY, e.currentTarget);
  }, [scrollToMinimapPos]);

  const handleMinimapPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!minimapDragRef.current) return;
    scrollToMinimapPos(e.clientX, e.clientY, e.currentTarget);
  }, [scrollToMinimapPos]);

  const handleMinimapPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    minimapDragRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const renderIdea = (idea: Idea) => {
    switch (idea.type) {
      case 'note':
        return <StickyNote idea={idea} onDelete={handleDelete} />;
      case 'image':
        return <PolaroidPhoto idea={idea} onDelete={handleDelete} />;
      case 'chapter-idea':
        return <ChapterIdeaCard idea={idea} onDelete={handleDelete} />;
      default:
        return null;
    }
  };

  // Mini-map viewport rectangle (scaled down)
  const vpScaleX = MINIMAP_WIDTH / CANVAS_WIDTH;
  const vpScaleY = MINIMAP_HEIGHT / CANVAS_HEIGHT;

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Scrollable area */}
      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-auto"
      >
        {/* Canvas */}
        <div
          className="relative cork-texture"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, cursor: 'grab' }}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
        >
          {/* Grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #6366f1 1px, transparent 1px), linear-gradient(to bottom, #6366f1 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Idea cards */}
          {ideas.map((idea) => {
            const offset = dragOffsets[idea.id];
            const posX = clampX(idea.positionX + (offset?.x ?? 0));
            const posY = clampY(idea.positionY + (offset?.y ?? 0));
            const isDragging = draggingId === idea.id;

            return (
              <div
                key={idea.id}
                className="absolute select-none"
                style={{
                  left: posX,
                  top: posY,
                  zIndex: isDragging ? 9999 : idea.zIndex,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  transition: isDragging ? 'none' : 'box-shadow 0.2s',
                  filter: isDragging ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.25))' : undefined,
                }}
                onPointerDown={(e) => handleIdeaPointerDown(e, idea)}
                onPointerMove={handleIdeaPointerMove}
                onPointerUp={(e) => handleIdeaPointerUp(e, idea)}
                onDoubleClick={(e) => handleIdeaDoubleClick(e, idea)}
              >
                {renderIdea(idea)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mini-map */}
      <div
        className="absolute bottom-3 right-3 rounded-lg shadow-lg border-2 border-primary/20 overflow-hidden z-[10000] cursor-crosshair"
        style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
        onPointerDown={handleMinimapPointerDown}
        onPointerMove={handleMinimapPointerMove}
        onPointerUp={handleMinimapPointerUp}
      >
        {/* Mini-map background */}
        <div className="absolute inset-0 cork-texture opacity-80" />

        {/* Idea dots */}
        {ideas.map((idea) => {
          const offset = dragOffsets[idea.id];
          const px = clampX(idea.positionX + (offset?.x ?? 0));
          const py = clampY(idea.positionY + (offset?.y ?? 0));

          return (
            <div
              key={idea.id}
              className="absolute rounded-sm pointer-events-none"
              style={{
                left: px * vpScaleX,
                top: py * vpScaleY,
                width: Math.max(6, CARD_WIDTH * vpScaleX),
                height: Math.max(4, CARD_HEIGHT * vpScaleY),
                backgroundColor: IDEA_COLORS[idea.color] || '#C4836A',
                opacity: 0.8,
              }}
            />
          );
        })}

        {/* Viewport rectangle */}
        <div
          className="absolute border-2 border-primary rounded-sm pointer-events-none"
          style={{
            left: viewport.x * vpScaleX,
            top: viewport.y * vpScaleY,
            width: viewport.w * vpScaleX,
            height: viewport.h * vpScaleY,
            backgroundColor: 'rgba(124, 154, 110, 0.12)',
          }}
        />

        {/* Label */}
        <div className="absolute bottom-0.5 left-1 text-[8px] text-indigo/40 font-semibold pointer-events-none">
          BOARD
        </div>
      </div>

      {/* Hint for panning */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-xs text-indigo/30 bg-surface/70 backdrop-blur px-3 py-1 rounded-full z-[10000] pointer-events-none">
        Drag to move cards &middot; Tap cards to edit
      </div>
    </div>
  );
}
