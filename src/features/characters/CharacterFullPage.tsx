import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Heart,
  Users,
  Zap,
  BookOpen,
  TrendingUp,
  User,
  Wrench,
} from 'lucide-react';
import { useWritingTools } from '@/components/layout/WritingToolsContext';
import { useCharacter, deleteCharacter } from '@/hooks/useCharacters';
import { useImage } from '@/hooks/useImageStore';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import CharacterForm from './CharacterForm';

const roleBadgeVariant: Record<string, 'primary' | 'danger' | 'secondary' | 'accent'> = {
  protagonist: 'primary',
  antagonist: 'danger',
  supporting: 'secondary',
  minor: 'accent',
};

const roleLabels: Record<string, string> = {
  protagonist: 'Protagonist',
  antagonist: 'Antagonist',
  supporting: 'Supporting',
  minor: 'Minor',
};

export default function CharacterFullPage() {
  const { bookId, characterId } = useParams<{ bookId: string; characterId: string }>();
  const navigate = useNavigate();
  const { openWritingTools } = useWritingTools();
  const { character, loading } = useCharacter(characterId);
  const { url: imageUrl } = useImage(character?.mainImageId ?? null);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = async () => {
    if (!characterId) return;
    await deleteCharacter(characterId);
    navigate(`/book/${bookId}/characters`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="p-8">
          <div className="h-8 w-48 bg-indigo/10 rounded animate-pulse mb-8" />
          <div className="flex gap-8">
            <div className="w-80 h-96 bg-indigo/10 rounded-2xl animate-pulse" />
            <div className="flex-1 space-y-4">
              <div className="h-12 w-72 bg-indigo/10 rounded animate-pulse" />
              <div className="h-6 w-32 bg-indigo/10 rounded animate-pulse" />
              <div className="h-32 bg-indigo/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <p className="font-heading text-xl text-indigo/50 mb-4">Character not found</p>
          <Button variant="ghost" onClick={() => navigate(`/book/${bookId}/characters`)}>
            <ArrowLeft size={18} />
            Back to Characters
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Top navigation */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-primary/10 bg-cream/80 backdrop-blur-sm px-8 py-4">
        <button
          onClick={() => navigate(`/book/${bookId}/characters`)}
          className="inline-flex items-center gap-2 text-indigo/60 hover:text-primary transition-colors cursor-pointer font-semibold text-sm"
        >
          <ArrowLeft size={18} />
          Back to Characters
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            <Edit2 size={16} />
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={16} />
            Delete
          </Button>
          <button
            type="button"
            onClick={() => openWritingTools()}
            className="p-1.5 rounded-lg text-indigo/30 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer group"
            title="Writing Tools"
          >
            <Wrench size={16} className="group-hover:rotate-[-15deg] transition-transform duration-200" />
          </button>
        </div>
      </div>

      <div className="p-8 max-w-6xl mx-auto">
        {/* Hero section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col lg:flex-row gap-8 mb-12"
        >
          {/* Character portrait */}
          <div className="flex-shrink-0">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={character.name}
                className="w-80 h-96 object-cover rounded-2xl border-4 border-indigo shadow-xl"
              />
            ) : (
              <div className="w-80 h-96 rounded-2xl border-4 border-indigo shadow-xl bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center">
                <User size={80} className="text-indigo/20" strokeWidth={1.5} />
              </div>
            )}
          </div>

          {/* Character name and role */}
          <div className="flex flex-col justify-center gap-4">
            {/* Decorative accent line */}
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-primary rounded-full" />
              <div className="h-1 w-6 bg-secondary rounded-full" />
              <div className="h-1 w-3 bg-accent rounded-full" />
            </div>

            <h1 className="font-heading text-4xl lg:text-5xl text-indigo font-bold leading-tight">
              {character.name}
            </h1>

            <Badge
              variant={roleBadgeVariant[character.role] || 'primary'}
              size="md"
            >
              {roleLabels[character.role] || character.role}
            </Badge>

            {/* Decorative accent line bottom */}
            <div className="flex items-center gap-3">
              <div className="h-1 w-3 bg-accent rounded-full" />
              <div className="h-1 w-6 bg-secondary rounded-full" />
              <div className="h-1 w-12 bg-primary rounded-full" />
            </div>
          </div>
        </motion.div>

        {/* Detail sections - 2 column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Personality Traits */}
          {character.personalityTraits && character.personalityTraits.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Heart size={20} className="text-primary" />
                  <h2 className="font-heading text-lg text-indigo font-semibold">
                    Personality Traits
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {character.personalityTraits.map((trait) => (
                    <Badge key={trait} variant="primary" size="md">
                      {trait}
                    </Badge>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Relationships */}
          {character.relationships && character.relationships.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users size={20} className="text-secondary" />
                  <h2 className="font-heading text-lg text-indigo font-semibold">
                    Relationships
                  </h2>
                </div>
                <div className="flex flex-col gap-3">
                  {character.relationships.map((rel, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-xl border border-secondary/20 p-3 bg-secondary/5"
                    >
                      <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                        <Users size={14} className="text-secondary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-indigo">
                          {rel.characterName}
                        </p>
                        <p className="text-xs text-indigo/50">
                          {rel.relationshipType}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Special Abilities */}
          {character.specialAbilities && character.specialAbilities.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <Card className="p-6 border-accent/30 shadow-[0_0_15px_rgba(103,232,249,0.1)]">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={20} className="text-cyan-500" />
                  <h2 className="font-heading text-lg text-indigo font-semibold">
                    Special Abilities
                  </h2>
                </div>
                <div className="flex flex-col gap-3">
                  {character.specialAbilities.map((ability, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-accent/30 p-3 bg-accent/5"
                    >
                      <p className="font-semibold text-sm text-indigo mb-1">
                        {ability.name}
                      </p>
                      <p className="text-xs text-indigo/60 leading-relaxed">
                        {ability.description}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Backstory */}
          {character.backstory && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
            >
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen size={20} className="text-primary" />
                  <h2 className="font-heading text-lg text-indigo font-semibold">
                    Backstory
                  </h2>
                </div>
                <div className="rounded-xl bg-cream/50 border border-primary/10 p-4">
                  <p className="text-sm text-indigo/70 leading-relaxed whitespace-pre-wrap font-body">
                    {character.backstory}
                  </p>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Character Development */}
          {character.development && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={20} className="text-success" />
                  <h2 className="font-heading text-lg text-indigo font-semibold">
                    Character Development
                  </h2>
                </div>
                <div className="rounded-xl bg-cream/50 border border-success/10 p-4">
                  <p className="text-sm text-indigo/70 leading-relaxed whitespace-pre-wrap font-body">
                    {character.development}
                  </p>
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {bookId && (
        <CharacterForm
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          bookId={bookId}
          character={character}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Character"
        message={`Are you sure you want to delete "${character.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
