export interface Book {
  id: string;
  title: string;
  description: string;
  coverImageId: string | null;
  genre: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Character {
  id: string;
  bookId: string;
  name: string;
  mainImageId: string | null;
  backstory: string;
  development: string;
  personalityTraits: string[];
  relationships: CharacterRelationship[];
  specialAbilities: SpecialAbility[];
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterRelationship {
  characterName: string;
  relationshipType: string;
}

export interface RelationshipTypeCategory {
  category: string;
  types: string[];
}

export const RELATIONSHIP_TYPE_CATEGORIES: RelationshipTypeCategory[] = [
  {
    category: 'Family',
    types: ['Parent', 'Child', 'Sibling', 'Grandparent', 'Spouse', 'Cousin', 'Adopted Family'],
  },
  {
    category: 'Romantic',
    types: ['Love Interest', 'Partner', 'Ex-Partner', 'Betrothed'],
  },
  {
    category: 'Friendship & Social',
    types: ['Best Friend', 'Friend', 'Companion', 'Rival', 'Ally'],
  },
  {
    category: 'Professional & Power',
    types: ['Mentor', 'Student', 'Leader', 'Subordinate', 'Employer', 'Colleague'],
  },
  {
    category: 'Antagonistic',
    types: ['Enemy', 'Nemesis', 'Betrayer'],
  },
  {
    category: 'Supernatural & Special',
    types: ['Familiar', 'Bond-Mate', 'Creator', 'Guardian', 'Clone'],
  },
];

export const RELATIONSHIP_TYPES: string[] = RELATIONSHIP_TYPE_CATEGORIES.flatMap(
  (cat) => cat.types
);

export interface SpecialAbility {
  name: string;
  description: string;
}

export interface AbilityTypeCategory {
  category: string;
  abilities: { name: string; description: string }[];
}

export const ABILITY_TYPE_CATEGORIES: AbilityTypeCategory[] = [
  {
    category: 'Physical',
    abilities: [
      { name: 'Super Strength', description: 'Incredible physical power beyond normal limits' },
      { name: 'Super Speed', description: 'Can move faster than the eye can see' },
      { name: 'Flight', description: 'Can fly or float through the air' },
      { name: 'Invisibility', description: 'Can become unseen by others' },
      { name: 'Shape-Shifting', description: 'Can change their appearance or form' },
    ],
  },
  {
    category: 'Mental',
    abilities: [
      { name: 'Telepathy', description: 'Can read or send thoughts to other minds' },
      { name: 'Telekinesis', description: 'Can move objects with their mind' },
      { name: 'Future Vision', description: 'Can see glimpses of what will happen' },
      { name: 'Genius Intellect', description: 'Extraordinarily smart, can solve any problem' },
      { name: 'Memory Master', description: 'Never forgets anything they see or hear' },
    ],
  },
  {
    category: 'Elemental',
    abilities: [
      { name: 'Fire Control', description: 'Can create and control flames' },
      { name: 'Water Control', description: 'Can command water and ice' },
      { name: 'Lightning Power', description: 'Can summon and direct electricity' },
      { name: 'Earth Control', description: 'Can move rock, soil, and metal' },
      { name: 'Wind Control', description: 'Can command the air and storms' },
    ],
  },
  {
    category: 'Magical',
    abilities: [
      { name: 'Healing', description: 'Can cure injuries and sickness with a touch' },
      { name: 'Spell Casting', description: 'Can use magic spells and enchantments' },
      { name: 'Portal Creation', description: 'Can open gateways to other places' },
      { name: 'Time Control', description: 'Can slow, stop, or reverse time' },
      { name: 'Illusion Magic', description: 'Can create realistic illusions that fool the senses' },
    ],
  },
  {
    category: 'Skills & Talents',
    abilities: [
      { name: 'Master Fighter', description: 'Expert in combat and martial arts' },
      { name: 'Stealth Expert', description: 'Can sneak around without being detected' },
      { name: 'Tech Genius', description: 'Can build and hack any technology' },
      { name: 'Animal Bond', description: 'Can communicate with and command animals' },
      { name: 'Leadership', description: 'Natural leader who inspires others to follow' },
    ],
  },
];

export type IdeaType = 'note' | 'image' | 'chapter-idea';

export type IdeaColor =
  | 'galaxy-purple'
  | 'galaxy-blue'
  | 'galaxy-teal'
  | 'galaxy-pink'
  | 'sakura-pink'
  | 'sakura-white'
  | 'sakura-rose'
  | 'sakura-blush';

export interface Idea {
  id: string;
  bookId: string;
  type: IdeaType;
  title: string;
  description: string;
  imageId: string | null;
  color: IdeaColor;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  zIndex: number;
  linkedChapterId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TimelineEventType = 'plot' | 'character' | 'setting' | 'conflict' | 'resolution';

export interface TimelineEvent {
  id: string;
  bookId: string;
  chapterId: string | null;
  title: string;
  description: string;
  eventType: TimelineEventType;
  sortOrder: number;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ChapterStatus = 'draft' | 'in-progress' | 'complete';

export interface Chapter {
  id: string;
  bookId: string;
  title: string;
  content: string;
  sortOrder: number;
  wordCount: number;
  status: ChapterStatus;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredImage {
  id: string;
  bookId: string;
  blob: Blob;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

export const IDEA_COLORS: Record<IdeaColor, string> = {
  'galaxy-purple': '#6B5B7B',
  'galaxy-blue': '#4A6B7A',
  'galaxy-teal': '#4A7A6A',
  'galaxy-pink': '#8B5A5A',
  'sakura-pink': '#C4A090',
  'sakura-white': '#E8E0D8',
  'sakura-rose': '#B8A098',
  'sakura-blush': '#D4C0B8',
};

export const IDEA_COLOR_TEXT: Record<IdeaColor, string> = {
  'galaxy-purple': '#F0EBF5',
  'galaxy-blue': '#E0EBF0',
  'galaxy-teal': '#E0F0EB',
  'galaxy-pink': '#F5EBEB',
  'sakura-pink': '#2C2C2C',
  'sakura-white': '#2C2C2C',
  'sakura-rose': '#2C2C2C',
  'sakura-blush': '#2C2C2C',
};

export const TIMELINE_EVENT_COLORS: Record<TimelineEventType, string> = {
  plot: '#7C9A6E',
  character: '#C4836A',
  setting: '#8BAEC4',
  conflict: '#C47070',
  resolution: '#8DB580',
};

// ── Auth & Backup ──────────────────────────────────────────────────────

export type BackupStatus = 'idle' | 'backing-up' | 'restoring' | 'error' | 'success';

export interface BackupMetadata {
  timestamp: string;
  version: number;
  bookCount: number;
  totalSize: number;
  userEmail: string;
}

export interface BackupState {
  status: BackupStatus;
  lastBackupTime: Date | null;
  lastBackupError: string | null;
  isOneDriveConnected: boolean;
}

// ── Wish List ──────────────────────────────────────────────────────────

export type WishlistItemType = 'bug' | 'feature' | 'idea';
export type WishlistItemStatus = 'open' | 'done';

export interface WishlistItem {
  id: string;
  title: string;
  description: string;
  type: WishlistItemType;
  status: WishlistItemStatus;
  createdAt: Date;
  updatedAt: Date;
}
