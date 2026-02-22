import { useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import type { TimelineEvent, TimelineEventType } from '@/types';

interface TimelineEventNodeProps {
  event: TimelineEvent;
  index: number;
  offsetX: number;
  onEdit: (event: TimelineEvent) => void;
  onDelete: (id: string) => void;
  onDragStart: (eventId: string, pointerX: number, pointerY: number) => void;
  isDragging: boolean;
}

const badgeVariantMap: Record<TimelineEventType, 'primary' | 'secondary' | 'accent' | 'danger' | 'success'> = {
  plot: 'primary',
  character: 'secondary',
  setting: 'accent',
  conflict: 'danger',
  resolution: 'success',
};

export default function TimelineEventNode({
  event,
  index,
  offsetX,
  onEdit,
  onDelete,
  onDragStart,
  isDragging,
}: TimelineEventNodeProps) {
  const [hovered, setHovered] = useState(false);
  const isAbove = index % 2 === 0;

  const cardY = isAbove ? 'bottom-[calc(50%+20px)]' : 'top-[calc(50%+20px)]';
  const connectorY = isAbove ? 'bottom-[calc(50%+2px)]' : 'top-[calc(50%+2px)]';

  return (
    <div
      className="absolute"
      style={{
        left: `${offsetX}px`,
        top: 0,
        bottom: 0,
        width: '180px',
        opacity: isDragging ? 0.3 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Colored circle on the timeline line (drag handle) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-20 cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          onDragStart(event.id, e.clientX, e.clientY);
        }}
      >
        <motion.div
          className="w-5 h-5 rounded-full border-[3px] border-surface shadow-md"
          style={{ backgroundColor: event.color }}
          whileHover={{ scale: 1.3 }}
          transition={{ duration: 0.15 }}
        />
      </div>

      {/* Connecting line from circle to card */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-[2px] h-[18px] ${connectorY}`}
        style={{ backgroundColor: event.color }}
      />

      {/* Event card */}
      <motion.div
        className={`absolute left-0 w-[180px] ${cardY} cursor-pointer`}
        animate={{ y: hovered ? (isAbove ? -4 : 4) : 0 }}
        transition={{ duration: 0.15 }}
        onClick={() => onEdit(event)}
      >
        <div
          className={`
            bg-surface rounded-xl shadow-md border-l-4 p-3
            transition-shadow duration-200
            ${hovered ? 'shadow-lg' : ''}
          `}
          style={{ borderColor: event.color }}
        >
          {/* Event type badge */}
          <Badge variant={badgeVariantMap[event.eventType]} size="sm">
            {event.eventType}
          </Badge>

          {/* Title */}
          <h4 className="font-heading text-sm font-bold text-indigo mt-1.5 truncate">
            {event.title}
          </h4>

          {/* Description */}
          {event.description && (
            <p className="text-xs text-indigo/60 mt-1 line-clamp-2">
              {event.description}
            </p>
          )}

          {/* Action buttons on hover */}
          {hovered && (
            <div className="flex items-center gap-1 mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(event);
                }}
                className="p-1 rounded-lg text-indigo/40 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(event.id);
                }}
                className="p-1 rounded-lg text-indigo/40 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
