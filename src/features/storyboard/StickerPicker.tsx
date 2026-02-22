import { useState, useMemo } from 'react'
import { Icon } from '@iconify/react'
import { Search } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { categoriesForGenre, ALL_STICKER_ICONS } from './stickerData'

interface StickerPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (iconName: string) => void
  genre: string
}

/** Maximum icons shown per page to keep rendering snappy. */
const PAGE_SIZE = 80

export default function StickerPicker({ isOpen, onClose, onSelect, genre }: StickerPickerProps) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<string | null>(null)

  // Order categories by genre relevance
  const categories = useMemo(() => categoriesForGenre(genre), [genre])

  // Set default tab to first category on open
  const currentTab = activeTab || categories[0]?.label || ''

  // Active category
  const activeCategory = categories.find((c) => c.label === currentTab)

  // Search results (across all categories)
  const searchResults = useMemo(() => {
    if (!search.trim()) return null
    const term = search.toLowerCase().replace(/\s+/g, '-')
    return ALL_STICKER_ICONS.filter((name) => name.includes(term))
  }, [search])

  // Icons to display — search results or active category
  const displayIcons = searchResults ?? activeCategory?.icons ?? []
  const [page, setPage] = useState(0)

  // Reset page when tab or search changes
  const visibleIcons = displayIcons.slice(0, (page + 1) * PAGE_SIZE)
  const hasMore = visibleIcons.length < displayIcons.length

  const handleSelect = (iconName: string) => {
    onSelect(iconName)
    onClose()
    setSearch('')
    setActiveTab(null)
    setPage(0)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Sticker" size="lg">
      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          placeholder="Search stickers..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-primary/20 bg-cream/50 text-sm text-indigo placeholder:text-indigo/30 focus:outline-none focus:border-primary/40 transition-colors"
          autoFocus
        />
      </div>

      {/* Category tabs — hidden during search */}
      {!searchResults && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {categories.map((cat) => (
            <button
              key={cat.label}
              type="button"
              onClick={() => { setActiveTab(cat.label); setPage(0) }}
              className={`
                inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer
                ${currentTab === cat.label
                  ? 'bg-primary/15 text-primary shadow-sm'
                  : 'bg-cream/60 text-indigo/50 hover:bg-primary/10 hover:text-indigo/70'
                }
              `}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search result count */}
      {searchResults && (
        <p className="text-xs text-indigo/40 mb-3">
          {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;
        </p>
      )}

      {/* Icon grid */}
      <div className="grid grid-cols-8 sm:grid-cols-10 gap-1 max-h-[360px] overflow-y-auto p-1">
        {visibleIcons.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => handleSelect(name)}
            className="flex items-center justify-center w-full aspect-square rounded-lg hover:bg-primary/10 transition-colors cursor-pointer group"
            title={name.replace(/-/g, ' ')}
          >
            <Icon
              icon={`fluent-emoji-flat:${name}`}
              width={28}
              height={28}
              className="group-hover:scale-110 transition-transform"
            />
          </button>
        ))}

        {displayIcons.length === 0 && (
          <div className="col-span-full py-8 text-center text-indigo/30 text-sm">
            No stickers found
          </div>
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="text-center mt-3">
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="text-xs text-primary/60 hover:text-primary font-semibold transition-colors cursor-pointer"
          >
            Show more ({displayIcons.length - visibleIcons.length} remaining)
          </button>
        </div>
      )}
    </Modal>
  )
}
