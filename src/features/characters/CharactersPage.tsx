import { useState } from 'react';
import { useParams } from 'react-router';
import { Plus, Users } from 'lucide-react';
import { useCharacters } from '@/hooks/useCharacters';
import TopBar from '@/components/layout/TopBar';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import MangaPanelCard from './MangaPanelCard';
import CharacterForm from './CharacterForm';

export default function CharactersPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const { characters, loading } = useCharacters(bookId);
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Characters">
        <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
          <Plus size={18} />
          Add Character
        </Button>
      </TopBar>

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-72 rounded-lg border-3 border-indigo/10 bg-surface animate-pulse"
              />
            ))}
          </div>
        ) : characters.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Characters Yet!"
            description="Create your first character to bring your story to life!"
            action={
              <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
                <Plus size={18} />
                Add Character
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {characters.map((character) => (
              <MangaPanelCard key={character.id} character={character} />
            ))}
          </div>
        )}
      </div>

      {bookId && (
        <CharacterForm
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          bookId={bookId}
        />
      )}
    </div>
  );
}
