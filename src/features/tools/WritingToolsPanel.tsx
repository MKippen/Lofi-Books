import { useState, useEffect, useRef, type RefObject } from 'react';
import { Search, BookA, Replace, Volume2, X, Wrench, Ghost, SpellCheck } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import AssistPanel from './AssistPanel';
import ProofreadPanel from './ProofreadPanel';
import type { ChapterContext, WritingToolsTab } from '@/components/layout/WritingToolsContext';

// ---------------------------------------------------------------------------
// Types for DictionaryAPI response
// ---------------------------------------------------------------------------

interface Phonetic {
  text?: string;
  audio?: string;
}

interface Definition {
  definition: string;
  example?: string;
  synonyms: string[];
  antonyms: string[];
}

interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
  synonyms: string[];
  antonyms: string[];
}

interface DictEntry {
  word: string;
  phonetics: Phonetic[];
  meanings: Meaning[];
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function lookupWord(word: string): Promise<DictEntry[]> {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`,
  );
  if (!res.ok) throw new Error('Word not found');
  return res.json();
}

async function fetchSuggestions(prefix: string): Promise<string[]> {
  if (prefix.length < 2) return [];
  const res = await fetch(
    `https://api.datamuse.com/sug?s=${encodeURIComponent(prefix)}&max=8`,
  );
  if (!res.ok) return [];
  const data: { word: string }[] = await res.json();
  return data.map((d) => d.word);
}

function useSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(query.trim());
      setSuggestions(results);
    }, 200);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const clear = () => setSuggestions([]);
  return { suggestions, clear };
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function SearchBox({
  value,
  onChange,
  onSearch,
  onSelect,
  placeholder,
  loading,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  onSelect: (word: string) => void;
  placeholder: string;
  loading: boolean;
  suggestions: string[];
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Reset active index when suggestions change
  useEffect(() => { setActiveIndex(-1); }, [suggestions]);

  const visibleSuggestions = showSuggestions && suggestions.length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setShowSuggestions(false);
        onSearch();
      }}
      className="flex gap-2"
    >
      <div className="relative flex-1" ref={wrapperRef}>
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo/30 z-10" />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (!visibleSuggestions) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && activeIndex >= 0) {
              e.preventDefault();
              setShowSuggestions(false);
              onSelect(suggestions[activeIndex]);
            } else if (e.key === 'Escape') {
              setShowSuggestions(false);
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-xl border border-primary/15 bg-cream pl-9 pr-4 py-2.5 text-sm text-indigo placeholder:text-indigo/30 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors"
          autoComplete="off"
        />
        {visibleSuggestions && (
          <ul className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl border border-primary/15 bg-surface shadow-lg overflow-hidden">
            {suggestions.map((word, i) => (
              <li key={word}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowSuggestions(false);
                    onSelect(word);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                    i === activeIndex
                      ? 'bg-primary/10 text-primary'
                      : 'text-indigo/70 hover:bg-primary/5'
                  }`}
                >
                  {word}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="submit"
        disabled={!value.trim() || loading}
        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? '...' : 'Go'}
      </button>
    </form>
  );
}

function PhoneticBadge({ phonetics }: { phonetics: Phonetic[] }) {
  const withAudio = phonetics.find((p) => p.audio);
  const withText = phonetics.find((p) => p.text);

  const playAudio = () => {
    if (withAudio?.audio) {
      new Audio(withAudio.audio).play();
    }
  };

  if (!withText?.text) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-indigo/50 font-reader italic">
      {withText.text}
      {withAudio?.audio && (
        <button
          type="button"
          onClick={playAudio}
          className="p-0.5 rounded hover:bg-primary/10 text-primary/60 hover:text-primary transition-colors cursor-pointer"
          title="Listen to pronunciation"
        >
          <Volume2 size={14} />
        </button>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dictionary Panel
// ---------------------------------------------------------------------------

export function DictionaryPanel() {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<DictEntry[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { suggestions, clear: clearSuggestions } = useSuggestions(query);

  const searchWord = async (word: string) => {
    if (!word.trim()) return;
    setQuery(word);
    clearSuggestions();
    setLoading(true);
    setError('');
    setEntries(null);
    try {
      const data = await lookupWord(word);
      setEntries(data);
    } catch {
      setError(`No definitions found for "${word.trim()}"`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => searchWord(query);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-primary">
        <BookA size={18} />
        <h2 className="font-heading text-base">Dictionary</h2>
      </div>

      <SearchBox
        value={query}
        onChange={setQuery}
        onSearch={handleSearch}
        onSelect={searchWord}
        placeholder="Look up a word..."
        loading={loading}
        suggestions={suggestions}
      />

      {error && (
        <p className="text-sm text-secondary italic">{error}</p>
      )}

      {entries && entries.map((entry, i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-baseline gap-3">
            <span className="font-heading text-lg text-indigo">{entry.word}</span>
            <PhoneticBadge phonetics={entry.phonetics} />
          </div>

          {entry.meanings.map((meaning, mi) => (
            <div key={mi} className="space-y-1.5">
              <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {meaning.partOfSpeech}
              </span>

              <ol className="list-decimal list-inside space-y-2 text-sm text-indigo/80">
                {meaning.definitions.slice(0, 4).map((def, di) => (
                  <li key={di} className="leading-relaxed">
                    {def.definition}
                    {def.example && (
                      <p className="ml-5 mt-0.5 text-indigo/45 italic font-reader">
                        &ldquo;{def.example}&rdquo;
                      </p>
                    )}
                  </li>
                ))}
              </ol>

              {meaning.synonyms.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="text-[10px] uppercase tracking-wider text-indigo/30 font-semibold">Syn:</span>
                  {meaning.synonyms.slice(0, 6).map((syn) => (
                    <button
                      key={syn}
                      type="button"
                      onClick={() => searchWord(syn)}
                      className="rounded-full border border-primary/15 px-2 py-0.5 text-xs text-primary/70 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                    >
                      {syn}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {!entries && !error && !loading && (
        <p className="text-sm text-indigo/30 italic">Type a word and hit search to see its definition.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thesaurus Panel
// ---------------------------------------------------------------------------

function ThesaurusPanel() {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<DictEntry[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { suggestions, clear: clearSuggestions } = useSuggestions(query);

  const searchWord = async (word: string) => {
    if (!word.trim()) return;
    setQuery(word);
    clearSuggestions();
    setLoading(true);
    setError('');
    setEntries(null);
    try {
      const data = await lookupWord(word);
      setEntries(data);
    } catch {
      setError(`No results found for "${word.trim()}"`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => searchWord(query);

  // Collect all synonyms and antonyms
  const allSynonyms: string[] = [];
  const allAntonyms: string[] = [];
  if (entries) {
    for (const entry of entries) {
      for (const m of entry.meanings) {
        allSynonyms.push(...m.synonyms);
        for (const d of m.definitions) {
          allSynonyms.push(...d.synonyms);
          allAntonyms.push(...d.antonyms);
        }
        allAntonyms.push(...m.antonyms);
      }
    }
  }
  const uniqueSynonyms = [...new Set(allSynonyms)];
  const uniqueAntonyms = [...new Set(allAntonyms)];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-secondary">
        <Replace size={18} />
        <h2 className="font-heading text-base">Thesaurus</h2>
      </div>

      <SearchBox
        value={query}
        onChange={setQuery}
        onSearch={handleSearch}
        onSelect={searchWord}
        placeholder="Find synonyms & antonyms..."
        loading={loading}
        suggestions={suggestions}
      />

      {error && (
        <p className="text-sm text-secondary italic">{error}</p>
      )}

      {entries && (
        <div className="space-y-3">
          <div className="flex items-baseline gap-3">
            <span className="font-heading text-lg text-indigo">{entries[0].word}</span>
            <PhoneticBadge phonetics={entries[0].phonetics} />
          </div>

          {/* Per-meaning synonyms and antonyms */}
          {entries.map((entry) =>
            entry.meanings.map((meaning, mi) => {
              const mSyns = [
                ...meaning.synonyms,
                ...meaning.definitions.flatMap((d) => d.synonyms),
              ];
              const mAnts = [
                ...meaning.antonyms,
                ...meaning.definitions.flatMap((d) => d.antonyms),
              ];
              const uSyns = [...new Set(mSyns)];
              const uAnts = [...new Set(mAnts)];

              if (uSyns.length === 0 && uAnts.length === 0) return null;

              return (
                <div key={`${entry.word}-${mi}`} className="space-y-2">
                  <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {meaning.partOfSpeech}
                  </span>

                  {uSyns.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-indigo/30 font-semibold mb-1.5">Synonyms</p>
                      <div className="flex flex-wrap gap-1.5">
                        {uSyns.map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => searchWord(w)}
                            className="rounded-full border border-success/20 bg-success/5 px-2.5 py-1 text-xs text-success hover:bg-success/15 transition-colors cursor-pointer"
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {uAnts.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-indigo/30 font-semibold mb-1.5">Antonyms</p>
                      <div className="flex flex-wrap gap-1.5">
                        {uAnts.map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => searchWord(w)}
                            className="rounded-full border border-secondary/20 bg-secondary/5 px-2.5 py-1 text-xs text-secondary hover:bg-secondary/15 transition-colors cursor-pointer"
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }),
          )}

          {uniqueSynonyms.length === 0 && uniqueAntonyms.length === 0 && (
            <p className="text-sm text-indigo/40 italic">
              No synonyms or antonyms found for this word.
            </p>
          )}
        </div>
      )}

      {!entries && !error && !loading && (
        <p className="text-sm text-indigo/30 italic">Search for a word to find synonyms and antonyms.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide-out Panel
// ---------------------------------------------------------------------------

type ToolTab = WritingToolsTab;

const TABS: { id: ToolTab; label: string; icon: typeof BookA }[] = [
  { id: 'dictionary', label: 'Dictionary', icon: BookA },
  { id: 'thesaurus', label: 'Thesaurus', icon: Replace },
  { id: 'proofread', label: 'Proofread', icon: SpellCheck },
  { id: 'hanako', label: 'Hanako', icon: Ghost },
];

interface WritingToolsPanelProps {
  open: boolean;
  onClose: () => void;
  chapterContext?: ChapterContext | null;
  initialTab?: ToolTab;
  editorRef?: RefObject<Editor | null>;
}

export default function WritingToolsPanel({ open, onClose, chapterContext, initialTab, editorRef }: WritingToolsPanelProps) {
  const [activeTab, setActiveTab] = useState<ToolTab>('hanako');

  // Switch to requested tab when panel opens with an initialTab
  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 z-[70] bg-black/20 backdrop-blur-sm
          transition-opacity duration-300
          ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full z-[75]
          w-[420px] max-w-[90vw]
          bg-surface shadow-2xl border-l border-primary/10
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-primary/10 bg-surface shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Wrench size={16} className="text-primary" />
            </div>
            <h2 className="font-heading text-lg text-indigo">Writing Tools</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-indigo/40 hover:text-indigo hover:bg-primary/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-primary/10 bg-surface shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-indigo/40 hover:text-indigo/60'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content — dictionary & thesaurus (mount on demand) */}
        <div className={`flex-1 overflow-y-auto min-h-0 p-5 ${activeTab === 'dictionary' || activeTab === 'thesaurus' ? '' : 'hidden'}`}>
          {activeTab === 'dictionary' && (
            <div className="rounded-2xl bg-cream border border-primary/10 p-4">
              <DictionaryPanel />
            </div>
          )}

          {activeTab === 'thesaurus' && (
            <div className="rounded-2xl bg-cream border border-primary/10 p-4">
              <ThesaurusPanel />
            </div>
          )}
        </div>

        {/* Proofread panel — always mounted to preserve results */}
        {editorRef && (
          <div className={`flex-1 overflow-y-auto min-h-0 p-5 ${activeTab === 'proofread' ? '' : 'hidden'}`}>
            <div className="rounded-2xl bg-cream border border-primary/10 p-4">
              <ProofreadPanel
                chapterContext={chapterContext ?? null}
                editorRef={editorRef}
                onClose={onClose}
              />
            </div>
          </div>
        )}

        {/* Hanako panel — always mounted to preserve session */}
        <div className={`flex-1 min-h-0 p-5 ${activeTab === 'hanako' ? 'flex flex-col' : 'hidden'}`}>
          <AssistPanel chapterContext={chapterContext ?? null} />
        </div>
      </div>
    </>
  );
}
