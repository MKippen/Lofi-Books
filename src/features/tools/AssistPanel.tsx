import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, RotateCcw, Ghost, BookOpen, Sparkles } from 'lucide-react';
import { streamChat, getPromptVersion } from '@/api/ai';
import { getUserId } from '@/api/client';
import type { ChatMessage } from '@/api/ai';
import type { ChapterContext } from '@/components/layout/WritingToolsContext';

const MAX_MESSAGES = 30;
const WARN_THRESHOLD = 25;

const GREETING: ChatMessage = {
  role: 'assistant',
  content: "Yo~ I'm Hanako! Your ghostly writing buddy~ I can help you polish your writing, check your flow, and point out things you might want to think about. But hey — your story is YOUR story. I'm just here to help you make it shine! What are you working on?",
};

// Quick prompts when chapter context is available — editorial feedback on her writing
const CHAPTER_PROMPTS = [
  'How does my flow feel?',
  'Anything confusing?',
  'Am I showing or telling?',
  'How is my pacing?',
  'Check my dialogue',
  'Are my descriptions clear?',
  'Does the opening hook?',
  'Anything feel repetitive?',
];

// Quick prompts without chapter context — general writing craft questions
const GENERAL_PROMPTS = [
  'Better dialogue tips?',
  'How to describe a scene?',
  'Show, don\'t tell?',
  'Good opening lines?',
  'Building suspense?',
  'Writing a cliffhanger?',
  'First vs third person?',
  'Making characters real?',
];

interface AssistPanelProps {
  chapterContext: ChapterContext | null;
}

export default function AssistPanel({ chapterContext }: AssistPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [promptsOpen, setPromptsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const promptsRef = useRef<HTMLDivElement>(null);

  const userIdRef = useRef(getUserId());
  const sessionVersionRef = useRef<string | null>(null);

  // Reset session if the logged-in user changes (e.g. account switch)
  useEffect(() => {
    const currentId = getUserId();
    if (currentId !== userIdRef.current) {
      userIdRef.current = currentId;
      setMessages([GREETING]);
      setInput('');
      setStreaming(false);
      setError('');
    }
  });

  // Close prompts dropdown on outside click
  useEffect(() => {
    if (!promptsOpen) return;
    function handleClick(e: MouseEvent) {
      if (promptsRef.current && !promptsRef.current.contains(e.target as Node)) {
        setPromptsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [promptsOpen]);

  // Count user messages for limit
  const userMessageCount = messages.filter((m) => m.role === 'user').length;

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleNewSession = () => {
    abortRef.current?.abort();
    setMessages([GREETING]);
    setInput('');
    setStreaming(false);
    setError('');
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;

    if (userMessageCount >= MAX_MESSAGES) {
      setError("You've reached the message limit for this session~ Start a new session to keep chatting!");
      return;
    }

    setError('');
    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setStreaming(true);

    // Add placeholder for assistant response
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      // Only send user/assistant messages (not the initial greeting)
      const apiMessages = updatedMessages.filter(
        (_, i) => i > 0, // skip the greeting which is client-only
      );

      const stream = streamChat(apiMessages, chapterContext);

      for await (const chunk of stream) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last.role === 'assistant') {
            copy[copy.length - 1] = { ...last, content: last.content + chunk };
          }
          return copy;
        });
        scrollToBottom();
      }
    } catch (err) {
      console.error('Hanako chat error:', err);
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last.role === 'assistant' && last.content === '') {
          // Remove the empty placeholder
          copy.pop();
        }
        return copy;
      });
      setError('Hmm, something went wrong with the ghostly connection~ Try again?');
    } finally {
      setStreaming(false);

      // Check if the system prompt version changed — force session reset if so
      const currentVersion = getPromptVersion();
      if (sessionVersionRef.current && currentVersion && currentVersion !== sessionVersionRef.current) {
        handleNewSession();
      }
      if (currentVersion) {
        sessionVersionRef.current = currentVersion;
      }
    }
  };

  const handleSend = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = chapterContext ? CHAPTER_PROMPTS : GENERAL_PROMPTS;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-2 text-indigo">
          <Ghost size={18} className="text-primary" />
          <h2 className="font-heading text-base">Hanako</h2>
          <span className="text-[10px] text-indigo/30">your ghostly writing buddy~</span>
        </div>
        <button
          type="button"
          onClick={handleNewSession}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-indigo/40 hover:text-indigo hover:bg-primary/10 transition-colors cursor-pointer"
          title="New Session"
        >
          <RotateCcw size={12} />
          New
        </button>
      </div>

      {/* Chapter context badge */}
      {chapterContext && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 mb-2 rounded-lg bg-primary/5 border border-primary/10">
          <BookOpen size={12} className="text-primary/50 shrink-0" />
          <span className="text-[11px] text-indigo/50 truncate">
            Reading: <span className="font-semibold text-indigo/70">{chapterContext.title}</span>
            <span className="text-indigo/30"> ({chapterContext.wordCount} words)</span>
          </span>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary/10 text-indigo rounded-br-md'
                  : 'bg-cream border border-primary/10 text-indigo/80 rounded-bl-md'
              }`}
            >
              {msg.role === 'assistant' && (
                <span className="text-xs mr-1.5 opacity-50">👻</span>
              )}
              {msg.content || (
                <span className="inline-flex items-center gap-1 text-indigo/30 italic text-xs">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse [animation-delay:150ms]" />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse [animation-delay:300ms]" />
                  Hanako is thinking...
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-secondary mt-2 px-1">{error}</p>
      )}

      {/* Input */}
      <div className="mt-2 flex gap-2 relative">
        {/* Quick prompts dropdown */}
        <div ref={promptsRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setPromptsOpen((v) => !v)}
            disabled={streaming}
            className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
              promptsOpen
                ? 'bg-primary/15 border-primary/30 text-primary'
                : 'border-primary/15 bg-cream text-primary/50 hover:bg-primary/10 hover:text-primary'
            }`}
            title="Quick prompts"
          >
            <Sparkles size={16} />
          </button>

          {/* Dropdown popover — opens upward */}
          {promptsOpen && (
            <div className="absolute bottom-12 left-0 z-50 w-56 rounded-xl border border-primary/15 bg-white shadow-lg py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-3 py-1.5 text-[10px] font-medium text-indigo/30 uppercase tracking-wide">
                {chapterContext ? 'About your chapter' : 'Writing tips'}
              </div>
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    sendMessage(prompt);
                    setPromptsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-[12px] text-indigo/70 hover:bg-primary/8 hover:text-indigo transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Hanako..."
          rows={1}
          disabled={streaming}
          className="flex-1 resize-none rounded-xl border border-primary/15 bg-cream px-3 py-2.5 text-sm text-indigo placeholder:text-indigo/30 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || streaming}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          title="Send"
        >
          <Send size={16} />
        </button>
      </div>

      {/* Message counter */}
      <div className="flex items-center justify-between mt-2 px-1">
        <span className={`text-[10px] ${
          userMessageCount >= WARN_THRESHOLD ? 'text-secondary' : 'text-indigo/25'
        }`}>
          {userMessageCount}/{MAX_MESSAGES} messages
        </span>
        {userMessageCount >= WARN_THRESHOLD && userMessageCount < MAX_MESSAGES && (
          <span className="text-[10px] text-secondary">Almost at the limit~</span>
        )}
      </div>
    </div>
  );
}
