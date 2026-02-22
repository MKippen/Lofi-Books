import { useNavigate, useParams } from 'react-router';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import { useImage } from '@/hooks/useImageStore';
import Badge from '@/components/ui/Badge';
import type { Character } from '@/types';

interface MangaPanelCardProps {
  character: Character;
}

const roleBadgeVariant: Record<Character['role'], 'primary' | 'danger' | 'secondary' | 'accent'> = {
  protagonist: 'primary',
  antagonist: 'danger',
  supporting: 'secondary',
  minor: 'accent',
};

const roleLabels: Record<Character['role'], string> = {
  protagonist: 'Protagonist',
  antagonist: 'Antagonist',
  supporting: 'Supporting',
  minor: 'Minor',
};

export default function MangaPanelCard({ character }: MangaPanelCardProps) {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { url: imageUrl } = useImage(character.mainImageId);

  const firstTrait = character.personalityTraits?.[0] || '...';

  return (
    <motion.div
      whileHover={{ scale: 1.03, rotate: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={() => navigate(`/book/${bookId}/characters/${character.id}`)}
      className="relative cursor-pointer"
    >
      <div className="relative rounded-lg border-3 border-indigo bg-surface shadow-md overflow-hidden transition-shadow duration-200 hover:shadow-xl">
        {/* Speech bubble */}
        <div className="absolute top-3 right-3 z-10">
          <div className="relative bg-surface border-2 border-indigo rounded-xl px-3 py-1.5 text-xs font-semibold text-indigo max-w-[120px] truncate shadow-sm">
            {firstTrait}
            {/* Triangle pointer */}
            <div className="absolute -bottom-2 right-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-indigo" />
            <div className="absolute -bottom-[5px] right-[17px] w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-surface" />
          </div>
        </div>

        {/* Character image */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={character.name}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center">
            <User size={56} className="text-indigo/20" strokeWidth={1.5} />
          </div>
        )}

        {/* Character info */}
        <div className="p-4 flex flex-col gap-2">
          <h3 className="font-heading text-lg font-bold text-indigo truncate">
            {character.name}
          </h3>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={roleBadgeVariant[character.role]} size="sm">
              {roleLabels[character.role]}
            </Badge>
          </div>

          {character.personalityTraits && character.personalityTraits.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              {character.personalityTraits.slice(0, 3).map((trait) => (
                <Badge key={trait} variant="accent" size="sm">
                  {trait}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
