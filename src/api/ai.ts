import { getUserId } from './client';
import type { ChapterContext } from '@/components/layout/WritingToolsContext';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '') + '/api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Tracks the latest prompt version received from the server. */
let _lastKnownPromptVersion: string | null = null;

/** Get the latest system prompt version seen from the server. */
export function getPromptVersion(): string | null {
  return _lastKnownPromptVersion;
}

/**
 * Stream a chat response from the AI endpoint.
 * Yields content chunks as they arrive via SSE.
 */
export async function* streamChat(
  messages: ChatMessage[],
  chapterContext?: ChapterContext | null,
): AsyncGenerator<string> {
  const response = await fetch(`${BASE}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': getUserId(),
    },
    body: JSON.stringify({
      messages,
      chapterContext: chapterContext ?? undefined,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI error ${response.status}: ${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        if (parsed.promptVersion) {
          _lastKnownPromptVersion = parsed.promptVersion;
          continue;
        }
        if (parsed.content) {
          yield parsed.content;
        }
        if (parsed.error) {
          throw new Error(parsed.error);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}
