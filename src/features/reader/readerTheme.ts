import { useEffect, useMemo, useState } from 'react';
import { generateReaderTheme } from '@/api/ai';

export type ReaderMood = 'studio-soft' | 'sunwash-paper' | 'moonlit-noir' | 'neon-circuit' | 'dream-haze';

interface SampledColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  weight: number;
}

interface ReaderThemeDefinition {
  accent: string;
  accentSoft: string;
  background: string;
  glow: string;
  ink: string;
  line: string;
  muted: string;
  panel: string;
  page: string;
  pageEdge: string;
  pageNumber: string;
  progressTrack: string;
  shadow: string;
  spotlight: string;
}

export interface ReaderTheme {
  badge: string;
  mood: ReaderMood;
  palette: string[];
  style: Record<string, string>;
}

interface ReaderThemeSeed {
  badge?: string;
  mood?: ReaderMood;
  palette?: string[];
  title: string;
}

interface UseReaderThemeOptions {
  bookId: string | null | undefined;
  coverImageId: string | null | undefined;
  coverUrl: string | null;
  description?: string;
  genre?: string;
  title: string;
}

const FALLBACK_THEME: ReaderTheme = {
  badge: 'Studio Soft',
  mood: 'studio-soft',
  palette: ['#7c9a6e', '#c4836a', '#fdfbf7'],
  style: themeToStyle({
    accent: '#7c9a6e',
    accentSoft: '#e0ebd9',
    background: '#ede6da',
    glow: 'rgba(124, 154, 110, 0.16)',
    ink: '#2c2c2c',
    line: 'rgba(44, 44, 44, 0.12)',
    muted: 'rgba(44, 44, 44, 0.64)',
    panel: 'rgba(253, 251, 247, 0.86)',
    page: '#fffdf9',
    pageEdge: '#f4eee3',
    pageNumber: 'rgba(44, 44, 44, 0.38)',
    progressTrack: 'rgba(44, 44, 44, 0.08)',
    shadow: 'rgba(61, 45, 20, 0.16)',
    spotlight: 'rgba(212, 167, 106, 0.18)',
  }),
};

