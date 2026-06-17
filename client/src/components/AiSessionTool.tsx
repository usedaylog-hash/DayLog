import { useState } from 'react';
import type { Commit } from '../types';
import { api } from '../api/client';
import styles from './AiSessionTool.module.css';

interface Props {
  commits: Commit[];
  currentNote: string;
  summary?: string | null;
  onApplyNote: (text: string) => void;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const systemInstructions = `You are DayLog's AI assistant. Help the user write handoff notes, summarize the session, and suggest next steps. Keep responses concise, action-oriented, and aligned with the current work context.`;

function buildSessionContext(commits: Commit[], summary?: string | null): string {
  const commitSummary = commits.length
    ? `Commits:\n${commits.slice(0, 4).map((commit, index) => `${index + 1}. ${commit.message}`).join('\n')}`
    : 'No commits were recorded during this session.';

  const summaryText = summary?.trim() || 'No session summary is available yet.';
  return `Session context:\n${commitSummary}\n\nCurrent summary:\n${summaryText}`;
}

export function AiSessionTool({ commits, currentNote, summary, onApplyNote }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Gemini Flash is ready. Ask me to summarize the session, draft a handoff note, or polish your current note.',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');

  const handleSend = async () => {
    if (!draft.trim()) {
      return;
    }

    const outgoing: ChatMessage = { role: 'user', content: draft.trim() };
    const updatedMessages = [...messages, outgoing];
    setMessages(updatedMessages);
    setDraft('');
    setLoading(true);
    setError(null);

    try {
      const assistantReply = await api.assistantChat([
        { role: 'system', content: systemInstructions },
        { role: 'system', content: buildSessionContext(commits, summary) },
        ...updatedMessages,
      ]);

      setMessages((prev) => [...prev, { role: 'assistant', content: assistantReply.text.trim() }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (lastAssistant?.content) {
      onApplyNote(lastAssistant.content);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.title}>AI Assistant</p>
          <p className={styles.subtitle}>Chat with Gemini Flash to build the best session handoff note.</p>
        </div>
        <span className={styles.modelBadge}>Gemini Flash</span>
      </div>

      <div className={styles.messageList}>
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`${styles.message} ${message.role === 'user' ? styles.messageUser : styles.messageAssistant}`}
          >
            <div className={styles.messageMeta}>{message.role === 'user' ? 'You' : 'Assistant'}</div>
            <div className={styles.messageText}>{message.content}</div>
          </div>
        ))}
      </div>

      <div className={styles.inputRow}>
        <textarea
          className={styles.input}
          placeholder="Ask the assistant to summarize, draft a handoff, or polish your note..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
        />
        <button type="button" className={styles.chatButton} onClick={handleSend} disabled={loading || !draft.trim()}>
          {loading ? 'Sending…' : 'Send'}
        </button>
      </div>

      <div className={styles.resultActions}>
        <button type="button" className={styles.secondaryButton} onClick={handleApply} disabled={!lastAssistant?.content || loading}>
          Apply last response
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => onApplyNote(currentNote)}
          disabled={loading}
        >
          Keep current note
        </button>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
}
