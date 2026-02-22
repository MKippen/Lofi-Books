import { useState } from 'react';
import { useParams } from 'react-router';
import { StickyNote, Image, BookText, Lightbulb } from 'lucide-react';
import { useIdeas } from '@/hooks/useIdeas';
import TopBar from '@/components/layout/TopBar';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import InfiniteCorkBoard from './InfiniteCorkBoard';
import IdeaForm from './IdeaForm';
import type { Idea, IdeaType } from '@/types';

export default function StoryboardPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const { ideas, loading } = useIdeas(bookId);
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<IdeaType>('note');
  const [editingIdea, setEditingIdea] = useState<Idea | undefined>(undefined);

  const openForm = (type: IdeaType) => {
    setFormType(type);
    setEditingIdea(undefined);
    setFormOpen(true);
  };

  const handleEditIdea = (idea: Idea) => {
    setFormType(idea.type);
    setEditingIdea(idea);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingIdea(undefined);
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Storyboard">
        <Button variant="primary" size="sm" onClick={() => openForm('note')}>
          <StickyNote size={18} />
          Add Sticky Note
        </Button>
        <Button variant="secondary" size="sm" onClick={() => openForm('image')}>
          <Image size={18} />
          Add Photo
        </Button>
        <Button variant="ghost" size="sm" onClick={() => openForm('chapter-idea')}>
          <BookText size={18} />
          Add Chapter Idea
        </Button>
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

      {bookId && (
        <IdeaForm
          isOpen={formOpen}
          onClose={handleCloseForm}
          bookId={bookId}
          ideaType={formType}
          idea={editingIdea}
        />
      )}
    </div>
  );
}
