import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { StickyNote, Image, BookText, Lightbulb, Cable, Sticker } from 'lucide-react';
import { useIdeas, createIdea } from '@/hooks/useIdeas';
import { useConnections, createConnection, deleteConnection, updateConnection } from '@/hooks/useConnections';
import { getBook } from '@/api/books';
import TopBar from '@/components/layout/TopBar';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import InfiniteCorkBoard from './InfiniteCorkBoard';
import IdeaForm from './IdeaForm';
import StickerPicker from './StickerPicker';
import type { Idea, IdeaType, StringColor } from '@/types';
import { STRING_COLORS } from '@/types';

export default function StoryboardPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const { ideas, loading } = useIdeas(bookId);
  const { connections } = useConnections(bookId);
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<IdeaType>('note');
  const [editingIdea, setEditingIdea] = useState<Idea | undefined>(undefined);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [bookGenre, setBookGenre] = useState('');

  // Connect mode state
  const [connectMode, setConnectMode] = useState(false);
  const [connectColor, setConnectColor] = useState<StringColor>('red');
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  // Fetch book genre for sticker suggestions
  useEffect(() => {
    if (!bookId) return;
    getBook(bookId).then((book) => {
      if (book?.genre) setBookGenre(book.genre);
    }).catch(() => { /* ignore */ });
  }, [bookId]);

  const openForm = (type: IdeaType) => {
    setFormType(type);
    setEditingIdea(undefined);
    setFormOpen(true);
  };

  const handleEditIdea = (idea: Idea) => {
    if (connectMode) return; // Don't open edit in connect mode
    // Don't open form for stickers — they use the sticker picker
    if (idea.type === 'sticker') return;
    setFormType(idea.type);
    setEditingIdea(idea);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingIdea(undefined);
  };

  const handleStickerSelect = async (iconName: string) => {
    if (!bookId) return;
    await createIdea({
      bookId,
      type: 'sticker',
      title: iconName,
      description: '',
      imageId: null,
      color: 'sakura-white',
      linkedChapterId: null,
      positionX: Math.floor(Math.random() * 700) + 100,
      positionY: Math.floor(Math.random() * 500) + 100,
      width: 80,
      height: 80,
    });
  };

  const handleConnectClick = (ideaId: string) => {
    if (!connectMode || !bookId) return;

    if (!connectFrom) {
      setConnectFrom(ideaId);
    } else if (connectFrom !== ideaId) {
      // Create the connection
      createConnection(bookId, connectFrom, ideaId, connectColor);
      setConnectFrom(null);
    } else {
      // Clicked same card — cancel
      setConnectFrom(null);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    await deleteConnection(connectionId);
  };

  const handleChangeConnectionColor = async (connectionId: string, color: StringColor) => {
    await updateConnection(connectionId, { color });
  };

  const toggleConnectMode = () => {
    setConnectMode((v) => !v);
    setConnectFrom(null);
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Storyboard">
        <Button variant="ghost" size="sm" onClick={() => openForm('note')}>
          <StickyNote size={18} />
          Add Sticky Note
        </Button>
        <Button variant="ghost" size="sm" onClick={() => openForm('image')}>
          <Image size={18} />
          Add Photo
        </Button>
        <Button variant="ghost" size="sm" onClick={() => openForm('chapter-idea')}>
          <BookText size={18} />
          Add Chapter Idea
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setStickerPickerOpen(true)}>
          <Sticker size={18} />
          Add Sticker
        </Button>

        <div className="w-px h-6 bg-indigo/10 mx-1" />

        <Button
          variant={connectMode ? 'primary' : 'ghost'}
          size="sm"
          onClick={toggleConnectMode}
        >
          <Cable size={18} />
          {connectMode ? 'Done' : 'Connect'}
        </Button>

        {/* Color picker when in connect mode */}
        {connectMode && (
          <div className="flex items-center gap-1 ml-1">
            {(Object.entries(STRING_COLORS) as [StringColor, string][]).map(([name, hex]) => (
              <button
                key={name}
                type="button"
                onClick={() => { setConnectColor(name); setConnectFrom(null); }}
                className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                  connectColor === name ? 'scale-125 border-white shadow-md' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: hex }}
                title={name}
              />
            ))}
          </div>
        )}
      </TopBar>

      <div className="relative flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {bookId && (
              <InfiniteCorkBoard
                ideas={ideas}
                bookId={bookId}
                onEditIdea={handleEditIdea}
                connections={connections}
                connectMode={connectMode}
                connectFrom={connectFrom}
                onConnectClick={handleConnectClick}
                onDeleteConnection={handleDeleteConnection}
                onChangeConnectionColor={handleChangeConnectionColor}
              />
            )}
            {ideas.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto">
                  <EmptyState
                    icon={Lightbulb}
                    title="Your Corkboard Awaits!"
                    description="Pin sticky notes, photos, and chapter ideas to organize your story visually."
                    action={
                      <Button variant="primary" size="sm" onClick={() => openForm('note')}>
                        <StickyNote size={18} />
                        Add First Idea
                      </Button>
                    }
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Connect mode hint */}
      {connectMode && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[10001] bg-indigo/80 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {connectFrom
            ? 'Now click another card to connect them'
            : 'Click a card to start a connection'}
        </div>
      )}

      {bookId && (
        <IdeaForm
          isOpen={formOpen}
          onClose={handleCloseForm}
          bookId={bookId}
          ideaType={formType}
          idea={editingIdea}
        />
      )}

      <StickerPicker
        isOpen={stickerPickerOpen}
        onClose={() => setStickerPickerOpen(false)}
        onSelect={handleStickerSelect}
        genre={bookGenre}
      />
    </div>
  );
}
