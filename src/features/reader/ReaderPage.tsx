import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Users, Wrench, ZoomIn, ZoomOut, Type, Volume2, Play, Pause, Square } from 'lucide-react';
import { useWritingTools } from '@/components/layout/WritingToolsContext';
import { getBook } from '@/api/books';
import { listChapters } from '@/api/chapters';
import { listCharacters } from '@/api/characters';
import { logClientTelemetry } from '@/api/telemetry';
import { useImage } from '@/hooks/useImageStore';
import type { Book, Chapter, Character } from '@/types';
import BookPage from './BookPage';
import ReaderControls from './ReaderControls';
import { useReaderTheme } from './readerTheme';

const FONT_SIZE_KEY = 'reader-font-size';
const FONT_FAMILY_KEY = 'reader-font-family';
const TTS_RATE_KEY = 'reader-tts-rate';
const TTS_VOICE_KEY = 'reader-tts-voice-uri';

const FONT_FAMILIES = [
  { label: 'Serif', value: 'serif', css: "'Lora', serif" },
  { label: 'Sans', value: 'sans', css: "'Nunito', sans-serif" },
  { label: 'Mono', value: 'mono', css: "'JetBrains Mono', monospace" },
] as const;

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 28;
const FONT_SIZE_STEP = 2;
const COLUMN_GAP = 48;
const MIN_TTS_RATE = 0.6;
const MAX_TTS_RATE = 1.8;

function scoreVoiceNaturalness(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = 0;

  if (lang.startsWith('en-us')) score += 35;
  else if (lang.startsWith('en-')) score += 20;
  else score -= 30;

  if (voice.default) score += 12;
  if (!voice.localService) score += 8;

  if (/natural|neural|online|enhanced|premium/.test(name)) score += 80;
  if (/aria|jenny|guy|samantha|zira|ava|andrew|google/.test(name)) score += 30;
  if (/compact|espeak|festival|basic/.test(name)) score -= 50;

  return score;
}

function getTokenIndexAtChar(text: string, charIndex: number): number {
  if (!text) return 0;
  const safeIndex = Math.max(0, Math.min(charIndex, Math.max(0, text.length - 1)));

  const tokenRegex = /\S+/g;
  let tokenIdx = 0;
  let match = tokenRegex.exec(text);
  while (match) {
    const start = match.index;
    const end = start + match[0].length;
    if (safeIndex <= end) return tokenIdx;
    tokenIdx += 1;
    match = tokenRegex.exec(text);
  }

  return Math.max(0, tokenIdx - 1);
}

function getCharIndexAtToken(text: string, tokenIndex: number): number {
  if (!text) return 0;
  const safeToken = Math.max(0, tokenIndex);
  const tokenRegex = /\S+/g;
  let idx = 0;
  let match = tokenRegex.exec(text);
  while (match) {
    if (idx === safeToken) return match.index;
    idx += 1;
    match = tokenRegex.exec(text);
  }
  return 0;
}

/** Hook to track whether we have enough width for a two-page spread. */
function useTwoPageMode(breakpoint = 1024): boolean {
  const [twoPage, setTwoPage] = useState(() => window.innerWidth >= breakpoint);
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setTwoPage(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);
  return twoPage;
}

