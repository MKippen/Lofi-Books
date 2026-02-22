import { Icon } from '@iconify/react'
import { Trash2 } from 'lucide-react'
import type { Idea } from '@/types'

interface StickerIconProps {
  idea: Idea
  onDelete?: () => void
}

/**
 * Renders a placed sticker on the storyboard cork board.
 * Uses Fluent Emoji Flat icons via Iconify.
 */
export default function StickerIcon({ idea, onDelete }: StickerIconProps) {
  const size = idea.width || 80

  return (
    <div
      className="group relative"
      style={{ width: size, height: size }}
    >
      <div className="w-full h-full flex items-center justify-center drop-shadow-md transition-transform duration-150 group-hover:scale-105">
        <Icon
          icon={`fluent-emoji-flat:${idea.title}`}
          width={size * 0.85}
          height={size * 0.85}
        />
      </div>

      {/* Delete button — appears on hover */}
      {onDelete && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-500 touch-show"
          title="Remove sticker"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  )
}