const TITLE_HINTS: Array<{ mood: ReaderMood; pattern: RegExp }> = [
  { mood: 'neon-circuit', pattern: /\b(glitch|cyber|neon|future|machine|circuit|chrome|signal|void)\b/i },
  { mood: 'moonlit-noir', pattern: /\b(shadow|night|midnight|dark|black|ghost|smoke|wolf)\b/i },
  { mood: 'dream-haze', pattern: /\b(dream|star|moon|mist|echo|cloud|secret|sky)\b/i },
  { mood: 'sunwash-paper', pattern: /\b(sun|gold|garden|summer|home|heart|light|paper)\b/i },
];

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const compact = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  return {
    r: parseInt(compact.slice(0, 2), 16),
    g: parseInt(compact.slice(2, 4), 16),
    b: parseInt(compact.slice(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  if (delta !== 0) {
    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha)})`;
}

function mixColors(colorA: string, colorB: string, amount: number): string {
  const ratio = clamp(amount);
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);

  return rgbToHex(
    Math.round(a.r + (b.r - a.r) * ratio),
    Math.round(a.g + (b.g - a.g) * ratio),
    Math.round(a.b + (b.b - a.b) * ratio),
  );
}

function colorDistance(colorA: string, colorB: string): number {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  return Math.sqrt(
    (a.r - b.r) ** 2 +
    (a.g - b.g) ** 2 +
    (a.b - b.b) ** 2,
  );
}

function pickDistinctColors(colors: SampledColor[]): SampledColor[] {
  const selected: SampledColor[] = [];

  for (const color of colors) {
    if (selected.every((entry) => colorDistance(entry.hex, color.hex) > 72)) {
      selected.push(color);
    }
    if (selected.length === 3) break;
  }

  return selected.length > 0 ? selected : colors.slice(0, 3);
}

function detectMood(colors: SampledColor[], title: string): ReaderMood {
  if (colors.length === 0) {
    const hinted = TITLE_HINTS.find((entry) => entry.pattern.test(title));
    return hinted?.mood ?? FALLBACK_THEME.mood;
  }

  const totalWeight = colors.reduce((sum, color) => sum + color.weight, 0) || 1;
  const averageLightness = colors.reduce((sum, color) => sum + color.hsl.l * color.weight, 0) / totalWeight;
  const averageSaturation = colors.reduce((sum, color) => sum + color.hsl.s * color.weight, 0) / totalWeight;
  const coolBias = colors.reduce((sum, color) => {
    const { r, b } = color.rgb;
    return sum + ((b - r) / 255) * color.weight;
  }, 0) / totalWeight;
  const contrast = Math.max(...colors.map((color) => color.hsl.l)) - Math.min(...colors.map((color) => color.hsl.l));

  if (averageLightness < 0.33 && averageSaturation > 0.28) return 'neon-circuit';
  if (averageLightness < 0.42 && contrast > 0.18) return 'moonlit-noir';
  if (averageLightness > 0.64 && coolBias < 0.04) return 'sunwash-paper';
  if (averageSaturation > 0.24 || coolBias > 0.08) return 'dream-haze';
  return 'studio-soft';
}

function createDefinition(mood: ReaderMood, palette: string[]): ReaderThemeDefinition {
  const [dominant, accentRaw, supportRaw] = palette;
  const accent = accentRaw ?? dominant;
  const support = supportRaw ?? mixColors(dominant, accent, 0.5);

  switch (mood) {
    case 'neon-circuit': {
      const background = mixColors('#040814', dominant, 0.3);
      const panel = rgba(mixColors(background, accent, 0.18), 0.9);
      const page = mixColors('#0c1320', support, 0.18);
      return {
        accent: mixColors(accent, '#8ff6ff', 0.24),
        accentSoft: mixColors(background, accent, 0.32),
        background,
        glow: rgba(accent, 0.2),
        ink: '#edf7ff',
        line: rgba('#edf7ff', 0.12),
        muted: 'rgba(237, 247, 255, 0.68)',
        panel,
        page,
        pageEdge: mixColors(page, '#1c2740', 0.48),
        pageNumber: 'rgba(237, 247, 255, 0.46)',
        progressTrack: 'rgba(237, 247, 255, 0.1)',
        shadow: 'rgba(1, 4, 12, 0.58)',
        spotlight: rgba(accent, 0.12),
      };
    }
    case 'moonlit-noir': {
      const background = mixColors('#111111', dominant, 0.26);
      const page = mixColors('#181818', support, 0.14);
      return {
        accent: mixColors(accent, '#f1dcc4', 0.18),
        accentSoft: mixColors(background, accent, 0.24),
        background,
        glow: rgba(accent, 0.13),
        ink: '#f6efe7',
        line: 'rgba(246, 239, 231, 0.12)',
        muted: 'rgba(246, 239, 231, 0.68)',
        panel: rgba(mixColors(background, '#2a211c', 0.42), 0.9),
        page,
        pageEdge: mixColors(page, '#2b231f', 0.55),
        pageNumber: 'rgba(246, 239, 231, 0.42)',
        progressTrack: 'rgba(246, 239, 231, 0.09)',
        shadow: 'rgba(0, 0, 0, 0.54)',
        spotlight: rgba(accent, 0.08),
      };
    }
    case 'sunwash-paper': {
      const background = mixColors('#efe4d5', dominant, 0.12);
      const page = mixColors('#fffaf0', support, 0.08);
      return {
        accent: mixColors(accent, '#8c5f39', 0.16),
        accentSoft: mixColors(page, accent, 0.14),
        background,
        glow: rgba(accent, 0.16),
        ink: mixColors('#261b16', dominant, 0.14),
        line: 'rgba(38, 27, 22, 0.11)',
        muted: 'rgba(38, 27, 22, 0.64)',
        panel: rgba(mixColors('#f8f1e7', accent, 0.08), 0.92),
        page,
        pageEdge: mixColors(page, '#e6d9c5', 0.52),
        pageNumber: 'rgba(38, 27, 22, 0.42)',
        progressTrack: 'rgba(38, 27, 22, 0.08)',
        shadow: 'rgba(99, 74, 48, 0.18)',
        spotlight: 'rgba(255, 223, 170, 0.2)',
      };
    }
    case 'dream-haze': {
      const background = mixColors('#e8edf6', dominant, 0.14);
      const page = mixColors('#fafcff', support, 0.1);
      return {
        accent: mixColors(accent, '#7c90c9', 0.12),
        accentSoft: mixColors(page, accent, 0.18),
        background,
        glow: rgba(accent, 0.18),
        ink: mixColors('#27334d', dominant, 0.12),
        line: 'rgba(39, 51, 77, 0.1)',
        muted: 'rgba(39, 51, 77, 0.62)',
        panel: rgba(mixColors('#f4f7fd', accent, 0.08), 0.92),
        page,
        pageEdge: mixColors(page, '#dfe6f4', 0.52),
        pageNumber: 'rgba(39, 51, 77, 0.4)',
        progressTrack: 'rgba(39, 51, 77, 0.08)',
        shadow: 'rgba(55, 78, 123, 0.15)',
        spotlight: rgba(accent, 0.14),
      };
    }
    default: {
      const background = mixColors('#ece5d9', dominant, 0.1);
      const page = mixColors('#fefcf8', support, 0.08);
      return {
        accent: mixColors(accent, '#5f776e', 0.12),
        accentSoft: mixColors(page, accent, 0.14),
        background,
        glow: rgba(accent, 0.12),
        ink: mixColors('#2c2c2c', dominant, 0.08),
        line: 'rgba(44, 44, 44, 0.1)',
        muted: 'rgba(44, 44, 44, 0.62)',
        panel: rgba(mixColors('#faf7f1', accent, 0.06), 0.92),
        page,
        pageEdge: mixColors(page, '#ece4d8', 0.5),
        pageNumber: 'rgba(44, 44, 44, 0.38)',
        progressTrack: 'rgba(44, 44, 44, 0.08)',
        shadow: 'rgba(77, 63, 44, 0.14)',
        spotlight: 'rgba(212, 167, 106, 0.14)',
      };
    }
  }
}

function themeToStyle(definition: ReaderThemeDefinition): Record<string, string> {
  const darkMode = luminance(definition.background) < 0.18;
  const displayFont = darkMode
    ? '"JetBrains Mono", "Nunito", sans-serif'
    : '"Zen Maru Gothic", "Kosugi Maru", sans-serif';

  return {
    '--reader-theme-accent': definition.accent,
    '--reader-theme-accent-soft': definition.accentSoft,
    '--reader-theme-background': definition.background,
    '--reader-theme-glow': definition.glow,
    '--reader-theme-ink': definition.ink,
    '--reader-theme-line': definition.line,
    '--reader-theme-muted': definition.muted,
    '--reader-theme-panel': definition.panel,
    '--reader-theme-page': definition.page,
    '--reader-theme-page-edge': definition.pageEdge,
    '--reader-theme-page-number': definition.pageNumber,
    '--reader-theme-progress-track': definition.progressTrack,
    '--reader-theme-shadow': definition.shadow,
    '--reader-theme-spotlight': definition.spotlight,
    '--reader-theme-display-font': displayFont,
    '--reader-theme-highlight': rgba(definition.accent, darkMode ? 0.34 : 0.24),
    '--reader-theme-highlight-ink': darkMode ? '#08111e' : definition.ink,
  };
}

function moodBadge(mood: ReaderMood): string {
  switch (mood) {
    case 'neon-circuit':
      return 'Neon Circuit';
    case 'moonlit-noir':
      return 'Moonlit Noir';
    case 'sunwash-paper':
      return 'Sunwash Paper';
    case 'dream-haze':
      return 'Dream Haze';
    default:
      return 'Studio Soft';
  }
}

async function sampleCoverColors(imageUrl: string): Promise<SampledColor[]> {
  const image = new Image();
  image.decoding = 'async';

  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Unable to load cover image'));
  });

  image.src = imageUrl;
  await loaded;

  const canvas = document.createElement('canvas');
  const size = 56;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas unavailable');

  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

  for (let index = 0; index < pixels.length; index += 16) {
    const alpha = pixels[index + 3];
    if (alpha < 180) continue;

    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const bucketKey = [r, g, b].map((value) => Math.round(value / 24) * 24).join(':');
    const entry = buckets.get(bucketKey) ?? { count: 0, r: 0, g: 0, b: 0 };

    entry.count += 1;
    entry.r += r;
    entry.g += g;
    entry.b += b;
    buckets.set(bucketKey, entry);
  }

  return Array.from(buckets.values())
    .filter((bucket) => bucket.count > 2)
    .map((bucket) => {
      const r = Math.round(bucket.r / bucket.count);
      const g = Math.round(bucket.g / bucket.count);
      const b = Math.round(bucket.b / bucket.count);
      return {
        hex: rgbToHex(r, g, b),
        hsl: rgbToHsl(r, g, b),
        rgb: { r, g, b },
        weight: bucket.count,
      };
    })
    .sort((a, b) => {
      const aScore = a.weight * (0.8 + a.hsl.s * 0.6);
      const bScore = b.weight * (0.8 + b.hsl.s * 0.6);
      return bScore - aScore;
    });
}

export function createReaderTheme(seed: ReaderThemeSeed): ReaderTheme {
  const cleanedPalette = (seed.palette ?? [])
    .filter((color) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color))
    .map((color) => color.toLowerCase());
  const selected = pickDistinctColors(cleanedPalette.map((hex) => {
    const rgb = hexToRgb(hex);
    return {
      hex,
      hsl: rgbToHsl(rgb.r, rgb.g, rgb.b),
      rgb,
      weight: 1,
    };
  }));
  const palette = selected.map((color) => color.hex);
  const mood = seed.mood ?? detectMood(selected, seed.title);
  const basePalette = palette.length > 0 ? palette : FALLBACK_THEME.palette;
  const definition = createDefinition(mood, [
    basePalette[0] ?? FALLBACK_THEME.palette[0],
    basePalette[1] ?? FALLBACK_THEME.palette[1],
    basePalette[2] ?? FALLBACK_THEME.palette[2],
  ]);

  return {
    badge: seed.badge?.trim() || moodBadge(mood),
    mood,
    palette: basePalette,
    style: themeToStyle(definition),
  };
}

function buildTheme(colors: SampledColor[], title: string): ReaderTheme {
  return createReaderTheme({
    mood: detectMood(pickDistinctColors(colors), title),
    palette: pickDistinctColors(colors).map((color) => color.hex),
    title,
  });
}

export function useReaderTheme({
  bookId,
  coverImageId,
  coverUrl,
  description = '',
  genre = '',
  title,
}: UseReaderThemeOptions): ReaderTheme {
  const [aiTheme, setAiTheme] = useState<ReaderTheme | null>(null);
  const [sampledTheme, setSampledTheme] = useState<ReaderTheme | null>(null);
  const aiCacheKey = useMemo(() => (
    bookId
      ? `reader-ai-theme:${bookId}:${coverImageId ?? 'none'}:${title.toLowerCase()}`
      : null
  ), [bookId, coverImageId, title]);

  const fallbackTheme = useMemo(() => {
    const hintedMood = detectMood([], title);
    if (hintedMood === FALLBACK_THEME.mood) return FALLBACK_THEME;
    return createReaderTheme({ mood: hintedMood, title });
  }, [title]);

  useEffect(() => {
    let active = true;

    if (!coverUrl) {
      setSampledTheme(null);
      return () => { active = false; };
    }

    void sampleCoverColors(coverUrl)
      .then((colors) => {
        if (!active) return;
        setSampledTheme(buildTheme(colors, title));
      })
      .catch(() => {
        if (!active) return;
        setSampledTheme(null);
      });

    return () => {
      active = false;
    };
  }, [coverUrl, title]);

  useEffect(() => {
    let active = true;

    if (!bookId || !aiCacheKey) {
      setAiTheme(null);
      return () => { active = false; };
    }

    try {
      const cached = localStorage.getItem(aiCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { badge?: string; mood?: ReaderMood; palette?: string[] };
        setAiTheme(createReaderTheme({
          badge: parsed.badge,
          mood: parsed.mood,
          palette: parsed.palette,
          title,
        }));
      } else {
        setAiTheme(null);
      }
    } catch {
      setAiTheme(null);
    }

    void generateReaderTheme({
      bookId,
      coverImageId: coverImageId ?? null,
      description,
      genre,
      title,
    })
      .then((result) => {
        if (!active) return;
        const nextTheme = createReaderTheme({
          badge: result.badge,
          mood: result.mood,
          palette: result.palette,
          title,
        });
        setAiTheme(nextTheme);
        try {
          localStorage.setItem(aiCacheKey, JSON.stringify({
            badge: nextTheme.badge,
            mood: nextTheme.mood,
            palette: nextTheme.palette,
          }));
        } catch {
          // Ignore storage failures.
        }
      })
      .catch(() => {
        if (!active) return;
      });

    return () => {
      active = false;
    };
  }, [aiCacheKey, bookId, coverImageId, description, genre, title]);

  return aiTheme ?? sampledTheme ?? fallbackTheme;
}
