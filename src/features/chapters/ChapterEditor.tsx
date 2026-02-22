import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/db/database';
import { useChapters, createChapter, updateChapter } from '@/hooks/useChapters';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import type { Chapter, ChapterStatus } from '@/types';
import EditorToolbar from './EditorToolbar';
import ChapterListSidebar from './ChapterListSidebar';
import ChapterNotesSidebar from './ChapterNotesSidebar';
import WordCount from './WordCount';

const statusOptions: { value: ChapterStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'complete', label: 'Complete' },
];

const statusPillColors: Record<ChapterStatus, { active: string; inactive: string }> = {
  draft: {
    active: 'bg-secondary text-white',
    inactive: 'text-indigo/50 hover:bg-secondary/10',
  },
  'in-progress': {
    active: 'bg-warning text-white',
    inactive: 'text-indigo/50 hover:bg-warning/10',
  },
  complete: {
    active: 'bg-success text-white',
    inactive: 'text-indigo/50 hover:bg-success/10',
  },
};

type SaveState = 'idle' | 'saving' | 'saved';

export default function ChapterEditor() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const navigate = useNavigate();
  const { chapters } = useChapters(bookId);

  const [chapter, setChapter] = useState<Chapter | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ChapterStatus>('draft');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // Auto-collapse sidebars on smaller screens (iPad, etc.)
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 1024;
  const [leftOpen, setLeftOpen] = useState(!isSmallScreen);
  const [rightOpen, setRightOpen] = useState(!isSmallScreen);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch chapter from db on mount / chapterId change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    if (!chapterId) {
      setLoading(false);
      return;
    }
    db.chapters.get(chapterId).then((result) => {
      if (cancelled) return;
      setChapter(result);
      if (result) {
        setTitle(result.title);
        setNotes(result.notes);
        setStatus(result.status);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  // Show "Saved" indicator for 2 seconds then fade
  const flashSaved = useCallback(() => {
    setSaveState('saved');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaveState('idle'), 2000);
  }, []);

  // Debounced save for content
  const debouncedSaveContent = useDebouncedCallback(
    (html: string, words: number) => {
      if (!chapterId) return;
      setSaveState('saving');
      updateChapter(chapterId, { content: html, wordCount: words }).then(flashSaved);
    },
    1000,
  );

  // Debounced save for title
  const debouncedSaveTitle = useDebouncedCallback(
    (newTitle: string) => {
      if (!chapterId) return;
      setSaveState('saving');
      updateChapter(chapterId, { title: newTitle }).then(flashSaved);
    },
    1000,
  );

  // Debounced save for notes
  const debouncedSaveNotes = useDebouncedCallback(
    (newNotes: string) => {
      if (!chapterId) return;
      setSaveState('saving');
      updateChapter(chapterId, { notes: newNotes }).then(flashSaved);
    },
    1000,
  );

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing your story...' }),
      CharacterCount,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
    ],
    content: chapter?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] font-reader',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      const words = ed.storage.characterCount.words();
      debouncedSaveContent(html, words);
    },
  });

  // When chapter data loads, update editor content
  useEffect(() => {
    if (editor && chapter && !editor.isDestroyed) {
      // Only set content if it differs to avoid cursor jumps
      if (editor.getHTML() !== chapter.content) {
        editor.commands.setContent(chapter.content || '');
      }
    }
  }, [editor, chapter]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    debouncedSaveTitle(newTitle);
  };

  const handleNotesChange = (newNotes: string) => {
    setNotes(newNotes);
    debouncedSaveNotes(newNotes);
  };

  const handleStatusChange = (newStatus: ChapterStatus) => {
    if (!chapterId) return;
    setStatus(newStatus);
    setSaveState('saving');
    updateChapter(chapterId, { status: newStatus }).then(flashSaved);
  };

  const handleNewChapter = async () => {
    if (!bookId) return;
    const nextNumber = chapters.length + 1;
    const id = await createChapter({
      bookId,
      title: `Chapter ${nextNumber}`,
      notes: '',
    });
    navigate(`/book/${bookId}/chapters/${id}`);
  };

  const wordCount = editor?.storage.characterCount.words() ?? 0;
  const charCount = editor?.storage.characterCount.characters() ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="flex items-center justify-center h-full text-indigo/50">
        Chapter not found.
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <AnimatePresence>
        {leftOpen && bookId && chapterId && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="shrink-0 overflow-hidden"
          >
            <ChapterListSidebar
              bookId={bookId}
              currentChapterId={chapterId}
              chapters={chapters}
              onNewChapter={handleNewChapter}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center panel */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Toolbar row */}
        <div className="flex items-center border-b border-primary/10 bg-surface">
          <button
            type="button"
            onClick={() => setLeftOpen((v) => !v)}
            className="p-2 text-indigo/40 hover:text-indigo transition-colors cursor-pointer"
            title={leftOpen ? 'Hide chapters' : 'Show chapters'}
          >
            {leftOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>

          <div className="flex-1">
            <EditorToolbar editor={editor} />
          </div>

          <button
            type="button"
            onClick={() => setRightOpen((v) => !v)}
            className="p-2 text-indigo/40 hover:text-indigo transition-colors cursor-pointer"
            title={rightOpen ? 'Hide notes' : 'Show notes'}
          >
            {rightOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </div>

        {/* Editor area */}
        <div className="flex-1 overflow-y-auto bg-cream">
          <div className="max-w-3xl mx-auto bg-surface py-6 px-4 sm:px-6 lg:px-12 min-h-screen shadow-sm">
            {/* Chapter title */}
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Chapter Title..."
              className="
                w-full bg-transparent border-none
                font-heading text-3xl text-indigo
                focus:outline-none
                placeholder:text-indigo/30
                mb-6
              "
            />

            {/* TipTap editor */}
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="sticky bottom-0 flex items-center justify-between px-6 py-2 bg-surface/90 backdrop-blur border-t border-primary/10">
          {/* Left: word count */}
          <WordCount words={wordCount} characters={charCount} />

          {/* Center: status pills */}
          <div className="flex items-center gap-1">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleStatusChange(opt.value)}
                className={`
                  px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-150 cursor-pointer
                  ${status === opt.value
                    ? statusPillColors[opt.value].active
                    : statusPillColors[opt.value].inactive
                  }
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Right: save indicator */}
          <div className="min-w-[60px] text-right">
            <AnimatePresence mode="wait">
              {saveState === 'saving' && (
                <motion.span
                  key="saving"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-indigo/40"
                >
                  Saving...
                </motion.span>
              )}
              {saveState === 'saved' && (
                <motion.span
                  key="saved"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-success"
                >
                  Saved
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <AnimatePresence>
        {rightOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="shrink-0 overflow-hidden"
          >
            <ChapterNotesSidebar notes={notes} onChange={handleNotesChange} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
