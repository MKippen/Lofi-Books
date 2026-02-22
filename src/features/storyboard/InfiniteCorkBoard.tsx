import { useRef, useCallback, useState, useEffect } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { updateIdea, bringToFront, deleteIdea } from '@/hooks/useIdeas';
import StickyNote from './StickyNote';
import PolaroidPhoto from './PolaroidPhoto';
import ChapterIdeaCard from './ChapterIdeaCard';
import StickerIcon from './StickerIcon';
import type { Idea, Connection, StringColor } from '@/types';
import { IDEA_COLORS, STRING_COLORS } from '@/types';

// Fixed canvas dimensions
const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 2000;
const EDGE_PADDING = 16;
const CARD_WIDTH = 220;
const CARD_HEIGHT = 180;

// Mini-map dimensions
const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = (MINIMAP_WIDTH / CANVAS_WIDTH) * CANVAS_HEIGHT; // keeps aspect ratio

// Zoom limits
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.15;

interface InfiniteCorkBoardProps {
  ideas: Idea[];
  bookId: string;
  onEditIdea: (idea: Idea) => void;
  connections?: Connection[];
  connectMode?: boolean;
  connectFrom?: string | null;
  onConnectClick?: (ideaId: string) => void;
  onDeleteConnection?: (connectionId: string) => void;
  onChangeConnectionColor?: (connectionId: string, color: StringColor) => void;
}

interface DragState {
  ideaId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  hasMoved: boolean;
}

