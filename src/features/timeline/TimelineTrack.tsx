import { useState, useRef, useCallback } from 'react';
import { reorderTimelineEvents } from '@/hooks/useTimeline';
import TimelineEventNode from './TimelineEventNode';
import type { TimelineEvent } from '@/types';

interface TimelineTrackProps {
  events: TimelineEvent[];
  bookId: string;
  onEdit: (event: TimelineEvent) => void;
  onDelete: (id: string) => void;
}

export default function TimelineTrack({ events, bookId, onEdit, onDelete }: TimelineTrackProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const sorted = [...events].sort((a, b) => a.sortOrder - b.sortOrder);
  const trackWidth = Math.max(sorted.length * 220, 600);

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

      // Find which slot the pointer is over
      const trackRect = trackRef.current.getBoundingClientRect();
      const scrollLeft = trackRef.current.scrollLeft;
      const relativeX = e.clientX - trackRect.left + scrollLeft;
      const slotIndex = Math.round(relativeX / 220);
      const clampedIndex = Math.max(0, Math.min(slotIndex, sorted.length - 1));

      const draggedIndex = sorted.findIndex((ev) => ev.id === draggedId);

      if (draggedIndex !== clampedIndex) {
        // Build reordered list
        const reordered = [...sorted];
        const [moved] = reordered.splice(draggedIndex, 1);
        reordered.splice(clampedIndex, 0, moved);
        const orderedIds = reordered.map((ev) => ev.id);
        await reorderTimelineEvents(bookId, orderedIds);
      }

      setDraggedId(null);
      setGhostPos(null);
    },
    [draggedId, sorted, bookId]
  );

  const draggedEvent = draggedId ? sorted.find((ev) => ev.id === draggedId) : null;

  return (
    <div
      ref={trackRef}
      className="relative overflow-x-auto pb-4"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="relative" style={{ minWidth: `${trackWidth}px`, height: '360px' }}>
        {/* Start label */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
          <div className="w-4 h-4 rounded-full bg-primary shadow-md shadow-primary/30" />
          <span className="font-heading text-xs text-indigo/50 uppercase tracking-wider">Start</span>
        </div>

        {/* Horizontal timeline line */}
        <div
          className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-[2px] rounded-full"
          style={{
            background: 'linear-gradient(to right, #7C9A6E, #C4836A)',
          }}
        />

        {/* End label */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
          <span className="font-heading text-xs text-indigo/50 uppercase tracking-wider">End</span>
          <div className="w-4 h-4 rounded-full bg-secondary shadow-md shadow-secondary/30" />
        </div>

        {/* Event nodes */}
        {sorted.map((event, index) => (
          <TimelineEventNode
            key={event.id}
            event={event}
            index={index}
            offsetX={80 + index * 220}
            onEdit={onEdit}
            onDelete={onDelete}
            onDragStart={handleDragStart}
            isDragging={draggedId === event.id}
          />
        ))}

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
