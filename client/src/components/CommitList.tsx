import { useState } from 'react';
import type { Commit } from '../types';
import styles from './CommitList.module.css';

interface Props {
  commits: Commit[];
  onComment: (id: number, comment: string) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CommitCard({ commit, onComment }: { commit: Commit; onComment: Props['onComment'] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(commit.comment || '');

  function handleSubmit() {
    onComment(commit.id, draft);
    setEditing(false);
  }

  return (
    <li className={styles.card}>
      <div className={styles.header}>
        <code className={styles.hash}>{commit.hash.slice(0, 7)}</code>
        <span className={styles.message}>{commit.message}</span>
        <span className={styles.time}>{formatTime(commit.timestamp)}</span>
      </div>

      {commit.comment && !editing && (
        <p className={styles.comment} onClick={() => setEditing(true)}>
          {commit.comment}
        </p>
      )}

      {editing ? (
        <form className={styles.commentForm} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <input
            className={styles.commentInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment..."
            autoFocus
            onBlur={handleSubmit}
          />
        </form>
      ) : (
        !commit.comment && (
          <button className={styles.addComment} onClick={() => setEditing(true)}>
            add comment
          </button>
        )
      )}
    </li>
  );
}

export function CommitList({ commits, onComment }: Props) {
  if (commits.length === 0) {
    return (
      <p className={styles.empty}>
        No commits yet — commits to BlackBox will appear here automatically
      </p>
    );
  }

  return (
    <ul className={styles.list}>
      {commits.map((c) => (
        <CommitCard key={c.id} commit={c} onComment={onComment} />
      ))}
    </ul>
  );
}
