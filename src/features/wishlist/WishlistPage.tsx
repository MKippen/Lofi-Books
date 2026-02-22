import { useState } from 'react';
import { Plus, Bug, Sparkles, Lightbulb, Check, Undo2, Trash2, Pencil, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import TopBar from '@/components/layout/TopBar';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useWishlist, toggleWishlistItemStatus, deleteWishlistItem } from '@/hooks/useWishlist';
import { useAuth } from '@/hooks/useAuth';
import { getUserId } from '@/api/client';
import WishlistItemForm from './WishlistItemForm';
import type { WishlistItem, WishlistItemType } from '@/types';

const TYPE_CONFIG: Record<WishlistItemType, { icon: typeof Bug; label: string; bgClass: string; textClass: string }> = {
  bug: {
    icon: Bug,
    label: 'Bug',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
  },
  feature: {
    icon: Sparkles,
    label: 'Feature',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
  },
  idea: {
    icon: Lightbulb,
    label: 'Idea',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
  },
};

type FilterType = 'all' | WishlistItemType;

export default function WishlistPage() {
  const { items, loading } = useWishlist();
  const { displayName } = useAuth();
  const currentUserId = getUserId();
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter);

  // Split into open and done
  const openItems = filtered.filter((i) => i.status === 'open');
  const doneItems = filtered.filter((i) => i.status === 'done');

  const handleEdit = (item: WishlistItem) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingItem(undefined);
  };

  const handleSaved = () => {
    handleCloseForm();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteWishlistItem(deleteTarget);
    setDeleteTarget(null);
  };

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'bug', label: 'Bugs' },
    { value: 'feature', label: 'Features' },
    { value: 'idea', label: 'Ideas' },
  ];

  // Count by type for filter badges
  const bugCount = items.filter((i) => i.type === 'bug' && i.status === 'open').length;
  const featureCount = items.filter((i) => i.type === 'feature' && i.status === 'open').length;
  const ideaCount = items.filter((i) => i.type === 'idea' && i.status === 'open').length;
  const counts: Record<FilterType, number> = {
    all: items.filter((i) => i.status === 'open').length,
    bug: bugCount,
    feature: featureCount,
    idea: ideaCount,
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Wish List">
        <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
          <Plus size={18} />
          Make a Wish
        </Button>
      </TopBar>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto">
          {/* Friendly intro */}
          <p className="text-sm text-indigo/40 mb-6">
            A shared wish list! Write down bugs, features, or ideas — everyone can see them and mark them as done.
          </p>

          {/* Filter tabs */}
          {items.length > 0 && (
            <div className="flex gap-2 mb-6">
              {filterOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer
                    ${filter === opt.value
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-surface text-indigo/40 hover:bg-primary/10 hover:text-indigo/60'
                    }
                  `}
                >
                  {opt.label}
                  {counts[opt.value] > 0 && (
                    <span className="ml-1.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">
                      {counts[opt.value]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Loading skeleton */}
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl bg-surface p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No Wishes Yet!"
              description="Found a bug? Want a new feature? Make a wish and save it for later!"
              action={
                <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
                  <Plus size={16} />
                  Make a Wish
                </Button>
              }
            />
          ) : (
            <div className="space-y-6">
              {/* Open items */}
              {openItems.length > 0 && (
                <div className="flex flex-col gap-3">
                  {openItems.map((item) => (
                    <WishCard
                      key={item.id}
                      item={item}
                      isOwner={item.userId === currentUserId}
                      onToggle={() => toggleWishlistItemStatus(item.id)}
                      onEdit={() => handleEdit(item)}
                      onDelete={() => setDeleteTarget(item.id)}
                    />
                  ))}
                </div>
              )}

              {/* Done items */}
              {doneItems.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-indigo/30 uppercase tracking-wider mb-3">
                    Completed ({doneItems.length})
                  </h3>
                  <div className="flex flex-col gap-2">
                    {doneItems.map((item) => (
                      <WishCard
                        key={item.id}
                        item={item}
                        isOwner={item.userId === currentUserId}
                        onToggle={() => toggleWishlistItemStatus(item.id)}
                        onEdit={() => handleEdit(item)}
                        onDelete={() => setDeleteTarget(item.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Show message when filter returns nothing */}
              {filtered.length === 0 && (
                <p className="text-center text-indigo/30 text-sm py-8">
                  No {filter === 'all' ? '' : filter} wishes to show.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <WishlistItemForm
        isOpen={formOpen}
        onClose={handleCloseForm}
        onSaved={handleSaved}
        item={editingItem}
        createdByName={displayName}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Wish"
        message="Are you sure you want to remove this wish? This can't be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

// ── Individual Wish Card ────────────────────────────────────────────────

interface WishCardProps {
  item: WishlistItem;
  isOwner: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function WishCard({ item, isOwner, onToggle, onEdit, onDelete }: WishCardProps) {
  const isDone = item.status === 'done';
  const config = TYPE_CONFIG[item.type];
  const Icon = config.icon;
  const authorName = item.createdByName || 'Someone';

  return (
    <div
      className={`
        group flex items-start gap-3 rounded-xl border-2 p-4 transition-all duration-200
        ${isDone
          ? 'bg-surface/60 border-transparent opacity-60'
          : 'bg-surface border-primary/5 hover:border-primary/15 hover:shadow-sm'
        }
      `}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={onToggle}
        className={`
          mt-0.5 flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-2
          transition-all cursor-pointer
          ${isDone
            ? 'bg-primary border-primary text-white'
            : 'border-indigo/20 hover:border-primary hover:bg-primary/5'
          }
        `}
        title={isDone ? 'Mark as open' : 'Mark as done'}
      >
        {isDone && <Check size={14} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {/* Type badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${config.bgClass} ${config.textClass}`}>
            <Icon size={11} />
            {config.label}
          </span>

          {/* Title */}
          <h3 className={`font-semibold text-sm text-indigo truncate ${isDone ? 'line-through opacity-50' : ''}`}>
            {item.title}
          </h3>
        </div>

        {item.description && (
          <p className={`text-xs text-indigo/40 mt-1 line-clamp-2 ${isDone ? 'line-through' : ''}`}>
            {item.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2">
          <span className="inline-flex items-center gap-1 text-[10px] text-indigo/30">
            <User size={10} />
            {authorName}
          </span>
          <span className="text-[10px] text-indigo/20">·</span>
          <span className="text-[10px] text-indigo/25">
            {formatDistanceToNow(item.createdAt, { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Action buttons — show on hover + always on touch */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 touch-show transition-opacity">
        {isDone && (
          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 rounded-lg text-indigo/30 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            title="Reopen"
          >
            <Undo2 size={14} />
          </button>
        )}
        {isOwner && (
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-lg text-indigo/30 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
        )}
        {isOwner && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-indigo/30 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
