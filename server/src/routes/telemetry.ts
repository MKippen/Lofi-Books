import { Router } from 'express';

export const telemetryRouter = Router();

type TelemetrySeverity = 'debug' | 'info' | 'warn' | 'error';

interface ClientTelemetryEvent {
  event: string;
  scope?: string;
  severity?: TelemetrySeverity;
  clientTs?: string;
  path?: string;
  sessionId?: string;
  seq?: number;
  props?: Record<string, unknown>;
}

const MAX_EVENTS_PER_REQUEST = 50;
const MAX_EVENT_NAME_LEN = 80;
const MAX_SCOPE_LEN = 40;
const MAX_SESSION_ID_LEN = 120;
const MAX_PATH_LEN = 300;
const MAX_PROP_KEY_LEN = 80;
const MAX_PROP_STRING_LEN = 400;

function trimString(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function sanitizeProps(raw: unknown): Record<string, string | number | boolean | null> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(raw)) {
    const safeKey = trimString(key, MAX_PROP_KEY_LEN);
    if (!safeKey) continue;

    if (value == null) {
      out[safeKey] = null;
      continue;
    }
    if (typeof value === 'string') {
      out[safeKey] = value.slice(0, MAX_PROP_STRING_LEN);
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[safeKey] = value;
      continue;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeEvent(raw: unknown): ClientTelemetryEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const event = trimString(rec.event, MAX_EVENT_NAME_LEN);
  if (!event) return null;

  const scope = trimString(rec.scope, MAX_SCOPE_LEN);
  const severityRaw = trimString(rec.severity, 10);
  const severity = (
    severityRaw === 'debug'
      || severityRaw === 'info'
      || severityRaw === 'warn'
      || severityRaw === 'error'
  ) ? severityRaw : 'info';

  return {
    event,
    scope,
    severity,
    clientTs: trimString(rec.clientTs, 64),
    path: trimString(rec.path, MAX_PATH_LEN),
    sessionId: trimString(rec.sessionId, MAX_SESSION_ID_LEN),
    seq: typeof rec.seq === 'number' ? rec.seq : undefined,
    props: sanitizeProps(rec.props),
  };
}

telemetryRouter.post('/client', (req, res) => {
  const userId = (req as any).userId as string || '';
  const userEmail = (req as any).userEmail as string || '';

  const payload = req.body as { events?: unknown[]; event?: unknown } | undefined;
  const rawEvents: unknown[] = Array.isArray(payload?.events)
    ? payload.events
    : payload?.event != null
      ? [payload.event]
      : [];

  const accepted: ClientTelemetryEvent[] = [];
  for (const raw of rawEvents.slice(0, MAX_EVENTS_PER_REQUEST)) {
    const normalized = normalizeEvent(raw);
    if (normalized) accepted.push(normalized);
  }

  const receivedAt = new Date().toISOString();
  for (const event of accepted) {
    const line = {
      receivedAt,
      userId,
      userEmail,
      sourceIp: req.ip,
      userAgent: trimString(req.headers['user-agent'], 220),
      ...event,
    };
    console.log('[client-telemetry]', JSON.stringify(line));
  }

  res.json({
    ok: true,
    accepted: accepted.length,
    dropped: Math.max(0, rawEvents.length - accepted.length),
  });
});
