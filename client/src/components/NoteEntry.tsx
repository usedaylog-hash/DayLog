import { useState } from 'react';
import styles from './NoteEntry.module.css';

interface Props {
  onSubmit: (content: string) => void;
  disabled: boolean;
}

export function NoteEntry({ onSubmit, disabled }: Props) {
  const [content, setContent] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setContent('');
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder={disabled ? 'Clock in to add notes...' : 'What are you working on?'}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || !content.trim()}>
        Add
      </button>
    </form>
  );
}