export default function InfiniteCorkBoard({
  ideas, bookId, onEditIdea,
  connections = [], connectMode = false, connectFrom = null,
  onConnectClick, onDeleteConnection, onChangeConnectionColor,
}: InfiniteCorkBoardProps) {
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
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1); // keep sync ref for use in callbacks
  const minZoomRef = useRef(0.3); // dynamic — recalculated from container height

  // Track scroll position + viewport size for the mini-map (accounting for zoom)
  // Also compute the dynamic minimum zoom so the canvas always fills the viewport height
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const update = () => {
      const z = zoomRef.current;
      setViewport({
        x: container.scrollLeft / z,
        y: container.scrollTop / z,
        w: container.clientWidth / z,
        h: container.clientHeight / z,
      });
      // Min zoom = the zoom level at which CANVAS_HEIGHT exactly fills the container height
      minZoomRef.current = Math.max(0.1, container.clientHeight / CANVAS_HEIGHT);
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

  // Zoom helpers
  const applyZoom = useCallback((newZoom: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const clamped = Math.max(minZoomRef.current, Math.min(MAX_ZOOM, newZoom));
    const oldZoom = zoomRef.current;

    // Center-of-viewport in canvas coords before zoom change
    const centerX = (container.scrollLeft + container.clientWidth / 2) / oldZoom;
    const centerY = (container.scrollTop + container.clientHeight / 2) / oldZoom;

    zoomRef.current = clamped;
    setZoom(clamped);

    // After React re-renders, adjust scroll so the same canvas point stays centered
    requestAnimationFrame(() => {
      container.scrollLeft = centerX * clamped - container.clientWidth / 2;
      container.scrollTop = centerY * clamped - container.clientHeight / 2;
    });
  }, []);

  const zoomIn = useCallback(() => applyZoom(zoomRef.current + ZOOM_STEP), [applyZoom]);
  const zoomOut = useCallback(() => applyZoom(zoomRef.current - ZOOM_STEP), [applyZoom]);
  const zoomReset = useCallback(() => applyZoom(1), [applyZoom]);

  // Wheel zoom — all scroll events on the canvas trigger zoom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Trackpads send small pixel deltas; mice send larger line-mode deltas
      const sensitivity = (e.ctrlKey || e.metaKey) ? 0.01 : 0.005;
      const delta = -e.deltaY * sensitivity;
      applyZoom(zoomRef.current + delta);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [applyZoom]);

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

    const z = zoomRef.current;
    const dx = (e.clientX - drag.startX) / z;
    const dy = (e.clientY - drag.startY) / z;

    if (!drag.hasMoved && Math.abs(dx) + Math.abs(dy) > 3 / z) {
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

    dragRef.current = null;
    setDraggingId(null);

    if (drag.hasMoved) {
      const z = zoomRef.current;
      const dx = (e.clientX - drag.startX) / z;
      const dy = (e.clientY - drag.startY) / z;
      const newX = clampX(drag.originX + dx);
      const newY = clampY(drag.originY + dy);

      // Keep the drag offset alive until the API save completes and the ideas
      // list refreshes — this prevents the card from jumping back to the old
      // position during the async round-trip.
      try {
        await updateIdea(idea.id, { positionX: newX, positionY: newY });
      } catch (err) {
        console.error('Failed to save idea position:', err);
      }

      // Now that the ideas array should reflect the new position, clear the offset
      setDragOffsets((prev) => {
        const next = { ...prev };
        delete next[drag.ideaId];
        return next;
      });
    } else if (connectMode && onConnectClick) {
      onConnectClick(idea.id);
    } else {
      try {
        await bringToFront(idea.id, bookId);
      } catch (err) {
        console.error('Failed to bring idea to front:', err);
      }
    }
  }, [bookId, clampX, clampY, connectMode, onConnectClick]);

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

    // Dismiss any selected connection
    setSelectedConnectionId(null);

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

    // Pan speed should match mouse movement regardless of zoom level
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

    const z = zoomRef.current;
    const rect = minimapEl.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    // Convert mini-map coords to canvas coords, then scale by zoom
    const canvasX = (mx / MINIMAP_WIDTH) * CANVAS_WIDTH * z - container.clientWidth / 2;
    const canvasY = (my / MINIMAP_HEIGHT) * CANVAS_HEIGHT * z - container.clientHeight / 2;

    const maxScrollX = CANVAS_WIDTH * z - container.clientWidth;
    const maxScrollY = CANVAS_HEIGHT * z - container.clientHeight;

    container.scrollLeft = Math.max(0, Math.min(maxScrollX, canvasX));
    container.scrollTop = Math.max(0, Math.min(maxScrollY, canvasY));
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
      case 'sticker':
        return <StickerIcon idea={idea} onDelete={() => handleDelete(idea.id)} />;
      default:
        return null;
    }
  };

  // Build a quick lookup for idea positions (including drag offsets)
  const getIdeaCenter = (ideaId: string) => {
    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea) return null;
    const offset = dragOffsets[idea.id];
    const x = clampX(idea.positionX + (offset?.x ?? 0)) + CARD_WIDTH / 2;
    const y = clampY(idea.positionY + (offset?.y ?? 0)) + CARD_HEIGHT / 2;
    return { x, y };
  };

  // Mini-map viewport rectangle (scaled down)
  const vpScaleX = MINIMAP_WIDTH / CANVAS_WIDTH;
  const vpScaleY = MINIMAP_HEIGHT / CANVAS_HEIGHT;

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Scrollable area — scrollbars hidden, navigate via drag or minimap */}
      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-hidden"
      >
        {/* Spacer that sets scrollable area to match zoomed canvas */}
        <div style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom }}>
        {/* Canvas */}
        <div
          className="relative cork-texture"
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            cursor: 'grab',
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
          }}
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

          {/* String connections SVG layer */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={{ zIndex: 1 }}
          >
            {connections.map((conn) => {
              const from = getIdeaCenter(conn.fromIdeaId);
              const to = getIdeaCenter(conn.toIdeaId);
              if (!from || !to) return null;

              const color = STRING_COLORS[conn.color as StringColor] || STRING_COLORS.red;
              const isSelected = selectedConnectionId === conn.id;

              // Quadratic bezier with gravity sag
              const midX = (from.x + to.x) / 2;
              const dist = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
              const sag = Math.min(dist * 0.15, 60);
              const midY = (from.y + to.y) / 2 + sag;
              const path = `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;

              return (
                <g key={conn.id}>
                  {/* Wider invisible hit area for clicking */}
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    className="pointer-events-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedConnectionId(isSelected ? null : conn.id);
                    }}
                  />
                  {/* Visible string */}
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={isSelected ? 4 : 2.5}
                    strokeLinecap="round"
                    opacity={isSelected ? 1 : 0.7}
                    style={{ filter: isSelected ? `drop-shadow(0 0 4px ${color})` : undefined }}
                  />
                  {/* Pins at endpoints */}
                  <circle cx={from.x} cy={from.y} r={4} fill={color} opacity={0.9} />
                  <circle cx={to.x} cy={to.y} r={4} fill={color} opacity={0.9} />
                </g>
              );
            })}
          </svg>

          {/* Selected connection toolbar */}
          {selectedConnectionId && (() => {
            const conn = connections.find((c) => c.id === selectedConnectionId);
            if (!conn) return null;
            const from = getIdeaCenter(conn.fromIdeaId);
            const to = getIdeaCenter(conn.toIdeaId);
            if (!from || !to) return null;

            const toolbarX = (from.x + to.x) / 2;
            const toolbarY = (from.y + to.y) / 2 - 40;

            return (
              <div
                className="absolute z-[9998] flex items-center gap-1 bg-surface/95 backdrop-blur rounded-full px-2 py-1 shadow-lg border border-primary/20"
                style={{ left: toolbarX, top: toolbarY, transform: 'translate(-50%, -50%)' }}
              >
                {(Object.entries(STRING_COLORS) as [StringColor, string][]).map(([name, hex]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onChangeConnectionColor?.(conn.id, name)}
                    className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                      conn.color === name ? 'scale-125 border-indigo/40' : 'border-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
                <div className="w-px h-4 bg-indigo/15 mx-0.5" />
                <button
                  type="button"
                  onClick={() => { onDeleteConnection?.(conn.id); setSelectedConnectionId(null); }}
                  className="text-red-400 hover:text-red-500 text-xs font-semibold px-1 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            );
          })()}

          {/* Idea cards */}
          {ideas.map((idea) => {
            const offset = dragOffsets[idea.id];
            const posX = clampX(idea.positionX + (offset?.x ?? 0));
            const posY = clampY(idea.positionY + (offset?.y ?? 0));
            const isDragging = draggingId === idea.id;
            const isConnectSource = connectMode && connectFrom === idea.id;
            const isSticker = idea.type === 'sticker';

            // Stickers render on a higher z-layer so they sit on top of cards
            const baseZ = isSticker ? idea.zIndex + 5000 : idea.zIndex;

            return (
              <div
                key={idea.id}
                className="absolute select-none"
                style={{
                  left: posX,
                  top: posY,
                  zIndex: isDragging ? 9999 : baseZ,
                  cursor: connectMode ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
                  transition: isDragging ? 'none' : 'box-shadow 0.2s',
                  filter: isDragging
                    ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.25))'
                    : isConnectSource
                      ? 'drop-shadow(0 0 8px rgba(196, 64, 64, 0.6))'
                      : undefined,
                  outline: isConnectSource ? '3px solid #C44040' : undefined,
                  outlineOffset: isSticker ? undefined : '2px',
                  borderRadius: isSticker ? undefined : '12px',
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
        </div>{/* close spacer */}
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

        {/* Connection lines on minimap */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={MINIMAP_WIDTH}
          height={MINIMAP_HEIGHT}
        >
          {connections.map((conn) => {
            const from = getIdeaCenter(conn.fromIdeaId);
            const to = getIdeaCenter(conn.toIdeaId);
            if (!from || !to) return null;

            const color = STRING_COLORS[conn.color as StringColor] || STRING_COLORS.red;
            return (
              <line
                key={conn.id}
                x1={from.x * vpScaleX}
                y1={from.y * vpScaleY}
                x2={to.x * vpScaleX}
                y2={to.y * vpScaleY}
                stroke={color}
                strokeWidth={1}
                opacity={0.6}
              />
            );
          })}
        </svg>

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

      {/* Zoom controls */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 z-[10000]">
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface/90 backdrop-blur shadow-md border border-primary/15 text-indigo/60 hover:text-indigo hover:bg-surface transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          onClick={zoomReset}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface/90 backdrop-blur shadow-md border border-primary/15 text-[10px] font-semibold text-indigo/50 hover:text-indigo hover:bg-surface transition-colors cursor-pointer"
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= minZoomRef.current}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface/90 backdrop-blur shadow-md border border-primary/15 text-indigo/60 hover:text-indigo hover:bg-surface transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
      </div>

      {/* Hint for panning */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-xs text-indigo/30 bg-surface/70 backdrop-blur px-3 py-1 rounded-full z-[10000] pointer-events-none">
        Drag to move cards &middot; Scroll to zoom &middot; Tap cards to edit
      </div>
    </div>
  );
}
