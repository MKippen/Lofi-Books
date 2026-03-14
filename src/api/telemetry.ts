import { getAuthHeaders } from './client';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '') + '/api';
const SESSION_STORAGE_KEY = 'reader-telemetry-session-id';
const MAX_QUEUE = 100;
const BATCH_SIZE = 20;
const FLUSH_DELAY_MS = 1200;

type TelemetrySeverity = 'debug' | 'info' | 'warn' | 'error';

type TelemetryProps = Record<string, string | number | boolean | null | undefined>;

interface ClientTelemetryEvent {
  event: string;
  scope?: string;
  severity?: TelemetrySeverity;
  clientTs: string;
  path: string;
  sessionId: string;
  seq: number;
  props?: Record<string, string | number | boolean | null>;
}

let queue: ClientTelemetryEvent[] = [];
let flushTimer: number | null = null;
let inflight = false;
let seq = 0;
let listenersBound = false;

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const next = window.crypto?.randomUUID?.()
      ?? `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function getBuildId(): string | null {
  if (typeof document === 'undefined') return null;
  const scriptWithHash = Array.from(document.scripts).find((script) => (
    typeof script.src === 'string' && /\/assets\/index-[^/]+\.js/.test(script.src)
  ));
  const match = scriptWithHash?.src.match(/index-([^.]+)\.js/);
  return match?.[1] ?? null;
}

function sanitizeProps(props?: TelemetryProps): Record<string, string | number | boolean | null> | undefined {
  if (!props) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (typeof value === 'string') out[key] = value.slice(0, 400);
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function scheduleFlush(immediate = false): void {
  if (typeof window === 'undefined') return;
  if (flushTimer != null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (immediate) {
    void flushQueue();
    return;
  }
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, FLUSH_DELAY_MS);
}

async function flushQueue(): Promise<void> {
  if (inflight || queue.length === 0) return;
  inflight = true;
  const batch = queue.splice(0, BATCH_SIZE);

  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const response = await fetch(`${BASE}/telemetry/client`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
    if (!response.ok) throw new Error(`Telemetry ${response.status}`);
  } catch {
    queue = [...batch, ...queue].slice(-MAX_QUEUE);
  } finally {
    inflight = false;
    if (queue.length > 0) scheduleFlush(false);
  }
}

function bindWindowFlushHooks(): void {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      scheduleFlush(true);
    }
  });
  window.addEventListener('beforeunload', () => {
    scheduleFlush(true);
  });
}

export function logClientTelemetry(
  event: string,
  props?: TelemetryProps,
  options?: { scope?: string; severity?: TelemetrySeverity },
): void {
  if (typeof window === 'undefined') return;
  bindWindowFlushHooks();

  const payload: ClientTelemetryEvent = {
    event,
    scope: options?.scope ?? 'reader',
    severity: options?.severity ?? 'info',
    clientTs: new Date().toISOString(),
    path: window.location.pathname,
    sessionId: getSessionId(),
    seq: ++seq,
    props: sanitizeProps({
      ...props,
      buildId: getBuildId(),
    }),
  };

  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push(payload);
  scheduleFlush(queue.length >= BATCH_SIZE);
}
