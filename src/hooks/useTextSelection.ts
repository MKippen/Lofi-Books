import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';

interface TextSelectionResult {
  selectedText: string;
  selectionRect: DOMRect | null;
  clearSelection: () => void;
}

/**
 * Detects text selection inside a container element.
 * Works in two modes:
 *  - TipTap mode (editor provided): reads selection from TipTap state
 *  - DOM mode (no editor): uses native window.getSelection()
 */
export function useTextSelection(
  containerRef: RefObject<HTMLElement | null>,
  tiptapEditor?: Editor | null,
): TextSelectionResult {
  const [selectedText, setSelectedText] = useState('');
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearSelection = useCallback(() => {
    setSelectedText('');
    setSelectionRect(null);
  }, []);

  // Read the current selection and update state
  const checkSelection = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (tiptapEditor) {
      // TipTap mode
      const { from, to, empty } = tiptapEditor.state.selection;
      if (empty || from === to) {
        clearSelection();
        return;
      }

      const text = tiptapEditor.state.doc.textBetween(from, to, ' ');
      if (!text.trim()) {
        clearSelection();
        return;
      }

      try {
        const startCoord = tiptapEditor.view.domAtPos(from);
        const endCoord = tiptapEditor.view.domAtPos(to);
        const range = document.createRange();
        range.setStart(startCoord.node, startCoord.offset);
        range.setEnd(endCoord.node, endCoord.offset);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0) {
          setSelectedText(text.trim());
          setSelectionRect(rect);
        }
      } catch {
        clearSelection();
      }
    } else {
      // DOM mode
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        clearSelection();
        return;
      }

      // Make sure the selection is within our container
      if (!sel.anchorNode || !container.contains(sel.anchorNode)) {
        clearSelection();
        return;
      }

      const text = sel.toString().trim();
      if (!text) {
        clearSelection();
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0) {
        setSelectedText(text);
        setSelectionRect(rect);
      }
    }
  }, [containerRef, tiptapEditor, clearSelection]);

  // Debounced check to let the browser settle the selection
  const debouncedCheck = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(checkSelection, 100);
  }, [checkSelection]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseUp = () => debouncedCheck();
    const handleKeyUp = (e: KeyboardEvent) => {
      // Only check on shift+arrow (selection via keyboard)
      if (e.shiftKey) debouncedCheck();
    };

    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('keyup', handleKeyUp);

    // Also listen for selection changes globally (handles drag-select etc.)
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        // Only clear if we had a selection and it's now gone
        if (selectedText) clearSelection();
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);

    // Clear on Escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection();
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('keydown', handleEscape);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [containerRef, debouncedCheck, clearSelection, selectedText]);

  return { selectedText, selectionRect, clearSelection };
}
