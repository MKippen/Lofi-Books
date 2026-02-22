import { useState, useEffect, useRef } from 'react';
import { Search, BookA, Replace, Volume2 } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';

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
          className="w-full rounded-xl border border-primary/15 bg-surface pl-9 pr-4 py-2.5 text-sm text-indigo placeholder:text-indigo/30 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors"
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
        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Looking up...' : 'Search'}
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

function DictionaryPanel() {
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-primary">
        <BookA size={20} />
        <h2 className="font-heading text-lg">Dictionary</h2>
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
            <span className="font-heading text-xl text-indigo">{entry.word}</span>
            <PhoneticBadge phonetics={entry.phonetics} />
          </div>

          {entry.meanings.map((meaning, mi) => (
            <div key={mi} className="space-y-1.5">
              <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {meaning.partOfSpeech}
              </span>

              <ol className="list-decimal list-inside space-y-2 text-sm text-indigo/80">
                {meaning.definitions.slice(0, 5).map((def, di) => (
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
                  {meaning.synonyms.slice(0, 8).map((syn) => (
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-secondary">
        <Replace size={20} />
        <h2 className="font-heading text-lg">Thesaurus</h2>
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
        <div className="space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="font-heading text-xl text-indigo">{entries[0].word}</span>
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
// Main Page
// ---------------------------------------------------------------------------

export default function WritingToolsPage() {
  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Writing Tools" />

      <div className="flex-1 p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Dictionary */}
          <div className="rounded-2xl bg-surface border border-primary/10 shadow-sm p-5">
            <DictionaryPanel />
          </div>

          {/* Thesaurus */}
          <div className="rounded-2xl bg-surface border border-primary/10 shadow-sm p-5">
            <ThesaurusPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
