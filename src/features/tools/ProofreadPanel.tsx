import { useState, useCallback, type RefObject } from 'react';
import { SpellCheck, MapPin, Sparkles, RefreshCw, Check } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { proofreadText, type ProofreadIssue, type ProofreadResult } from '@/api/ai';
import type { ChapterContext } from '@/components/layout/WritingToolsContext';

// ---------------------------------------------------------------------------
// Helpers: find text in TipTap document & apply fix
// ---------------------------------------------------------------------------

/**
 * Find the ProseMirror {from, to} positions of an exact text substring.
 * Walks the doc tree to map plain-text offsets to PM positions.
 */
function findTextInDoc(editor: Editor, needle: string): { from: number; to: number } | null {
  const doc = editor.state.doc;
  const fullText = doc.textBetween(0, doc.content.size, '\n', '\0');
  const idx = fullText.indexOf(needle);
  if (idx === -1) return null;

  // Map plain-text offset → PM position
  let textOffset = 0;
  let from = -1;
  let to = -1;

  doc.descendants((node, pos) => {
    if (from >= 0 && to >= 0) return false; // already found
    if (node.isText) {
      const nodeText = node.text || '';
      const endOffset = textOffset + nodeText.length;

      // Check if needle start falls within this text node
      if (from < 0 && idx >= textOffset && idx < endOffset) {
        from = pos + (idx - textOffset);
      }
      // Check if needle end falls within this (or a later) text node
      if (from >= 0 && to < 0 && idx + needle.length <= endOffset) {
        to = pos + (idx + needle.length - textOffset);
      }

      textOffset = endOffset;
    } else if (node.isBlock && textOffset > 0) {
      // Block boundaries insert a newline in textBetween
      textOffset += 1;
    }
  });

  if (from >= 0 && to >= 0) return { from, to };
  return null;
}

function applyFix(editor: Editor, originalText: string, suggestion: string): boolean {
  const pos = findTextInDoc(editor, originalText);
  if (!pos) return false;
  editor.chain().setTextSelection(pos).insertContent(suggestion).run();
  return true;
}

// ---------------------------------------------------------------------------
// Type badge colors
// ---------------------------------------------------------------------------

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  grammar: { bg: 'bg-primary/10', text: 'text-primary', label: 'Grammar' },
  spelling: { bg: 'bg-secondary/10', text: 'text-secondary', label: 'Spelling' },
  punctuation: { bg: 'bg-warning/10', text: 'text-warning', label: 'Punctuation' },
  style: { bg: 'bg-accent/10', text: 'text-accent', label: 'Style' },
};

// ---------------------------------------------------------------------------
// IssueCard sub-component
// ---------------------------------------------------------------------------

