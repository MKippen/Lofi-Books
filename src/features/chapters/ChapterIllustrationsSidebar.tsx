import { useRef, useState } from 'react';
import { Palette, Plus, Trash2, X } from 'lucide-react';
import { useIllustrations, createIllustration, updateIllustration, deleteIllustration } from '@/hooks/useIllustrations';
import { storeImage } from '@/hooks/useImageStore';
import { imageUrl } from '@/api/images';

interface ChapterIllustrationsSidebarProps {
  bookId: string;
  chapterId: string;
}

export default function ChapterIllustrationsSidebar({ bookId, chapterId }: ChapterIllustrationsSidebarProps) {
  const { illustrations } = useIllustrations(bookId, chapterId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const handleAddImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const imgId = await storeImage(bookId, file);
      await createIllustration(bookId, chapterId, imgId);
    } catch (err) {
      console.error('Failed to upload illustration:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    await deleteIllustration(id);
  };

  const startEditCaption = (id: string, caption: string) => {
    setEditingId(id);
    setEditCaption(caption);
  };

  const saveCaption = async () => {
    if (editingId) {
      await updateIllustration(editingId, { caption: editCaption });
      setEditingId(null);
    }
  };

  return (
    <div className="w-72 bg-accent/5 border-l border-accent/20 h-full flex flex-col">
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <p className="text-xs text-indigo/40">
          Add your artwork here
        </p>
        <button
          type="button"
          onClick={handleAddImage}
          disabled={uploading}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-accent hover:bg-accent/10 transition-colors cursor-pointer disabled:opacity-50"
        >
          <Plus size={14} />
          {uploading ? 'Uploading...' : 'Add'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
        {illustrations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-indigo/30">
            <Palette size={32} strokeWidth={1} />
            <p className="text-xs mt-2 text-center">
              No drawings yet.<br />Add your artwork here!
            </p>
          </div>
        )}

        {illustrations.map((ill) => {
          const url = imageUrl(ill.imageId);
          return (
            <div
              key={ill.id}
              className="group relative rounded-xl overflow-hidden border-2 border-accent/15 bg-surface shadow-sm"
            >
              {/* Image */}
              {url && (
                <button
                  type="button"
                  onClick={() => setViewingImage(url)}
                  className="w-full cursor-pointer"
                >
                  <img
                    src={url}
                    alt={ill.caption || 'Illustration'}
                    className="w-full h-auto object-cover"
                  />
                </button>
              )}

              {/* Caption */}
              <div className="px-3 py-2">
                {editingId === ill.id ? (
                  <input
                    type="text"
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    onBlur={saveCaption}
                    onKeyDown={(e) => e.key === 'Enter' && saveCaption()}
                    autoFocus
                    className="w-full text-xs bg-transparent border-b border-accent/30 focus:border-accent focus:outline-none text-indigo/70 pb-0.5"
                    placeholder="Add a caption..."
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditCaption(ill.id, ill.caption)}
                    className="w-full text-left text-xs text-indigo/50 hover:text-indigo/70 transition-colors cursor-pointer truncate"
                  >
                    {ill.caption || 'Click to add caption...'}
                  </button>
                )}
              </div>

              {/* Delete button */}
              <button
                type="button"
                onClick={() => handleDelete(ill.id)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-indigo/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-500"
                title="Remove illustration"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Lightbox overlay for viewing full image */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}
        >
          <button
            type="button"
            onClick={() => setViewingImage(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
          <img
            src={viewingImage}
            alt="Full size illustration"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
