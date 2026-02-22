import { useState, useRef, useEffect, useCallback, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Ghost, X, Send } from 'lucide-react';
import { streamChat } from '@/api/ai';
import type { Editor } from '@tiptap/react';
import type { ChapterContext } from '@/components/layout/WritingToolsContext';
import { useTextSelection } from '@/hooks/useTextSelection';

const SELECTION_PROMPTS = [
  'Does this make sense?',
  "How's the flow here?",
  'Is this clear?',
  'Anything awkward?',
];

const MAX_SELECTED_CHARS = 500;

type PopoverState = 'idle' | 'showTrigger' | 'showPopover';

interface HanakoGhostPopoverProps {
  containerRef: RefObject<HTMLElement | null>;
  tiptapEditor?: Editor | null;
  chapterContext: ChapterContext | null;
}

export default function HanakoGhostPopover({
  containerRef,
  tiptapEditor,
  chapterContext,
}: HanakoGhostPopoverProps) {
  const { selectedText, selectionRect, clearSelection } = useTextSelection(containerRef, tiptapEditor);
  const [state, setState] = useState<PopoverState>('idle');
  const [response, setResponse] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  // "Locked" copies of text & rect — frozen when the popover opens so that
  // losing the browser selection (e.g. clicking the input) doesn't kill the UI.
  const lockedTextRef = useRef('');
  const lockedRectRef = useRef<DOMRect | null>(null);

  // Transition: selection detected -> show ghost trigger
  useEffect(() => {
    if (selectedText && selectionRect && state === 'idle') {
      setState('showTrigger');
    } else if (!selectedText && state === 'showTrigger') {
      setState('idle');
    }
    // Keep locked values up-to-date while still in trigger mode
    if (selectedText && selectionRect && (state === 'idle' || state === 'showTrigger')) {
      lockedTextRef.current = selectedText;
      lockedRectRef.current = selectionRect;
    }
  }, [selectedText, selectionRect, state]);

  // Close popover on outside click
  useEffect(() => {
    if (state !== 'showPopover') return;
    function handleMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        handleClose();
      }
    }
    // Delay adding listener to avoid immediately closing from the ghost button click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [state]);

  // Close on Escape
  useEffect(() => {
    if (state !== 'showPopover') return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
    }
    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [state]);

  // Auto-scroll response area
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  const handleClose = useCallback(() => {
    setState('idle');
    setResponse('');
    setInput('');
    setStreaming(false);
    clearSelection();
  }, [clearSelection]);

  const askHanako = useCallback(async (question: string) => {
    if (!question.trim() || streaming) return;

    // Use locked text — the live selectedText may be empty if focus moved to input
    const text = lockedTextRef.current;
    if (!text) return;

    const truncatedSelection = text.length > MAX_SELECTED_CHARS
      ? text.slice(0, MAX_SELECTED_CHARS) + '...'
      : text;

    const messageContent = `Here's a passage from my writing:\n\n"${truncatedSelection}"\n\n${question}`;

    setResponse('');
    setStreaming(true);
    setInput('');

    try {
      const messages = [{ role: 'user' as const, content: messageContent }];
      const stream = streamChat(messages, chapterContext);

      for await (const chunk of stream) {
        setResponse((prev) => prev + chunk);
      }
    } catch (err) {
      console.error('Hanako popover error:', err);
      setResponse('Hmm, something went wrong with the ghostly connection~ Try again?');
    } finally {
      setStreaming(false);
    }
  }, [chapterContext, streaming]);

  // Use locked values when popover is open (browser selection may be gone)
  const activeRect = state === 'showPopover' ? lockedRectRef.current : selectionRect;
  const activeText = state === 'showPopover' ? lockedTextRef.current : selectedText;

  if (!activeRect || state === 'idle') return null;

  // Position calculations
  const triggerTop = activeRect.top + window.scrollY - 40;
  const triggerLeft = activeRect.left + window.scrollX + activeRect.width / 2 - 16;
  const clampedTriggerLeft = Math.max(8, Math.min(triggerLeft, window.innerWidth - 40));
  const clampedTriggerTop = Math.max(8, triggerTop);

  const popoverTop = activeRect.bottom + window.scrollY + 8;
  const popoverLeft = activeRect.left + window.scrollX + activeRect.width / 2 - 150;
  const clampedPopoverLeft = Math.max(8, Math.min(popoverLeft, window.innerWidth - 308));

  const truncatedPreview = activeText.length > 80
    ? activeText.slice(0, 80) + '...'
    : activeText;

  return createPortal(
    <AnimatePresence>
      {state === 'showTrigger' && (
        <motion.button
          key="ghost-trigger"
          type="button"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'backOut' }}
          onClick={() => setState('showPopover')}
          className="fixed z-[60] w-9 h-9 rounded-full bg-primary/90 text-white shadow-lg hover:bg-primary hover:scale-110 transition-all cursor-pointer flex items-center justify-center"
          style={{ top: clampedTriggerTop, left: clampedTriggerLeft }}
          title="Ask Hanako about this"
        >
          <Ghost size={18} />
        </motion.button>
      )}

      {state === 'showPopover' && (
        <motion.div
          key="ghost-popover"
          ref={popoverRef}
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed z-[65] w-[300px] rounded-2xl bg-surface border border-primary/15 shadow-2xl overflow-hidden"
          style={{ top: popoverTop, left: clampedPopoverLeft }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-primary/10">
            <div className="flex items-center gap-1.5">
              <Ghost size={14} className="text-primary" />
              <span className="font-heading text-sm text-indigo">Hanako</span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-6 h-6 flex items-center justify-center rounded-md text-indigo/30 hover:text-indigo hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* Selected text preview */}
          <div className="px-3.5 py-2 bg-cream/50 border-b border-primary/5">
            <p className="text-[11px] text-indigo/50 italic leading-relaxed truncate">
              &ldquo;{truncatedPreview}&rdquo;
            </p>
          </div>

          {/* Quick prompts */}
          {!response && !streaming && (
            <div className="px-3 py-2.5 flex flex-wrap gap-1.5">
              {SELECTION_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => askHanako(prompt)}
                  className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] text-primary/60 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Response area */}
          {(response || streaming) && (
            <div
              ref={responseRef}
              className="px-3.5 py-3 max-h-[200px] overflow-y-auto"
            >
              <div className="text-sm text-indigo/80 leading-relaxed">
                <span className="text-xs mr-1 opacity-50">👻</span>
                {response || (
                  <span className="inline-flex items-center gap-1 text-indigo/30 italic text-xs">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse [animation-delay:150ms]" />
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse [animation-delay:300ms]" />
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Custom input */}
          <div className="px-3 py-2 border-t border-primary/10 flex gap-1.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  askHanako(input);
                }
              }}
              placeholder="Ask about this..."
              disabled={streaming}
              className="flex-1 rounded-lg border border-primary/15 bg-cream px-2.5 py-1.5 text-xs text-indigo placeholder:text-indigo/30 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/10 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => askHanako(input)}
              disabled={!input.trim() || streaming}
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              <Send size={12} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