function IssueCard({
  issue,
  editor,
  onFixed,
  onJump,
}: {
  issue: ProofreadIssue;
  editor: Editor | null;
  onFixed: (text: string) => void;
  onJump: () => void;
}) {
  const [fixed, setFixed] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const style = TYPE_STYLES[issue.type] || TYPE_STYLES.grammar;

  const handleJump = () => {
    if (!editor) return;
    // Verify text exists before closing panel
    const pos = findTextInDoc(editor, issue.text);
    if (!pos) {
      setNotFound(true);
      return;
    }
    // Close the panel first so the editor is visible
    onJump();
    // After panel close animation, focus editor and select+scroll to text
    setTimeout(() => {
      editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
    }, 350);
  };

  const handleFix = () => {
    if (!editor) return;
    const success = applyFix(editor, issue.text, issue.suggestion);
    if (success) {
      setFixed(true);
      onFixed(issue.text);
    } else {
      setNotFound(true);
    }
  };

  if (fixed) {
    return (
      <div className="rounded-xl bg-success/5 border border-success/15 p-3 flex items-center gap-2">
        <Check size={14} className="text-success shrink-0" />
        <span className="text-sm text-success/70">Fixed!</span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-primary/10 p-3 space-y-2 ${notFound ? 'opacity-50' : ''}`}>
      {/* Type badge */}
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.bg} ${style.text}`}>
        {style.label}
      </span>

      {/* Original → Suggestion */}
      <div className="text-sm leading-relaxed">
        <span className="line-through text-indigo/40">&ldquo;{issue.text}&rdquo;</span>
        <span className="mx-1.5 text-indigo/20">→</span>
        <span className="text-success font-medium">&ldquo;{issue.suggestion}&rdquo;</span>
      </div>

      {/* Explanation */}
      <p className="text-xs text-indigo/50 leading-relaxed">{issue.explanation}</p>

      {/* Actions */}
      {notFound ? (
        <p className="text-xs text-indigo/30 italic">Text was changed — can&apos;t locate this anymore.</p>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleJump}
            disabled={!editor}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo/50 hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <MapPin size={12} />
            Jump to
          </button>
          <button
            type="button"
            onClick={handleFix}
            disabled={!editor}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-success/70 hover:text-success hover:bg-success/5 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Sparkles size={12} />
            Fix
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProofreadPanel
// ---------------------------------------------------------------------------

interface ProofreadPanelProps {
  chapterContext: ChapterContext | null;
  editorRef: RefObject<Editor | null>;
  onClose: () => void;
}

export default function ProofreadPanel({ chapterContext, editorRef, onClose }: ProofreadPanelProps) {
  const [result, setResult] = useState<ProofreadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [contentHash, setContentHash] = useState('');
  const [stale, setStale] = useState(false);

  // Simple hash to detect content changes after proofreading
  const getCurrentHash = useCallback(() => {
    const content = editorRef.current?.getHTML() || chapterContext?.content || '';
    return String(content.length) + ':' + content.slice(0, 100);
  }, [editorRef, chapterContext]);

  const handleProofread = useCallback(async () => {
    const content = editorRef.current?.getHTML() || chapterContext?.content;
    if (!content) {
      setError('No chapter content to proofread.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setStale(false);

    try {
      const data = await proofreadText(content, chapterContext?.title);
      setResult(data);
      setContentHash(getCurrentHash());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to proofread. Try again?');
    } finally {
      setLoading(false);
    }
  }, [chapterContext, editorRef, getCurrentHash]);

  // Mark results as stale when editor content changes
  const checkStale = useCallback(() => {
    if (!contentHash || !result) return;
    if (getCurrentHash() !== contentHash) {
      setStale(true);
    }
  }, [contentHash, result, getCurrentHash]);

  // Track when an issue is fixed (content changed)
  const handleFixed = useCallback(() => {
    // After a fix, content has changed — update hash so other issues can still be found
    setContentHash(getCurrentHash());
  }, [getCurrentHash]);

  const editor = editorRef.current;

  return (
    <div className="flex flex-col gap-3" onClick={checkStale}>
      {/* Header */}
      <div className="flex items-center gap-2 text-primary">
        <SpellCheck size={18} />
        <h2 className="font-heading text-base">Proofread</h2>
      </div>

      {/* Action button */}
      {!loading && (
        <button
          type="button"
          onClick={handleProofread}
          disabled={!chapterContext?.content && !editorRef.current}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {result ? 'Re-check Chapter' : 'Check Chapter'}
        </button>
      )}

      {/* Stale banner */}
      {stale && result && !loading && (
        <button
          type="button"
          onClick={handleProofread}
          className="flex items-center gap-2 rounded-xl bg-warning/10 border border-warning/20 px-3 py-2 text-xs text-warning cursor-pointer hover:bg-warning/15 transition-colors"
        >
          <RefreshCw size={12} />
          Chapter has changed since last check — tap to re-check
        </button>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 animate-pulse">
            <div className="h-4 bg-primary/10 rounded w-3/4 mb-2" />
            <div className="h-3 bg-primary/10 rounded w-1/2" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-primary/10 p-3 animate-pulse space-y-2">
              <div className="h-3 bg-primary/10 rounded w-16" />
              <div className="h-4 bg-primary/10 rounded w-full" />
              <div className="h-3 bg-primary/10 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-secondary italic">{error}</p>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="rounded-xl bg-primary/5 border border-primary/10 p-3">
            <p className="text-sm text-indigo/70 leading-relaxed">{result.summary}</p>
            {result.issues.length > 0 && (
              <p className="text-xs text-indigo/40 mt-1.5">
                {result.issues.length} issue{result.issues.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>

          {/* Issue cards */}
          {result.issues.map((issue, i) => (
            <IssueCard
              key={`${issue.text}-${i}`}
              issue={issue}
              editor={editor}
              onFixed={handleFixed}
              onJump={onClose}
            />
          ))}

          {/* Empty state — no issues */}
          {result.issues.length === 0 && (
            <div className="text-center py-6">
              <p className="text-2xl mb-2">👻✨</p>
              <p className="text-sm text-indigo/40 italic">
                No issues found — your writing looks great!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Initial empty state */}
      {!result && !loading && !error && (
        <p className="text-sm text-indigo/30 italic">
          Click the button above to check your chapter for grammar, spelling, and punctuation.
        </p>
      )}
    </div>
  );
}
