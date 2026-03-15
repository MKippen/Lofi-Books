import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import type { Character } from '@/types';
import type { ChapterContext } from '@/components/layout/WritingToolsContext';
import { useImage } from '@/hooks/useImageStore';
import HanakoGhostPopover from '@/features/hanako/HanakoGhostPopover';
import { logClientTelemetry } from '@/api/telemetry';

const IMG_BASE = import.meta.env.BASE_URL.replace(/\/$/, '') + '/api';
const READ_HIGHLIGHT_KEY = 'reader-read-aloud-word';

/** Extract a data-attribute value from a tag string (order-independent). */
function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

/**
 * Replace <illustration-embed> custom elements with styled illustration cards.
 */
function renderIllustrations(html: string): string {
  return html.replace(
    /<illustration-embed[^>]*?>(?:<\/illustration-embed>)?/g,
    (tag) => {
      const imageId = attr(tag, 'data-image-id');
      if (!imageId) return '';
      const rawCaption = attr(tag, 'data-caption') || '';
      const h = parseInt(attr(tag, 'data-height') || '200', 10);
      const fy = parseInt(attr(tag, 'data-focal-y') || '50', 10);
      const decodedCaption = rawCaption
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
      // max-height prevents illustration from exceeding the column height
      return `<div class="illustration-reader-card" style="height:${h}px;max-height:calc(100% - 2rem)">
        <img src="${IMG_BASE}/images/${imageId}" alt="${decodedCaption}" style="object-position:center ${fy}%" />
        ${decodedCaption ? `<div class="illustration-caption">${decodedCaption}</div>` : ''}
      </div>`;
    },
  );
}

