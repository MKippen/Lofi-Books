import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { createCharacter, updateCharacter } from '@/hooks/useCharacters';
import { useImage, storeImage } from '@/hooks/useImageStore';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import TextArea from '@/components/ui/TextArea';
import Badge from '@/components/ui/Badge';
import ImageUploader from '@/components/ui/ImageUploader';
import type { Character, CharacterRelationship, SpecialAbility } from '@/types';
import { RELATIONSHIP_TYPE_CATEGORIES, RELATIONSHIP_TYPES, ABILITY_TYPE_CATEGORIES } from '@/types';

interface CharacterFormProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  character?: Character;
}

type CharacterRole = Character['role'];

const toTitleCase = (str: string): string =>
  str.replace(/\b\w/g, (char) => char.toUpperCase());

const roles: { value: CharacterRole; label: string; hint: string }[] = [
  { value: 'protagonist', label: 'Protagonist', hint: 'The main hero of your story' },
  { value: 'antagonist', label: 'Antagonist', hint: 'The villain or main obstacle' },
  { value: 'supporting', label: 'Supporting', hint: 'An important helper or side character' },
  { value: 'minor', label: 'Minor', hint: 'A small part, appears briefly' },
];

export default function CharacterForm({
  isOpen,
  onClose,
  bookId,
  character,
}: CharacterFormProps) {
  const isEditing = Boolean(character);

  const { url: existingImageUrl } = useImage(character?.mainImageId ?? null);

  // Form state
  const [name, setName] = useState('');
  const [role, setRole] = useState<CharacterRole>('supporting');
  const [backstory, setBackstory] = useState('');
  const [development, setDevelopment] = useState('');
  const [personalityTraits, setPersonalityTraits] = useState<string[]>([]);
  const [traitInput, setTraitInput] = useState('');
  const [relationships, setRelationships] = useState<CharacterRelationship[]>([]);
  const [specialAbilities, setSpecialAbilities] = useState<SpecialAbility[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [otherRelTypes, setOtherRelTypes] = useState<Record<number, boolean>>({});

  // Initialize form when opening for editing
  useEffect(() => {
    if (isOpen && character) {
      setName(character.name);
      setRole(character.role);
      setBackstory(character.backstory || '');
      setDevelopment(character.development || '');
      setPersonalityTraits([...(character.personalityTraits || [])]);
      setRelationships(
        (character.relationships || []).map((r) => ({ ...r }))
      );
      setSpecialAbilities(
        (character.specialAbilities || []).map((a) => ({ ...a }))
      );
      // Detect custom relationship types for "Other" mode
      const otherMap: Record<number, boolean> = {};
      (character.relationships || []).forEach((r, i) => {
        if (r.relationshipType && !RELATIONSHIP_TYPES.includes(r.relationshipType)) {
          otherMap[i] = true;
        }
      });
      setOtherRelTypes(otherMap);
      setImageFile(null);
      setImagePreview(null);
    } else if (isOpen && !character) {
      resetForm();
    }
  }, [isOpen, character]);

  const resetForm = () => {
    setName('');
    setRole('supporting');
    setBackstory('');
    setDevelopment('');
    setPersonalityTraits([]);
    setTraitInput('');
    setRelationships([]);
    setOtherRelTypes({});
    setSpecialAbilities([]);
    setCustomAbilityName('');
    setCustomAbilityDesc('');
    setImageFile(null);
    setImagePreview(null);
  };

  // Image handling
  const handleImageSelected = (file: File) => {
    setImageFile(file);
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
  };

  // Personality traits
  const addTrait = () => {
    const trimmed = traitInput.trim();
    if (trimmed && !personalityTraits.includes(trimmed)) {
      setPersonalityTraits([...personalityTraits, trimmed]);
      setTraitInput('');
    }
  };

  const removeTrait = (trait: string) => {
    setPersonalityTraits(personalityTraits.filter((t) => t !== trait));
  };

  const handleTraitKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTrait();
    }
  };

  // Relationships
  const addRelationship = () => {
    setRelationships([...relationships, { characterName: '', relationshipType: '' }]);
  };

  const updateRelationship = (
    index: number,
    field: keyof CharacterRelationship,
    value: string
  ) => {
    const updated = [...relationships];
    updated[index] = { ...updated[index], [field]: value };
    setRelationships(updated);
  };

  const removeRelationship = (index: number) => {
    setRelationships(relationships.filter((_, i) => i !== index));
    const newOtherMap: Record<number, boolean> = {};
    Object.entries(otherRelTypes).forEach(([key, val]) => {
      const k = Number(key);
      if (k < index) newOtherMap[k] = val;
      else if (k > index) newOtherMap[k - 1] = val;
    });
    setOtherRelTypes(newOtherMap);
  };

  // Special abilities
  const [customAbilityName, setCustomAbilityName] = useState('');
  const [customAbilityDesc, setCustomAbilityDesc] = useState('');

  const addPresetAbility = (ability: SpecialAbility) => {
    if (!specialAbilities.some((a) => a.name === ability.name)) {
      setSpecialAbilities([...specialAbilities, { ...ability }]);
    }
  };

  const addCustomAbility = () => {
    const trimmedName = customAbilityName.trim();
    if (!trimmedName) return;
    setSpecialAbilities([
      ...specialAbilities,
      { name: trimmedName, description: customAbilityDesc.trim() },
    ]);
    setCustomAbilityName('');
    setCustomAbilityDesc('');
  };

  const removeAbility = (index: number) => {
    setSpecialAbilities(specialAbilities.filter((_, i) => i !== index));
  };

  // Save
  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    try {
      let mainImageId = character?.mainImageId ?? null;

      // Upload new image if selected
      if (imageFile) {
        mainImageId = await storeImage(bookId, imageFile);
      }

      // Filter out empty relationships and abilities
      const filteredRelationships = relationships.filter(
        (r) => r.characterName.trim() || r.relationshipType.trim()
      );
      const filteredAbilities = specialAbilities.filter(
        (a) => a.name.trim() || a.description.trim()
      );

      if (isEditing && character) {
        await updateCharacter(character.id, {
          name: name.trim(),
          role,
          backstory,
          development,
          personalityTraits,
          relationships: filteredRelationships,
          specialAbilities: filteredAbilities,
          mainImageId,
        });
      } else {
        await createCharacter({
          bookId,
          name: name.trim(),
          role,
          backstory,
          development,
          personalityTraits,
          relationships: filteredRelationships,
          specialAbilities: filteredAbilities,
          mainImageId,
        });
      }

      onClose();
    } catch (error) {
      console.error('Failed to save character:', error);
    } finally {
      setSaving(false);
    }
  };

  // Determine the displayed image URL
  const displayImageUrl = imagePreview || existingImageUrl || null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Character' : 'Create Character'}
      size="lg"
    >
      <div className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto pr-1">
        {/* Character portrait */}
        <ImageUploader
          imageUrl={displayImageUrl}
          onImageSelected={handleImageSelected}
        />

        {/* Character name */}
        <Input
          label="Character Name"
          value={name}
          onChange={(val) => setName(toTitleCase(val))}
          placeholder="Enter character name..."
          required
        />

        {/* Role selector */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-sm text-indigo/70">Role</label>
          <p className="text-xs text-indigo/40">What part does this character play in your story? Hover for hints!</p>
          <div className="flex items-center gap-2 flex-wrap">
            {roles.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                title={r.hint}
                className={`
                  px-4 py-2 rounded-full text-sm font-semibold
                  transition-all duration-200 cursor-pointer
                  ${
                    role === r.value
                      ? 'bg-primary text-white shadow-md shadow-primary/30'
                      : 'bg-indigo/5 text-indigo/60 hover:bg-indigo/10'
                  }
                `}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-secondary/70 italic">
            {roles.find((r) => r.value === role)?.hint}
          </p>
        </div>

        {/* Personality Traits */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-sm text-indigo/70">
            Personality Traits
          </label>
          <p className="text-xs text-indigo/40">Words that describe who they are -- like "brave", "shy", or "funny". Press Enter to add each one!</p>
          {personalityTraits.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {personalityTraits.map((trait) => (
                <Badge key={trait} variant="primary" size="md">
                  {trait}
                  <button
                    type="button"
                    onClick={() => removeTrait(trait)}
                    className="ml-1 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={traitInput}
              onChange={(e) => setTraitInput(e.target.value)}
              onKeyDown={handleTraitKeyDown}
              placeholder="Add a trait..."
              className="flex-1 rounded-xl border-2 border-secondary/20 px-4 py-2.5 bg-surface text-indigo placeholder:text-indigo/30 focus:border-primary focus:outline-none transition-colors duration-200"
            />
            <Button variant="ghost" size="sm" onClick={addTrait}>
              <Plus size={16} />
              Add
            </Button>
          </div>
        </div>

        {/* Relationships */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-sm text-indigo/70">
            Relationships
          </label>
          <p className="text-xs text-indigo/40">How does this character know other characters? Add their name and pick how they're connected.</p>
          {relationships.length > 0 && (
            <div className="flex flex-col gap-2 mb-2">
              {relationships.map((rel, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={rel.characterName}
                    onChange={(e) =>
                      updateRelationship(index, 'characterName', toTitleCase(e.target.value))
                    }
                    placeholder="Character name..."
                    className="flex-1 rounded-xl border-2 border-secondary/20 px-3 py-2 bg-surface text-indigo text-sm placeholder:text-indigo/30 focus:border-primary focus:outline-none transition-colors duration-200"
                  />
                  <div className="flex-1 flex gap-2">
                    <select
                      value={
                        otherRelTypes[index]
                          ? '__other__'
                          : RELATIONSHIP_TYPES.includes(rel.relationshipType)
                            ? rel.relationshipType
                            : rel.relationshipType
                              ? '__other__'
                              : ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__other__') {
                          setOtherRelTypes({ ...otherRelTypes, [index]: true });
                          updateRelationship(index, 'relationshipType', '');
                        } else {
                          setOtherRelTypes({ ...otherRelTypes, [index]: false });
                          updateRelationship(index, 'relationshipType', val);
                        }
                      }}
                      className="flex-1 min-w-0 rounded-xl border-2 border-secondary/20 px-3 py-2 bg-surface text-indigo text-sm focus:border-primary focus:outline-none transition-colors duration-200 cursor-pointer"
                    >
                      <option value="" disabled>
                        Select type...
                      </option>
                      {RELATIONSHIP_TYPE_CATEGORIES.map((cat) => (
                        <optgroup key={cat.category} label={cat.category}>
                          {cat.types.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                      <optgroup label="Custom">
                        <option value="__other__">Other...</option>
                      </optgroup>
                    </select>
                    {otherRelTypes[index] && (
                      <input
                        type="text"
                        value={rel.relationshipType}
                        onChange={(e) =>
                          updateRelationship(index, 'relationshipType', e.target.value)
                        }
                        placeholder="Custom type..."
                        className="flex-1 min-w-0 rounded-xl border-2 border-secondary/20 px-3 py-2 bg-surface text-indigo text-sm placeholder:text-indigo/30 focus:border-primary focus:outline-none transition-colors duration-200"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRelationship(index)}
                    className="p-1.5 rounded-lg text-indigo/30 hover:text-red-400 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={addRelationship} className="self-start">
            <Plus size={16} />
            Add Relationship
          </Button>
        </div>

        {/* Special Abilities */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-sm text-indigo/70">
            Special Abilities
          </label>
          <p className="text-xs text-indigo/40">Click abilities to add them, or write your own at the bottom!</p>

          {/* Added abilities */}
          {specialAbilities.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {specialAbilities.map((ability, index) => (
                <Badge key={`${ability.name}-${index}`} variant="accent" size="md">
                  <span title={ability.description}>{ability.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAbility(index)}
                    className="ml-1 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Preset ability categories */}
          <div className="flex flex-col gap-3 rounded-xl border-2 border-secondary/10 bg-secondary/5 p-3">
            {ABILITY_TYPE_CATEGORIES.map((cat) => (
              <div key={cat.category} className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary/70 uppercase tracking-wider">
                  {cat.category}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {cat.abilities.map((ability) => {
                    const isAdded = specialAbilities.some((a) => a.name === ability.name);
                    return (
                      <button
                        key={ability.name}
                        type="button"
                        onClick={() => !isAdded && addPresetAbility(ability)}
                        title={ability.description}
                        disabled={isAdded}
                        className={`
                          px-3 py-1.5 rounded-full text-xs font-medium
                          transition-all duration-150 cursor-pointer
                          ${
                            isAdded
                              ? 'bg-accent/20 text-accent line-through opacity-60 cursor-default'
                              : 'bg-surface text-indigo/70 border border-secondary/20 hover:border-primary hover:text-primary hover:shadow-sm'
                          }
                        `}
                      >
                        {ability.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Custom ability input */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-secondary/15">
              <span className="text-xs font-semibold text-secondary/70 uppercase tracking-wider">
                Write Your Own
              </span>
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={customAbilityName}
                    onChange={(e) => setCustomAbilityName(e.target.value)}
                    placeholder="Ability name..."
                    className="w-full rounded-xl border-2 border-secondary/20 px-3 py-2 bg-surface text-indigo text-sm placeholder:text-indigo/30 focus:border-primary focus:outline-none transition-colors duration-200"
                  />
                  <input
                    type="text"
                    value={customAbilityDesc}
                    onChange={(e) => setCustomAbilityDesc(e.target.value)}
                    placeholder="What does it do? (optional)"
                    className="w-full rounded-xl border-2 border-secondary/20 px-3 py-2 bg-surface text-indigo text-sm placeholder:text-indigo/30 focus:border-primary focus:outline-none transition-colors duration-200"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomAbility();
                      }
                    }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addCustomAbility}
                  disabled={!customAbilityName.trim()}
                  className="self-end"
                >
                  <Plus size={16} />
                  Add
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Backstory */}
        <div className="flex flex-col gap-1">
          <TextArea
            label="Backstory"
            value={backstory}
            onChange={setBackstory}
            placeholder="Write your character's backstory..."
            rows={5}
          />
          <p className="text-xs text-indigo/40">What happened to this character before your story begins? Where did they come from?</p>
        </div>

        {/* Character Development */}
        <div className="flex flex-col gap-1">
          <TextArea
            label="Character Development"
            value={development}
            onChange={setDevelopment}
            placeholder="Describe how this character grows throughout the story..."
            rows={4}
          />
          <p className="text-xs text-indigo/40">How does this character change during the story? Do they learn something or become different?</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-primary/10">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={!name.trim() || saving}
        >
          {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Character'}
        </Button>
      </div>
    </Modal>
  );
}