export default function ReaderPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { openWritingTools } = useWritingTools();
  const twoPage = useTwoPageMode();

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [totalSpreads, setTotalSpreads] = useState(1);
  const [showCharacterPortraits, setShowCharacterPortraits] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showReadAloudPanel, setShowReadAloudPanel] = useState(false);

  const speechSupported = typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && 'SpeechSynthesisUtterance' in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsRate, setTtsRate] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(TTS_RATE_KEY) ?? '1');
      return Number.isFinite(saved) ? Math.min(MAX_TTS_RATE, Math.max(MIN_TTS_RATE, saved)) : 1;
    } catch {
      return 1;
    }
  });
  const [ttsVoiceURI, setTtsVoiceURI] = useState(() => {
    try { return localStorage.getItem(TTS_VOICE_KEY) || ''; } catch { return ''; }
  });
  const [chapterPagesText, setChapterPagesText] = useState<string[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeReadPageIndex, setActiveReadPageIndex] = useState<number | null>(null);
  const [activeReadCharIndex, setActiveReadCharIndex] = useState<number | null>(null);
  const [activeReadTokenIndex, setActiveReadTokenIndex] = useState<number | null>(null);
  const [readAloudStatus, setReadAloudStatus] = useState<string | null>(null);
  const [anchorPreviewPage, setAnchorPreviewPage] = useState<number | null>(null);
  const [anchorPreviewToken, setAnchorPreviewToken] = useState<number | null>(null);
  const readAnchorRef = useRef<{ page: number | null; token: number | null }>({ page: null, token: null });
  const readAloudPanelRef = useRef<HTMLDivElement>(null);
  const stopRequestedRef = useRef(false);
  const pendingReadStartRef = useRef<{ page: number; token: number } | null>(null);
  const readSessionRef = useRef(0);
  const prevLayoutRef = useRef({
    chapter: 0,
    fontSize: 18,
    fontFamily: 'serif',
    twoPage: false,
  });
  const prevVoiceRateRef = useRef({
    voice: '',
    rate: 1,
  });
  const readAloudBuildId = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const scriptWithHash = Array.from(document.scripts).find((script) => (
      typeof script.src === 'string' && /\/assets\/index-[^/]+\.js/.test(script.src)
    ));
    const match = scriptWithHash?.src.match(/index-([^.]+)\.js/);
    return match?.[1] ?? null;
  }, []);

  // Reader customization — persisted to localStorage
  const [fontSize, setFontSize] = useState(() => {
    try { return parseInt(localStorage.getItem(FONT_SIZE_KEY) || '18', 10); } catch { return 18; }
  });
  const [fontFamily, setFontFamily] = useState(() => {
    try { return localStorage.getItem(FONT_FAMILY_KEY) || 'serif'; } catch { return 'serif'; }
  });

  const fontConfig = FONT_FAMILIES.find((f) => f.value === fontFamily) ?? FONT_FAMILIES[0];
  const { url: coverUrl } = useImage(book?.coverImageId);
  const readerTheme = useReaderTheme({
    bookId: book?.id,
    coverImageId: book?.coverImageId,
    coverUrl,
    description: book?.description,
    genre: book?.genre,
    title: book?.title ?? '',
  });

  useEffect(() => {
    prevLayoutRef.current = {
      chapter: currentChapterIndex,
      fontSize,
      fontFamily,
      twoPage,
    };
    prevVoiceRateRef.current = {
      voice: ttsVoiceURI,
      rate: ttsRate,
    };
  }, []); // initialize change trackers once

  useEffect(() => {
    try { localStorage.setItem(FONT_SIZE_KEY, String(fontSize)); } catch { /* ignore */ }
  }, [fontSize]);
  useEffect(() => {
    try { localStorage.setItem(FONT_FAMILY_KEY, fontFamily); } catch { /* ignore */ }
  }, [fontFamily]);
  useEffect(() => {
    try { localStorage.setItem(TTS_RATE_KEY, String(ttsRate)); } catch { /* ignore */ }
  }, [ttsRate]);
  useEffect(() => {
    try { localStorage.setItem(TTS_VOICE_KEY, ttsVoiceURI); } catch { /* ignore */ }
  }, [ttsVoiceURI]);

  useEffect(() => {
    if (!speechSupported) return;

    const synth = window.speechSynthesis;
    const refreshVoices = () => {
      const nextVoices = synth.getVoices();
      nextVoices.sort((a, b) => a.name.localeCompare(b.name));
      setVoices(nextVoices);
    };

    refreshVoices();
    synth.addEventListener('voiceschanged', refreshVoices);
    return () => synth.removeEventListener('voiceschanged', refreshVoices);
  }, [speechSupported]);

  const voiceOptions = useMemo(() => {
    if (voices.length === 0) return [];
    const englishPool = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    const pool = englishPool.length > 0 ? englishPool : voices;

    const deduped = pool.filter((voice, index, arr) => (
      arr.findIndex((v) => v.voiceURI === voice.voiceURI) === index
    ));

    deduped.sort((a, b) => (
      scoreVoiceNaturalness(b) - scoreVoiceNaturalness(a)
      || a.name.localeCompare(b.name)
    ));

    return deduped.slice(0, 3);
  }, [voices]);

  useEffect(() => {
    if (voiceOptions.length === 0) return;
    const hasSelected = voiceOptions.some((v) => v.voiceURI === ttsVoiceURI);
    if (hasSelected) return;
    const preferred = voiceOptions.find((v) => v.default) ?? voiceOptions[0];
    setTtsVoiceURI(preferred.voiceURI);
  }, [voiceOptions, ttsVoiceURI]);

  const zoomIn = useCallback(() => setFontSize((s) => Math.min(s + FONT_SIZE_STEP, MAX_FONT_SIZE)), []);
  const zoomOut = useCallback(() => setFontSize((s) => Math.max(s - FONT_SIZE_STEP, MIN_FONT_SIZE)), []);

  // Fetch book, chapters, and characters on mount
  useEffect(() => {
    if (!bookId) return;

    async function load() {
      try {
        const [fetchedBook, fetchedChapters, fetchedCharacters] = await Promise.all([
          getBook(bookId!),
          listChapters(bookId!),
          listCharacters(bookId!),
        ]);

        setBook(fetchedBook ?? null);
        setChapters(fetchedChapters);
        setCharacters(fetchedCharacters);
      } catch {
        setBook(null);
      }
      setLoading(false);
    }

    load();
  }, [bookId]);

  // Reset spread to 0 when chapter changes
  useEffect(() => {
    setSpreadIndex(0);
    setTotalSpreads(1);
    readAnchorRef.current = { page: null, token: null };
    setAnchorPreviewPage(null);
    setAnchorPreviewToken(null);
  }, [currentChapterIndex]);

  // Reset spread when font/layout changes
  useEffect(() => {
    setSpreadIndex(0);
    readAnchorRef.current = { page: null, token: null };
    setAnchorPreviewPage(null);
    setAnchorPreviewToken(null);
  }, [fontSize, fontFamily, twoPage]);

  const currentChapter = chapters[currentChapterIndex] ?? null;
  const columnCount = twoPage ? 2 : 1;
  const currentReadPage = activeReadPageIndex != null ? activeReadPageIndex + 1 : null;
  const readAloudMode = isReading || isPaused;
  const readAloudInteractionMode = showReadAloudPanel || readAloudMode;
  const clearReadAnchor = useCallback(() => {
    readAnchorRef.current = { page: null, token: null };
    setAnchorPreviewPage(null);
    setAnchorPreviewToken(null);
  }, []);

  const stopReading = useCallback((reason = 'internal') => {
    if (!speechSupported) return;
    if (isReading || isPaused) {
      logClientTelemetry('read_stop', {
        reason,
        chapterIndex: currentChapterIndex,
        spreadIndex,
        activePageIndex: activeReadPageIndex,
      });
    }
    stopRequestedRef.current = true;
    readSessionRef.current += 1;
    window.speechSynthesis.cancel();
    setIsReading(false);
    setIsPaused(false);
    setActiveReadPageIndex(null);
    setActiveReadCharIndex(null);
    setActiveReadTokenIndex(null);
    pendingReadStartRef.current = null;
    setReadAloudStatus(null);
  }, [activeReadPageIndex, currentChapterIndex, isPaused, isReading, speechSupported, spreadIndex]);

  const speakFromPage = useCallback((startPageIndex: number, startTokenIndex = 0) => {
    logClientTelemetry('read_start_request', {
      chapterIndex: currentChapterIndex,
      spreadIndex,
      startPageIndex,
      startTokenIndex,
      pageTextCount: chapterPagesText.length,
    });
    if (!speechSupported || chapterPagesText.length === 0) {
      setIsReading(false);
      setIsPaused(false);
      setActiveReadPageIndex(null);
      setActiveReadCharIndex(null);
      setActiveReadTokenIndex(null);
      setReadAloudStatus(
        speechSupported
          ? 'Pages are still loading. Try again in a second.'
          : 'Read aloud is not supported in this browser.',
      );
      logClientTelemetry('read_start_blocked', {
        speechSupported,
        pageTextCount: chapterPagesText.length,
      }, { severity: 'warn' });
      return;
    }

    const synth = window.speechSynthesis;
    readSessionRef.current += 1;
    const runId = readSessionRef.current;
    const maxPages = chapterPagesText.length;
    setReadAloudStatus(null);
    const selectedVoice = voiceOptions.find((v) => v.voiceURI === ttsVoiceURI)
      ?? voiceOptions.find((v) => v.default)
      ?? voiceOptions[0]
      ?? null;
    const voiceFallbackChain = [
      selectedVoice,
      ...voiceOptions.filter((v) => !selectedVoice || v.voiceURI !== selectedVoice.voiceURI),
      ...voices.filter((v) => !selectedVoice || v.voiceURI !== selectedVoice.voiceURI),
      null, // final fallback: let browser pick default voice
    ].filter((voice, index, arr) => (
      voice === null
        ? arr.findIndex((v) => v === null) === index
        : arr.findIndex((v) => v && v.voiceURI === voice.voiceURI) === index
    ));

    const speakPage = (
      pageIndex: number,
      startTokenForPage = 0,
      retryCount = 0,
      voiceAttempt = 0,
    ) => {
      if (stopRequestedRef.current || runId !== readSessionRef.current) return;

      if (pageIndex >= maxPages) {
        if (runId !== readSessionRef.current) return;
        logClientTelemetry('read_finished', {
          chapterIndex: currentChapterIndex,
          startPageIndex,
          startTokenIndex,
        });
        setIsReading(false);
        setIsPaused(false);
        setActiveReadPageIndex(null);
        setActiveReadCharIndex(null);
        setActiveReadTokenIndex(null);
        setReadAloudStatus(null);
        return;
      }

      const text = chapterPagesText[pageIndex]?.trim() ?? '';
      if (!text) {
        speakPage(pageIndex + 1, 0);
        return;
      }

      const startChar = getCharIndexAtToken(text, startTokenForPage);
      const spokenText = startChar > 0 ? text.slice(startChar).trimStart() : text;
      const spokenTokenOffset = startTokenForPage;
      const spokenStartChar = startChar;

      const targetSpread = Math.floor(pageIndex / columnCount);
      setSpreadIndex((prev) => (prev === targetSpread ? prev : targetSpread));
      setActiveReadPageIndex(pageIndex);
      setActiveReadCharIndex(spokenStartChar);
      setActiveReadTokenIndex(spokenTokenOffset);
      setIsReading(true);
      setIsPaused(false);

      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = ttsRate;
      const attemptVoice = voiceFallbackChain[Math.max(0, Math.min(voiceAttempt, voiceFallbackChain.length - 1))];
      if (attemptVoice) utterance.voice = attemptVoice;

      let started = false;
      let watchdogId: number | null = null;

      const clearWatchdog = () => {
        if (watchdogId != null) {
          window.clearTimeout(watchdogId);
          watchdogId = null;
        }
      };

      const failStart = (statusMessage = 'Could not start read aloud. Click Read From Here again.') => {
        logClientTelemetry('read_start_failed', {
          chapterIndex: currentChapterIndex,
          pageIndex,
          startTokenForPage,
        }, { severity: 'error' });
        setIsReading(false);
        setIsPaused(false);
        setActiveReadPageIndex(null);
        setActiveReadCharIndex(null);
        setActiveReadTokenIndex(null);
        setReadAloudStatus(statusMessage);
      };

      const tryNextVoice = (reason: string): boolean => {
        const nextVoiceAttempt = voiceAttempt + 1;
        if (nextVoiceAttempt >= voiceFallbackChain.length) return false;
        const nextVoice = voiceFallbackChain[nextVoiceAttempt];
        logClientTelemetry('read_voice_fallback', {
          chapterIndex: currentChapterIndex,
          pageIndex,
          startTokenForPage,
          retryCount,
          reason,
          fromVoiceUri: attemptVoice?.voiceURI ?? 'default',
          toVoiceUri: nextVoice?.voiceURI ?? 'default',
        }, { severity: 'warn' });
        window.setTimeout(() => {
          if (stopRequestedRef.current || runId !== readSessionRef.current) return;
          speakPage(pageIndex, startTokenForPage, retryCount, nextVoiceAttempt);
        }, 80);
        return true;
      };

      utterance.onstart = () => {
        if (stopRequestedRef.current || runId !== readSessionRef.current) return;
        started = true;
        clearWatchdog();
        logClientTelemetry('read_utterance_start', {
          chapterIndex: currentChapterIndex,
          pageIndex,
          startTokenForPage,
          voiceUri: attemptVoice?.voiceURI ?? ttsVoiceURI,
          voiceName: attemptVoice?.name ?? 'default',
          rate: ttsRate,
        });
      };

      utterance.onboundary = (event) => {
        if (stopRequestedRef.current || runId !== readSessionRef.current) return;
        if (typeof event.charIndex === 'number') {
          const localChar = Math.max(0, event.charIndex);
          setActiveReadCharIndex(spokenStartChar + localChar);
          setActiveReadTokenIndex(spokenTokenOffset + getTokenIndexAtChar(spokenText, localChar));
        }
      };

      utterance.onend = () => {
        if (stopRequestedRef.current || runId !== readSessionRef.current) return;
        clearWatchdog();
        if (!started) {
          logClientTelemetry('read_utterance_end_without_start', {
            chapterIndex: currentChapterIndex,
            pageIndex,
            retryCount,
            voiceUri: attemptVoice?.voiceURI ?? ttsVoiceURI,
            rate: ttsRate,
            synthSpeaking: synth.speaking,
            synthPending: synth.pending,
            synthPaused: synth.paused,
          }, { severity: 'warn' });
          if (tryNextVoice('utterance_onend_without_start')) return;
          if (retryCount < 2) {
            logClientTelemetry('read_retry_scheduled', {
              chapterIndex: currentChapterIndex,
              pageIndex,
              retryCount: retryCount + 1,
              reason: 'utterance_onend_without_start',
            }, { severity: 'warn' });
            window.setTimeout(() => {
              if (stopRequestedRef.current || runId !== readSessionRef.current) return;
              speakPage(pageIndex, startTokenForPage, retryCount + 1, voiceAttempt);
            }, 120);
            return;
          }
          failStart();
          return;
        }
        logClientTelemetry('read_page_end', {
          chapterIndex: currentChapterIndex,
          pageIndex,
        });
        speakPage(pageIndex + 1, 0);
      };

      utterance.onerror = (event) => {
        if (stopRequestedRef.current || runId !== readSessionRef.current) return;
        clearWatchdog();
        logClientTelemetry('read_utterance_error', {
          chapterIndex: currentChapterIndex,
          pageIndex,
          retryCount,
          voiceUri: attemptVoice?.voiceURI ?? ttsVoiceURI,
          error: event.error,
          synthSpeaking: synth.speaking,
          synthPending: synth.pending,
          synthPaused: synth.paused,
        }, { severity: 'warn' });
        if (event.error === 'not-allowed') {
          failStart('Browser blocked read aloud audio. Click the page, then click Read From Here.');
          return;
        }
        if (tryNextVoice('utterance_onerror')) return;
        if (retryCount < 2) {
          logClientTelemetry('read_retry_scheduled', {
            chapterIndex: currentChapterIndex,
            pageIndex,
            retryCount: retryCount + 1,
            reason: 'utterance_onerror',
          }, { severity: 'warn' });
          window.setTimeout(() => {
            if (stopRequestedRef.current || runId !== readSessionRef.current) return;
            speakPage(pageIndex, startTokenForPage, retryCount + 1, voiceAttempt);
          }, 120);
          return;
        }
        failStart();
      };

      synth.speak(utterance);

      watchdogId = window.setTimeout(() => {
        if (stopRequestedRef.current || runId !== readSessionRef.current || started) return;
        if (synth.speaking || synth.pending) return;
        if (tryNextVoice('watchdog_timeout_no_start')) return;
        if (retryCount < 2) {
          logClientTelemetry('read_retry_scheduled', {
            chapterIndex: currentChapterIndex,
            pageIndex,
            retryCount: retryCount + 1,
            reason: 'watchdog_timeout',
          }, { severity: 'warn' });
          synth.cancel();
          window.setTimeout(() => {
            if (stopRequestedRef.current || runId !== readSessionRef.current) return;
            speakPage(pageIndex, startTokenForPage, retryCount + 1, voiceAttempt);
          }, 90);
          return;
        }
        failStart();
      }, 450);
    };

    if (synth.paused) synth.resume();
    stopRequestedRef.current = false;
    const startReading = () => {
      if (stopRequestedRef.current || runId !== readSessionRef.current) return;
      speakPage(startPageIndex, startTokenIndex);
    };
    if (synth.speaking || synth.pending) {
      synth.cancel();
      window.setTimeout(startReading, 90);
      return;
    }
    startReading();
  }, [chapterPagesText, columnCount, currentChapterIndex, speechSupported, spreadIndex, ttsRate, ttsVoiceURI, voiceOptions, voices]);

  const toggleReadAloud = useCallback(() => {
    if (!speechSupported) return;

    const synth = window.speechSynthesis;
    if (isReading) {
      if (isPaused) {
        synth.resume();
        setIsPaused(false);
        logClientTelemetry('read_resume', { chapterIndex: currentChapterIndex, spreadIndex });
      } else {
        synth.pause();
        setIsPaused(true);
        logClientTelemetry('read_pause', { chapterIndex: currentChapterIndex, spreadIndex });
      }
      return;
    }

    setReadAloudStatus(null);
    const spreadStart = Math.max(0, spreadIndex * columnCount);
    const hintPage = readAnchorRef.current.page;
    const maxPages = chapterPagesText.length;
    const useAnchor = hintPage != null && (maxPages === 0 || hintPage < maxPages);
    const unresolvedStartPage = useAnchor ? hintPage : spreadStart;
    const startPage = maxPages > 0
      ? Math.max(0, Math.min(unresolvedStartPage, maxPages - 1))
      : Math.max(0, unresolvedStartPage);
    const startToken = useAnchor
      ? Math.max(0, readAnchorRef.current.token ?? 0)
      : 0;
    if (!useAnchor && hintPage != null) {
      readAnchorRef.current = { page: startPage, token: 0 };
      setAnchorPreviewPage(startPage);
      setAnchorPreviewToken(0);
    }
    if (maxPages <= 0) {
      pendingReadStartRef.current = { page: startPage, token: startToken };
      setReadAloudStatus('Preparing pages...');
      logClientTelemetry('read_pending_pages', {
        chapterIndex: currentChapterIndex,
        spreadIndex,
        startPage,
        startToken,
      }, { severity: 'warn' });
      return;
    }
    speakFromPage(startPage, startToken);
  }, [
    chapterPagesText.length,
    columnCount,
    currentChapterIndex,
    isPaused,
    isReading,
    speakFromPage,
    speechSupported,
    spreadIndex,
  ]);

  useEffect(() => {
    const pending = pendingReadStartRef.current;
    if (!pending) return;
    if (chapterPagesText.length === 0) return;

    pendingReadStartRef.current = null;
    logClientTelemetry('read_pending_start_flush', {
      chapterIndex: currentChapterIndex,
      spreadIndex,
      pageIndex: pending.page,
      tokenIndex: pending.token,
      pageTextCount: chapterPagesText.length,
    });
    speakFromPage(
      Math.max(0, Math.min(pending.page, chapterPagesText.length - 1)),
      Math.max(0, pending.token),
    );
  }, [chapterPagesText, currentChapterIndex, speakFromPage, spreadIndex]);

  useEffect(() => {
    const prev = prevLayoutRef.current;
    const layoutChanged = prev.chapter !== currentChapterIndex
      || prev.fontSize !== fontSize
      || prev.fontFamily !== fontFamily
      || prev.twoPage !== twoPage;

    prevLayoutRef.current = {
      chapter: currentChapterIndex,
      fontSize,
      fontFamily,
      twoPage,
    };

    if (isReading && layoutChanged) stopReading('layout_change');
  }, [currentChapterIndex, fontFamily, fontSize, isReading, stopReading, twoPage]);

  // Can we navigate backward?
  const canGoPrev = spreadIndex > 0 || currentChapterIndex > 0;
  // Can we navigate forward?
  const canGoNext = spreadIndex < totalSpreads - 1 || currentChapterIndex < chapters.length - 1;

  const goNext = useCallback(() => {
    if (isReading) stopReading('navigate_next');
    clearReadAnchor();
    if (spreadIndex < totalSpreads - 1) {
      setSpreadIndex((s) => s + 1);
    } else if (currentChapterIndex < chapters.length - 1) {
      setCurrentChapterIndex((i) => i + 1);
    }
  }, [chapters.length, clearReadAnchor, currentChapterIndex, isReading, spreadIndex, stopReading, totalSpreads]);

  const goPrev = useCallback(() => {
    if (isReading) stopReading('navigate_prev');
    clearReadAnchor();
    if (spreadIndex > 0) {
      setSpreadIndex((s) => s - 1);
    } else if (currentChapterIndex > 0) {
      // Go to previous chapter — set to large number, will be clamped by onTotalSpreadsChange
      setCurrentChapterIndex((i) => i - 1);
      setSpreadIndex(999);
    }
  }, [clearReadAnchor, currentChapterIndex, isReading, spreadIndex, stopReading]);

  const handleTotalSpreadsChange = useCallback((total: number) => {
    setTotalSpreads(total);
    // If spreadIndex is out of bounds (e.g. 999 from goPrev), clamp it
    setSpreadIndex((prev) => Math.min(prev, Math.max(0, total - 1)));
  }, []);

  // Keyboard navigation + zoom shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, zoomIn, zoomOut]);

  // Scroll wheel navigation — debounced so one flick = one page turn
  useEffect(() => {
    let cooldown = false;
    function handleWheel(e: WheelEvent) {
      // Don't hijack pinch-to-zoom (ctrlKey) or small trackpad jitter
      if (e.ctrlKey || Math.abs(e.deltaY) < 10) return;
      e.preventDefault();
      if (cooldown) return;
      cooldown = true;
      if (e.deltaY > 0) goNext();
      else goPrev();
      setTimeout(() => { cooldown = false; }, 400);
    }

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [goNext, goPrev]);

  // Close font picker on outside click
  useEffect(() => {
    if (!showFontPicker) return;
    const handleClick = () => setShowFontPicker(false);
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClick); };
  }, [showFontPicker]);

  useEffect(() => {
    const prev = prevVoiceRateRef.current;
    const voiceOrRateChanged = prev.voice !== ttsVoiceURI || prev.rate !== ttsRate;
    prevVoiceRateRef.current = { voice: ttsVoiceURI, rate: ttsRate };
    if (isReading && voiceOrRateChanged) stopReading();
  }, [isReading, stopReading, ttsRate, ttsVoiceURI]);

  useEffect(() => () => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
  }, [speechSupported]);

  const handleChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isReading) stopReading('chapter_change');
    clearReadAnchor();
    setCurrentChapterIndex(Number(e.target.value));
  };

  const handleReadAnchorChange = useCallback((pageIndex: number, tokenIndex: number | null) => {
    if (tokenIndex == null) return;
    logClientTelemetry('read_anchor_set', {
      chapterIndex: currentChapterIndex,
      spreadIndex,
      pageIndex,
      tokenIndex,
    });
    readAnchorRef.current = { page: pageIndex, token: tokenIndex };
    setAnchorPreviewPage(pageIndex);
    setAnchorPreviewToken(tokenIndex);
  }, [currentChapterIndex, spreadIndex]);

  const handleReadAnchorActivate = useCallback((pageIndex: number, tokenIndex: number | null) => {
    if (!readAloudInteractionMode || !speechSupported) return;
    const safePage = Math.max(0, pageIndex);
    const safeToken = Math.max(0, tokenIndex ?? 0);
    logClientTelemetry('read_anchor_activate', {
      chapterIndex: currentChapterIndex,
      spreadIndex,
      pageIndex: safePage,
      tokenIndex: safeToken,
    });
    readAnchorRef.current = { page: safePage, token: safeToken };
    setAnchorPreviewPage(safePage);
    setAnchorPreviewToken(safeToken);
    speakFromPage(safePage, safeToken);
  }, [currentChapterIndex, readAloudInteractionMode, speakFromPage, speechSupported, spreadIndex]);

  const handleReadAloudPanelToggle = useCallback(() => {
    setShowReadAloudPanel((prev) => {
      const next = !prev;
      if (next) {
        const spreadStart = Math.max(0, spreadIndex * columnCount);
        const spreadEnd = spreadStart + columnCount - 1;
        const anchorPage = readAnchorRef.current.page;
        const anchorInSpread = anchorPage != null && anchorPage >= spreadStart && anchorPage <= spreadEnd;
        if (!anchorInSpread) {
          readAnchorRef.current = { page: spreadStart, token: 0 };
          setAnchorPreviewPage(spreadStart);
          setAnchorPreviewToken(0);
          logClientTelemetry('read_anchor_defaulted', {
            chapterIndex: currentChapterIndex,
            spreadIndex,
            pageIndex: spreadStart,
          });
        }
      }
      logClientTelemetry('read_panel_toggle', {
        chapterIndex: currentChapterIndex,
        spreadIndex,
        open: next,
      });
      return next;
    });
  }, [columnCount, currentChapterIndex, spreadIndex]);

  const handleReadStopClick = useCallback(() => {
    stopReading('manual_stop');
  }, [stopReading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <p className="text-indigo/50">Book not found.</p>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-cream gap-4">
        <p className="text-indigo/50 font-body">No chapters to read yet.</p>
        <button
          type="button"
          onClick={() => navigate(`/book/${bookId}`)}
          className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-semibold transition-colors cursor-pointer"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Build chapter context for Hanako ghost popover
  const readerChapterContext = currentChapter ? {
    chapterId: currentChapter.id,
    title: currentChapter.title,
    content: currentChapter.content,
    wordCount: currentChapter.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length,
  } : null;

  // Page display for the top bar
  const pageStart = spreadIndex * columnCount + 1;
  const pageEnd = Math.min(pageStart + columnCount - 1, totalSpreads * columnCount);
  const displayPage = columnCount > 1 && pageStart !== pageEnd
    ? `${pageStart}–${pageEnd}`
    : `${pageStart}`;

  return (
    <div
      className="reader-shell h-screen flex flex-col overflow-hidden"
      data-reader-mood={readerTheme.mood}
      style={readerTheme.style as CSSProperties}
    >
      {/* Top Bar */}
      <div className="reader-topbar shrink-0 z-50">
        <div className="flex items-center justify-between px-2 sm:px-6 py-2">
          {/* Left: Back button */}
          <button
            type="button"
            onClick={() => navigate(`/book/${bookId}`)}
            className="reader-back-button inline-flex items-center gap-2 font-semibold transition-colors text-sm cursor-pointer"
          >
            <ArrowLeft size={18} />
            Back
          </button>

          {/* Center: Book title + chapter select */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="hidden sm:flex items-center gap-3 min-w-0">
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt={book.title}
                  className="reader-theme-cover h-11 w-9 shrink-0 object-cover"
                />
              )}
              <div className="min-w-0">
                <h1 className="reader-book-title text-lg truncate">
                  {book.title}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="reader-theme-badge">{readerTheme.badge}</span>
                  <div className="flex items-center gap-1">
                    {readerTheme.palette.slice(0, 3).map((color) => (
                      <span
                        key={color}
                        className="reader-palette-dot"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <select
              value={currentChapterIndex}
              onChange={handleChapterChange}
              className="reader-select rounded-lg px-3 py-1.5 text-sm font-body focus:outline-none cursor-pointer"
            >
              {chapters.map((ch, idx) => (
                <option key={ch.id} value={idx}>
                  {ch.title || `Chapter ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            {/* Zoom out */}
            <button
              type="button"
              onClick={zoomOut}
              disabled={fontSize <= MIN_FONT_SIZE}
              className="reader-control-button p-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Decrease font size"
            >
              <ZoomOut size={16} />
            </button>

            {/* Font size indicator */}
            <span className="reader-page-status text-xs w-6 text-center tabular-nums">{fontSize}</span>

            {/* Zoom in */}
            <button
              type="button"
              onClick={zoomIn}
              disabled={fontSize >= MAX_FONT_SIZE}
              className="reader-control-button p-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Increase font size"
            >
              <ZoomIn size={16} />
            </button>

            {/* Font picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFontPicker((v) => !v)}
                className="reader-control-button p-1.5 rounded-lg transition-all cursor-pointer"
                title="Change font"
              >
                <Type size={16} />
              </button>
              {showFontPicker && (
                <div className="reader-floating-panel absolute right-0 top-full mt-1 rounded-xl py-1 z-50 min-w-[120px]">
                  {FONT_FAMILIES.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => { setFontFamily(f.value); setShowFontPicker(false); }}
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors cursor-pointer ${
                        fontFamily === f.value
                          ? 'reader-option-active font-semibold'
                          : 'reader-option'
                      }`}
                      style={{ fontFamily: f.css }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Read aloud */}
            <div className="relative" ref={readAloudPanelRef}>
              <button
                type="button"
                onClick={handleReadAloudPanelToggle}
                className={`reader-control-button p-1.5 rounded-lg transition-all cursor-pointer ${
                  !speechSupported
                    ? 'cursor-not-allowed opacity-40'
                    : showReadAloudPanel || readAloudMode
                      ? 'reader-control-button-active'
                      : ''
                }`}
                title={
                  speechSupported
                    ? showReadAloudPanel
                      ? 'Close read aloud panel'
                      : 'Open read aloud panel'
                    : 'Read aloud is not supported in this browser'
                }
                disabled={!speechSupported}
              >
                <Volume2 size={16} />
              </button>

              {showReadAloudPanel && (
                <div className="reader-floating-panel absolute right-0 top-full mt-1 w-72 rounded-xl p-3 z-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="reader-panel-label text-xs uppercase tracking-wider font-semibold">Read Aloud</span>
                    <span className="reader-page-status text-[11px]">
                      {isReading
                        ? isPaused
                          ? 'Paused'
                          : `Reading${currentReadPage ? ` · Pg ${currentReadPage}` : ''}`
                        : 'Ready'}
                    </span>
                  </div>
                  <div className="reader-page-status mb-2 text-[11px]">
                    Anchor: {anchorPreviewPage != null
                      ? `Pg ${anchorPreviewPage + 1}${anchorPreviewToken != null ? ` · W${anchorPreviewToken + 1}` : ''}`
                      : 'Not set (double-click a word)'}
                  </div>
                  {readAloudStatus && (
                    <div className="mb-2 text-[11px] rounded-md px-2 py-1 reader-status-banner">
                      {readAloudStatus}
                    </div>
                  )}
                  {readAloudBuildId && (
                    <div className="reader-page-status mb-2 text-[10px]">
                      Build: {readAloudBuildId}
                    </div>
                  )}

                  <label className="reader-panel-label block text-xs mb-1">Voice</label>
                  <select
                    value={ttsVoiceURI}
                    onChange={(e) => setTtsVoiceURI(e.target.value)}
                    className="reader-select w-full rounded-lg px-2.5 py-1.5 text-sm font-body focus:outline-none cursor-pointer"
                  >
                    {voiceOptions.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>

                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="reader-panel-label text-xs">Speed</label>
                      <span className="reader-page-status text-xs">{ttsRate.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min={MIN_TTS_RATE}
                      max={MAX_TTS_RATE}
                      step={0.1}
                      value={ttsRate}
                      onChange={(e) => setTtsRate(Number(e.target.value))}
                      className="reader-slider w-full cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={toggleReadAloud}
                      className="reader-primary-action flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-colors text-sm font-semibold cursor-pointer"
                    >
                      {isReading && !isPaused ? <Pause size={14} /> : <Play size={14} />}
                      {isReading && !isPaused ? 'Pause' : isPaused ? 'Resume' : 'Read From Here'}
                    </button>
                    <button
                      type="button"
                      onClick={handleReadStopClick}
                      disabled={!isReading}
                      className="reader-secondary-action inline-flex items-center justify-center px-3 py-2 rounded-lg transition-colors disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                      title="Stop"
                    >
                      <Square size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="reader-separator w-px h-5 mx-1 hidden sm:block" />

            {/* Characters toggle */}
            <button
              type="button"
              onClick={() => setShowCharacterPortraits((v) => !v)}
              className={`
                reader-characters-toggle hidden sm:inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-semibold
                transition-all duration-200 cursor-pointer
                ${showCharacterPortraits
                  ? 'reader-control-button-active'
                  : ''
                }
              `}
              title="Toggle character portraits"
            >
              <Users size={16} />
            </button>

            {/* Page indicator */}
            <span className="reader-page-status text-xs ml-1">
              Pg {displayPage}
            </span>

            {/* Writing Tools */}
            <button
              type="button"
              onClick={() => openWritingTools()}
              className="reader-control-button p-1.5 rounded-lg transition-all cursor-pointer group hidden sm:inline-flex"
              title="Writing Tools"
            >
              <Wrench size={16} className="group-hover:rotate-[-15deg] transition-transform duration-200" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area — fills remaining viewport exactly */}
      <div className="reader-stage flex-1 min-h-0 px-1 sm:px-6 py-1 sm:py-4">
        <div className="h-full max-w-[95vw] mx-auto">
          <BookPage
            content={currentChapter?.content || ''}
            chapterTitle={currentChapter?.title ?? null}
            showCharacterPortraits={showCharacterPortraits}
            characters={characters}
            chapterContext={readerChapterContext}
            fontSize={fontSize}
            fontCss={fontConfig.css}
            columnCount={columnCount}
            columnGap={COLUMN_GAP}
            spreadIndex={spreadIndex}
            onTotalSpreadsChange={handleTotalSpreadsChange}
            onPagesTextChange={setChapterPagesText}
            activeReadPageIndex={activeReadPageIndex}
            activeReadCharIndex={activeReadCharIndex}
            activeReadTokenIndex={activeReadTokenIndex}
            onReadAnchorChange={handleReadAnchorChange}
            readAloudMode={readAloudInteractionMode}
            onReadAnchorActivate={handleReadAnchorActivate}
          />
        </div>
      </div>

      {/* Bottom Controls */}
      <ReaderControls
        onPrev={goPrev}
        onNext={goNext}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        currentPage={spreadIndex}
        totalPages={totalSpreads}
        chapterTitle={currentChapter?.title ?? ''}
        step={1}
      />
    </div>
  );
}