/** Build chapter title as inline HTML. */
function buildChapterTitleHTML(title: string): string {
  return `<div class="reader-chapter-header" style="break-inside:avoid;margin-bottom:1.5rem;text-align:center">
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
      <div style="flex:1;height:1px;background:linear-gradient(to right,transparent,var(--reader-theme-line),transparent)"></div>
      <div style="width:8px;height:8px;transform:rotate(45deg);background:var(--reader-theme-accent)"></div>
      <div style="flex:1;height:1px;background:linear-gradient(to right,transparent,var(--reader-theme-line),transparent)"></div>
    </div>
    <h2 style="font-family:var(--reader-theme-display-font,var(--font-heading));font-size:1.5rem;color:var(--reader-theme-accent);margin:0">${title}</h2>
    <div style="display:flex;align-items:center;gap:0.75rem;margin-top:0.75rem">
      <div style="flex:1;height:1px;background:linear-gradient(to right,transparent,var(--reader-theme-line),transparent)"></div>
      <div style="width:8px;height:8px;transform:rotate(45deg);background:var(--reader-theme-accent)"></div>
      <div style="flex:1;height:1px;background:linear-gradient(to right,transparent,var(--reader-theme-line),transparent)"></div>
    </div>
  </div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function samePages(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function sameBooleans(a: boolean[], b: boolean[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function splitOversizedTextBlock(
  blockHtml: string,
  fits: (html: string) => boolean,
): string[] {
  const doc = new DOMParser().parseFromString(blockHtml, 'text/html');
  const el = doc.body.firstElementChild as HTMLElement | null;
  if (!el) return [blockHtml];

  const tag = el.tagName.toLowerCase();
  const canSplitTag = tag === 'p' || tag === 'blockquote' || tag === 'li';
  if (!canSplitTag) return [blockHtml];

  const rawText = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (!rawText) return [blockHtml];

  const cls = el.getAttribute('class');
  const style = el.getAttribute('style');
  const openTag = `<${tag}${cls ? ` class="${escapeHtml(cls)}"` : ''}${style ? ` style="${escapeHtml(style)}"` : ''}>`;
  const closeTag = `</${tag}>`;
  const words = rawText.split(' ');
  const parts: string[] = [];
  let start = 0;

  while (start < words.length) {
    let lo = start;
    let hi = words.length;
    let best = start;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (mid <= start) {
        lo = start + 1;
        continue;
      }
      const text = escapeHtml(words.slice(start, mid).join(' '));
      const candidate = `${openTag}${text}${closeTag}`;
      if (fits(candidate)) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (best === start) return [blockHtml];

    const text = escapeHtml(words.slice(start, best).join(' '));
    parts.push(`${openTag}${text}${closeTag}`);
    start = best;
  }

  return parts.length > 0 ? parts : [blockHtml];
}

function extractPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function getWordBounds(text: string, charIndex: number): { start: number; end: number } | null {
  if (!text) return null;
  const max = text.length - 1;
  if (max < 0) return null;

  let idx = Math.max(0, Math.min(charIndex, max));

  if (/\s/.test(text[idx])) {
    let forward = idx;
    while (forward < text.length && /\s/.test(text[forward])) forward += 1;
    if (forward < text.length) {
      idx = forward;
    } else {
      let backward = idx;
      while (backward >= 0 && /\s/.test(text[backward])) backward -= 1;
      if (backward < 0) return null;
      idx = backward;
    }
  }

  let start = idx;
  while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;

  let end = idx;
  while (end < text.length && !/\s/.test(text[end])) end += 1;

  if (end <= start) return null;
  return { start, end };
}

function resolveTextPoint(root: HTMLElement, offset: number): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let lastText: Text | null = null;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const len = node.data.length;
    if (offset <= consumed + len) {
      return { node, offset: Math.max(0, offset - consumed) };
    }
    consumed += len;
    lastText = node;
  }

  if (!lastText) return null;
  return { node: lastText, offset: lastText.data.length };
}

function resolveTokenRange(root: HTMLElement, tokenIndex: number): Range | null {
  if (tokenIndex < 0) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentToken = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = node.data;
    const regex = /\S+/g;
    let match = regex.exec(text);
    while (match) {
      if (currentToken === tokenIndex) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        return range;
      }
      currentToken += 1;
      match = regex.exec(text);
    }
  }

  return null;
}

function getSelectionTokenIndex(container: HTMLElement): number | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer)) return null;

  const prefix = document.createRange();
  prefix.selectNodeContents(container);
  prefix.setEnd(range.startContainer, range.startOffset);
  const matches = prefix.toString().match(/\S+/g);
  return matches ? Math.max(0, matches.length - 1) : 0;
}

function getPointTokenIndex(container: HTMLElement, clientX: number, clientY: number): number | null {
  const docAny = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  let node: Node | null = null;
  let offset = 0;

  if (docAny.caretPositionFromPoint) {
    const pos = docAny.caretPositionFromPoint(clientX, clientY);
    if (pos) {
      node = pos.offsetNode;
      offset = pos.offset;
    }
  } else if (docAny.caretRangeFromPoint) {
    const range = docAny.caretRangeFromPoint(clientX, clientY);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }

  if (!node || !container.contains(node)) return null;

  const prefix = document.createRange();
  prefix.selectNodeContents(container);
  try {
    prefix.setEnd(node, offset);
  } catch {
    return null;
  }

  const matches = prefix.toString().match(/\S+/g);
  return matches ? Math.max(0, matches.length - 1) : 0;
}

function resolveAnchorTokenIndex(
  container: HTMLElement,
  clientX: number,
  clientY: number,
): number | null {
  return getSelectionTokenIndex(container) ?? getPointTokenIndex(container, clientX, clientY);
}

/** Small portrait circle for a single character. */
function CharacterPortrait({ character }: { character: Character }) {
  const { url } = useImage(character.mainImageId);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="reader-character-avatar w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
        {url ? (
          <img src={url} alt={character.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-bold">
            {character.name.charAt(0)}
          </div>
        )}
      </div>
      <span className="reader-page-status text-[10px] leading-tight text-center max-w-[3.5rem] truncate">
        {character.name}
      </span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BookPageProps {
  content: string;
  chapterTitle: string | null;
  showCharacterPortraits: boolean;
  characters: Character[];
  chapterContext?: ChapterContext | null;
  fontSize?: number;
  fontCss?: string;
  /** 1 = single page, 2 = two-page spread */
  columnCount?: number;
  /** Gap between columns in px */
  columnGap?: number;
  /** Current spread index (0-based) */
  spreadIndex: number;
  /** Called when the total number of spreads changes after layout */
  onTotalSpreadsChange?: (total: number) => void;
  /** Called whenever chapter pagination changes. */
  onPagesTextChange?: (pageTexts: string[]) => void;
  /** Active page index currently being read aloud. */
  activeReadPageIndex?: number | null;
  /** Character index into the active read page text. */
  activeReadCharIndex?: number | null;
  /** Word token index into the active read page text. */
  activeReadTokenIndex?: number | null;
  /** Called when user indicates where reading should begin. */
  onReadAnchorChange?: (pageIndex: number, tokenIndex: number | null) => void;
  /** Whether read-aloud interaction mode is active. */
  readAloudMode?: boolean;
  /** Starts read-aloud from a clicked anchor while in read-aloud mode. */
  onReadAnchorActivate?: (pageIndex: number, tokenIndex: number | null) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookPage({
  content,
  chapterTitle,
  showCharacterPortraits,
  characters,
  chapterContext,
  fontSize = 18,
  fontCss,
  columnCount = 2,
  columnGap = 48,
  spreadIndex,
  onTotalSpreadsChange,
  onPagesTextChange,
  activeReadPageIndex = null,
  activeReadCharIndex = null,
  activeReadTokenIndex = null,
  onReadAnchorChange,
  readAloudMode = false,
  onReadAnchorActivate,
}: BookPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageHostRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const pageContentRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const fallbackHighlightRef = useRef<HTMLSpanElement | null>(null);
  const [pages, setPages] = useState<string[]>(['']);
  const [pageAllowsScroll, setPageAllowsScroll] = useState<boolean[]>([false]);

  // ── Mentioned characters for portraits ──
  const mentionedCharacters = useMemo(() => {
    if (!showCharacterPortraits || characters.length === 0) return [];
    const plainText = content.replace(/<[^>]*>/g, '').toLowerCase();
    return characters.filter((c) => plainText.includes(c.name.toLowerCase()));
  }, [content, characters, showCharacterPortraits]);

  // ── Build full HTML: chapter title + content with illustrations ──
  const fullHTML = useMemo(() => {
    const titleHTML = chapterTitle ? buildChapterTitleHTML(chapterTitle) : '';
    return titleHTML + renderIllustrations(content);
  }, [chapterTitle, content]);

  // ── Extract block-level HTML chunks for deterministic pagination ──
  const blocks = useMemo(() => {
    const doc = new DOMParser().parseFromString(fullHTML, 'text/html');
    const out: string[] = [];

    doc.body.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim() ?? '';
        if (text) out.push(`<p>${escapeHtml(text)}</p>`);
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;

      // Drop truly empty paragraph placeholders from the editor.
      if (el.tagName === 'P') {
        const text = el.textContent?.replace(/\u00a0/g, '').trim() ?? '';
        if (!text && !el.querySelector('img, video, audio, svg')) return;
      }

      out.push(el.outerHTML);
    });

    return out.length > 0 ? out : ['<p></p>'];
  }, [fullHTML]);

  // ── Deterministic paginator (no CSS column flow) ──
  const paginate = useCallback(() => {
    const host = pageHostRef.current;
    const measure = measureRef.current;
    if (!host || !measure) return;

    const hostW = host.clientWidth;
    const hostH = host.clientHeight;
    if (hostW <= 0 || hostH <= 0) return;

    const singlePageW = columnCount >= 2
      ? Math.max(260, Math.floor((hostW - columnGap) / 2))
      : hostW;

    measure.style.width = `${singlePageW}px`;
    measure.style.fontSize = `${fontSize}px`;
    measure.style.fontFamily = fontCss ?? '';

    const fits = (html: string) => {
      measure.innerHTML = html;
      return measure.scrollHeight <= hostH;
    };

    const nextPages: string[] = [];
    const nextPageAllowsScroll: boolean[] = [];
    let i = 0;

    while (i < blocks.length) {
      let lo = i;
      let hi = blocks.length - 1;
      let best = i - 1;

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const html = blocks.slice(i, mid + 1).join('');
        if (fits(html)) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      // Oversized single block: split text blocks by words, otherwise allow in-page scroll.
      if (best < i) {
        const splitParts = splitOversizedTextBlock(blocks[i], fits);
        if (splitParts.length === 1 && splitParts[0] === blocks[i]) {
          nextPages.push(blocks[i]);
          nextPageAllowsScroll.push(true);
        } else {
          splitParts.forEach((part) => {
            nextPages.push(part);
            nextPageAllowsScroll.push(false);
          });
        }
        i += 1;
        continue;
      }

      nextPages.push(blocks.slice(i, best + 1).join(''));
      nextPageAllowsScroll.push(false);
      i = best + 1;
    }

    const safePages = nextPages.length > 0 ? nextPages : ['<p></p>'];
    const safePageAllowsScroll = nextPageAllowsScroll.length > 0
      ? nextPageAllowsScroll
      : [false];
    const spreads = Math.max(1, Math.ceil(safePages.length / columnCount));
    onTotalSpreadsChange?.(spreads);

    setPages((prev) => (samePages(prev, safePages) ? prev : safePages));
    setPageAllowsScroll((prev) => (
      sameBooleans(prev, safePageAllowsScroll) ? prev : safePageAllowsScroll
    ));
  }, [blocks, columnCount, columnGap, fontCss, fontSize, onTotalSpreadsChange]);

  // Initial + dependency-driven repagination.
  useEffect(() => {
    paginate();
  }, [paginate]);

  const clearReadHighlight = useCallback(() => {
    const cssAny = (typeof CSS !== 'undefined' ? CSS : undefined) as unknown as {
      highlights?: {
        delete: (key: string) => void;
      };
    };
    cssAny.highlights?.delete(READ_HIGHLIGHT_KEY);

    const fallbackEl = fallbackHighlightRef.current;
    if (fallbackEl && fallbackEl.parentNode) {
      const text = document.createTextNode(fallbackEl.textContent ?? '');
      fallbackEl.parentNode.replaceChild(text, fallbackEl);
    }
    fallbackHighlightRef.current = null;
  }, []);

  const applyReadHighlight = useCallback((
    container: HTMLDivElement,
    charIndex: number,
    tokenIndex: number | null,
  ) => {
    clearReadHighlight();

    let range: Range | null = null;
    if (tokenIndex != null) {
      range = resolveTokenRange(container, tokenIndex);
    }
    if (!range) {
      const text = container.textContent ?? '';
      const bounds = getWordBounds(text, charIndex);
      if (!bounds) return;

      const startPoint = resolveTextPoint(container, bounds.start);
      const endPoint = resolveTextPoint(container, bounds.end);
      if (!startPoint || !endPoint) return;

      range = document.createRange();
      range.setStart(startPoint.node, startPoint.offset);
      range.setEnd(endPoint.node, endPoint.offset);
    }

    const HighlightCtor = (window as unknown as { Highlight?: new (range: Range) => unknown }).Highlight;
    const cssAny = (typeof CSS !== 'undefined' ? CSS : undefined) as unknown as {
      highlights?: {
        set: (key: string, value: unknown) => void;
      };
    };
    if (HighlightCtor && cssAny.highlights) {
      cssAny.highlights.set(READ_HIGHLIGHT_KEY, new HighlightCtor(range));
      return;
    }

    // Fallback for browsers without CSS Highlights API (single-text-node only).
    if (range.startContainer === range.endContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
      const sourceNode = range.startContainer as Text;
      const nodeText = sourceNode.data;
      const startOffset = range.startOffset;
      const endOffset = range.endOffset;
      const before = nodeText.slice(0, startOffset);
      const middle = nodeText.slice(startOffset, endOffset);
      const after = nodeText.slice(endOffset);

      const frag = document.createDocumentFragment();
      if (before) frag.append(document.createTextNode(before));
      const mark = document.createElement('span');
      mark.className = 'reader-word-highlight-fallback';
      mark.textContent = middle;
      frag.append(mark);
      if (after) frag.append(document.createTextNode(after));
      sourceNode.parentNode?.replaceChild(frag, sourceNode);
      fallbackHighlightRef.current = mark;
    }
  }, [clearReadHighlight]);

  const pageTexts = useMemo(() => pages.map((p) => extractPlainText(p)), [pages]);

  useEffect(() => {
    onPagesTextChange?.(pageTexts);
  }, [onPagesTextChange, pageTexts]);

  useEffect(() => {
    clearReadHighlight();

    if (activeReadPageIndex == null || activeReadCharIndex == null) return;
    const container = pageContentRefs.current[activeReadPageIndex];
    if (!container) return;

    applyReadHighlight(container, activeReadCharIndex, activeReadTokenIndex);
  }, [
    activeReadPageIndex,
    activeReadCharIndex,
    activeReadTokenIndex,
    pages,
    spreadIndex,
    applyReadHighlight,
    clearReadHighlight,
  ]);

  useEffect(() => () => {
    clearReadHighlight();
  }, [clearReadHighlight]);

  // Repaginate on container resize.
  useEffect(() => {
    const host = pageHostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => paginate());
    ro.observe(host);
    return () => ro.disconnect();
  }, [paginate]);

  // Font loading can change line-breaks without triggering a container resize.
  useEffect(() => {
    const fontSet = document.fonts;
    if (!fontSet) return;

    let cancelled = false;
    const repaginate = () => {
      if (!cancelled) paginate();
    };

    void fontSet.ready.then(repaginate).catch(() => {});
    fontSet.addEventListener('loadingdone', repaginate);
    fontSet.addEventListener('loadingerror', repaginate);
    return () => {
      cancelled = true;
      fontSet.removeEventListener('loadingdone', repaginate);
      fontSet.removeEventListener('loadingerror', repaginate);
    };
  }, [paginate]);

  // ── Page numbers ──
  const firstPageIndex = spreadIndex * columnCount;
  const leftPageNum = firstPageIndex + 1;
  const rightPageNum = Math.min(leftPageNum + 1, pages.length);
  const spreadPageIndices = columnCount >= 2
    ? [firstPageIndex, firstPageIndex + 1]
    : [firstPageIndex];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full relative overflow-hidden" ref={containerRef}>
      {/* Book surface card */}
      <div className="reader-book-surface h-full rounded-lg flex flex-col overflow-hidden">

        {/* Character portraits — first spread only */}
        {mentionedCharacters.length > 0 && spreadIndex === 0 && (
          <div className="reader-character-strip flex items-start gap-2 sm:gap-3 py-2 sm:py-3 px-2 sm:px-8 shrink-0">
            {mentionedCharacters.map((c) => (
              <CharacterPortrait key={c.id} character={c} />
            ))}
          </div>
        )}

        {/* Content area — padding wrapper */}
        <div data-content-area className="flex-1 min-h-0 px-2 sm:px-8 py-2 sm:py-6">
          <div
            ref={pageHostRef}
            className={columnCount >= 2 ? 'h-full grid grid-cols-2' : 'h-full grid grid-cols-1'}
            style={{ gap: `${columnGap}px` }}
          >
            {spreadPageIndices.map((pageIndex) => {
              const pageHtml = pages[pageIndex] ?? '';
              const allowScroll = pageAllowsScroll[pageIndex] ?? false;
              if (!pageHtml) pageContentRefs.current[pageIndex] = null;
              return (
                <div key={`${pageIndex}-${columnCount}`} className="h-full overflow-hidden">
                {pageHtml ? (
                  <div
                    ref={(el) => { pageContentRefs.current[pageIndex] = el; }}
                    data-reader-page-index={pageIndex}
                    onDoubleClick={(event) => {
                      if (readAloudMode) {
                        event.preventDefault();
                        event.stopPropagation();
                      }
                      const container = event.currentTarget;
                      const commitAnchor = (tokenIndex: number | null) => {
                        if (tokenIndex == null) return;
                        logClientTelemetry('read_anchor_double_click', {
                          pageIndex,
                          tokenIndex,
                          readAloudMode,
                        });
                        onReadAnchorChange?.(pageIndex, tokenIndex);
                        if (readAloudMode) onReadAnchorActivate?.(pageIndex, tokenIndex);
                      };

                      const immediate = resolveAnchorTokenIndex(
                        container,
                        event.clientX,
                        event.clientY,
                      );
                      if (immediate != null) {
                        commitAnchor(immediate);
                        return;
                      }

                      requestAnimationFrame(() => {
                        const deferred = resolveAnchorTokenIndex(
                          container,
                          event.clientX,
                          event.clientY,
                        );
                        if (deferred == null) {
                          logClientTelemetry('read_anchor_double_click_miss', {
                            pageIndex,
                            readAloudMode,
                          }, { severity: 'warn' });
                        }
                        commitAnchor(deferred);
                      });
                    }}
                    className={`reader-content reader-page-frame leading-relaxed h-full ${allowScroll ? 'overflow-y-auto pr-1' : 'overflow-y-hidden'}`}
                    style={{
                      fontSize: `${fontSize}px`,
                      fontFamily: fontCss,
                      scrollbarGutter: allowScroll ? 'stable' : 'auto',
                    }}
                    dangerouslySetInnerHTML={{ __html: pageHtml }}
                  />
                ) : (
                  <div className="h-full" />
                )}
              </div>
              );
            })}
          </div>

          {/* Hidden measuring page for deterministic pagination math */}
          <div
            ref={measureRef}
            className="reader-content reader-page-frame leading-relaxed pointer-events-none fixed -left-[99999px] top-0 invisible z-[-1]"
            style={{
              fontSize: `${fontSize}px`,
              fontFamily: fontCss,
            }}
          />
        </div>

        {/* Page numbers */}
        <div className="shrink-0 flex items-center px-8 py-2">
          {columnCount >= 2 ? (
            <>
              <span className="reader-page-number flex-1 text-xs text-left">
                {leftPageNum}
              </span>
              <span className="reader-page-number flex-1 text-xs text-right">
                {pages.length > 1 ? rightPageNum : ''}
              </span>
            </>
          ) : (
            <span className="reader-page-number flex-1 text-xs text-center">
              {leftPageNum}
            </span>
          )}
        </div>
      </div>

      {/* Full-height book spine */}
      {columnCount >= 2 && (
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 pointer-events-none z-10"
          style={{ width: '2px' }}
        >
          <div className="reader-spine-line absolute inset-0" />
          <div
            className="absolute inset-y-0 -left-4 w-8"
            style={{
              background:
                'linear-gradient(to right, transparent, rgba(0,0,0,0.03) 35%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.03) 65%, transparent)',
            }}
          />
        </div>
      )}

      {/* Hanako ghost popover for text selection (disabled during read-aloud mode) */}
      {!readAloudMode && (
        <HanakoGhostPopover
          containerRef={containerRef}
          chapterContext={chapterContext ?? null}
        />
      )}
    </div>
  );
}
