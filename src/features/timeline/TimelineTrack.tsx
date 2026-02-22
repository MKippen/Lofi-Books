import { useState, useRef, useCallback, useEffect } from 'react';
import { reorderTimelineEvents } from '@/hooks/useTimeline';
import TimelineEventNode from './TimelineEventNode';
import type { TimelineEvent } from '@/types';

interface TimelineTrackProps {
  events: TimelineEvent[];
  bookId: string;
  onEdit: (event: TimelineEvent) => void;
  onDelete: (id: string) => void;
}

const EVENT_SPACING = 220;
const ROW_HEIGHT = 360;
const ROW_GAP = 60;
const LEFT_PAD = 80;

export default function TimelineTrack({ events, bookId, onEdit, onDelete }: TimelineTrackProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  // Measure container width for responsive row calculation
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const sorted = [...events].sort((a, b) => a.sortOrder - b.sortOrder);

  // Calculate how many events fit per row
  const eventsPerRow = Math.max(2, Math.floor((containerWidth - LEFT_PAD - 80) / EVENT_SPACING));
  const numRows = Math.ceil(sorted.length / eventsPerRow) || 1;
  const rowWidth = Math.max(eventsPerRow * EVENT_SPACING + LEFT_PAD + 40, 600);
  const totalHeight = numRows * ROW_HEIGHT + (numRows - 1) * ROW_GAP;

  // Compute row/col for a given index
  const getPosition = (index: number) => {
    const row = Math.floor(index / eventsPerRow);
    const col = index % eventsPerRow;
    return {
      row,
      col,
      offsetX: LEFT_PAD + col * EVENT_SPACING,
      offsetY: row * (ROW_HEIGHT + ROW_GAP),
    };
  };

  const handleDragStart = useCallback((eventId: string, pointerX: number, pointerY: number) => {
    setDraggedId(eventId);
    setGhostPos({ x: pointerX, y: pointerY });
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggedId) return;
      setGhostPos({ x: e.clientX, y: e.clientY });
    },
    [draggedId]
  );

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent) => {
      if (!draggedId || !trackRef.current) {
        setDraggedId(null);
        setGhostPos(null);
        return;
      }

      const trackRect = trackRef.current.getBoundingClientRect();
      const scrollLeft = trackRef.current.scrollLeft;
      const scrollTop = trackRef.current.scrollTop;
      const relativeX = e.clientX - trackRect.left + scrollLeft;
      const relativeY = e.clientY - trackRect.top + scrollTop;

      // Determine which row and column the pointer is in
      const row = Math.max(0, Math.min(Math.round(relativeY / (ROW_HEIGHT + ROW_GAP)), numRows - 1));
      const col = Math.max(0, Math.min(Math.round((relativeX - LEFT_PAD) / EVENT_SPACING), eventsPerRow - 1));
      const slotIndex = Math.min(row * eventsPerRow + col, sorted.length - 1);
      const clampedIndex = Math.max(0, slotIndex);

      const draggedIndex = sorted.findIndex((ev) => ev.id === draggedId);

      if (draggedIndex !== clampedIndex) {
        const reordered = [...sorted];
        const [moved] = reordered.splice(draggedIndex, 1);
        reordered.splice(clampedIndex, 0, moved);
        const orderedIds = reordered.map((ev) => ev.id);
        await reorderTimelineEvents(bookId, orderedIds);
      }

      setDraggedId(null);
      setGhostPos(null);
    },
    [draggedId, sorted, bookId, numRows, eventsPerRow]
  );

  const draggedEvent = draggedId ? sorted.find((ev) => ev.id === draggedId) : null;

  // Determine the last event's position for the End label
  const lastPos = sorted.length > 0 ? getPosition(sorted.length - 1) : { row: 0, col: 0, offsetX: LEFT_PAD, offsetY: 0 };

  return (
    <div
      ref={trackRef}
      className="relative overflow-auto pb-4"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="relative" style={{ minWidth: `${rowWidth}px`, height: `${totalHeight}px` }}>
        {/* Per-row horizontal timeline lines */}
        {Array.from({ length: numRows }).map((_, rowIndex) => {
          const eventsInRow = Math.min(eventsPerRow, sorted.length - rowIndex * eventsPerRow);
          const lineRight = LEFT_PAD + eventsInRow * EVENT_SPACING;
          const y = rowIndex * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2;
          return (
            <div
              key={`line-${rowIndex}`}
              className="absolute h-[2px] rounded-full"
              style={{
                left: `${LEFT_PAD - 40}px`,
                width: `${lineRight - LEFT_PAD + 80}px`,
                top: `${y}px`,
                transform: 'translateY(-50%)',
                background: 'linear-gradient(to right, #7C9A6E, #C4836A)',
              }}
            />
          );
        })}

        {/* Vertical/curved connectors between rows */}
        {Array.from({ length: numRows - 1 }).map((_, rowIndex) => {
          const eventsInRow = Math.min(eventsPerRow, sorted.length - rowIndex * eventsPerRow);
          // Connector goes from end of this row down to start of next row
          const topLineY = rowIndex * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2;
          const bottomLineY = (rowIndex + 1) * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2;
          const endX = LEFT_PAD + (eventsInRow - 1) * EVENT_SPACING + 90; // center of last card
          const startX = LEFT_PAD + 10; // beginning of next row

          return (
            <svg
              key={`connector-${rowIndex}`}
              className="absolute pointer-events-none"
              style={{
                left: 0,
                top: `${topLineY}px`,
                width: `${Math.max(endX, startX) + 40}px`,
                height: `${bottomLineY - topLineY}px`,
              }}
            >
              <path
                d={`M ${endX} 0 C ${endX} ${(bottomLineY - topLineY) * 0.4}, ${startX} ${(bottomLineY - topLineY) * 0.6}, ${startX} ${bottomLineY - topLineY}`}
                stroke="#C4836A"
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeDasharray="6 4"
                opacity={0.5}
              />
            </svg>
          );
        })}

        {/* Start label (row 0, far left) */}
        <div
          className="absolute flex items-center gap-2 z-10"
          style={{
            left: '16px',
            top: `${ROW_HEIGHT / 2}px`,
            transform: 'translateY(-50%)',
          }}
        >
          <div className="w-4 h-4 rounded-full bg-primary shadow-md shadow-primary/30" />
          <span className="font-heading text-xs text-indigo/50 uppercase tracking-wider">Start</span>
        </div>

        {/* End label (after last event) */}
        <div
          className="absolute flex items-center gap-2 z-10"
          style={{
            left: `${lastPos.offsetX + 200}px`,
            top: `${lastPos.offsetY + ROW_HEIGHT / 2}px`,
            transform: 'translateY(-50%)',
          }}
        >
          <span className="font-heading text-xs text-indigo/50 uppercase tracking-wider">End</span>
          <div className="w-4 h-4 rounded-full bg-secondary shadow-md shadow-secondary/30" />
        </div>

        {/* Event nodes */}
        {sorted.map((event, index) => {
          const { col, offsetX, offsetY } = getPosition(index);
          return (
            <TimelineEventNode
              key={event.id}
              event={event}
              index={index}
              col={col}
              offsetX={offsetX}
              offsetY={offsetY}
              rowHeight={ROW_HEIGHT}
              onEdit={onEdit}
              onDelete={onDelete}
              onDragStart={handleDragStart}
              isDragging={draggedId === event.id}
            />
          );
        })}

        {/* Ghost element while dragging */}
        {draggedId && ghostPos && draggedEvent && (
          <div
            className="fixed z-50 pointer-events-none opacity-70"
            style={{
              left: ghostPos.x - 90,
              top: ghostPos.y - 60,
            }}
          >
            <div
              className="w-[180px] rounded-xl bg-surface shadow-xl border-l-4 p-3"
              style={{ borderColor: draggedEvent.color }}
            >
              <p className="font-heading text-sm font-bold text-indigo truncate">
                {draggedEvent.title}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
