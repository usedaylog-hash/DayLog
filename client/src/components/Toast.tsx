import { useState, useEffect, useCallback } from 'react';
import styles from './Toast.module.css';

interface Props {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, onUndo, onDismiss, duration = 5000 }: Props) {
  const [exiting, setExiting] = useState(false);

  const startExit = useCallback(() => {
    setExiting(true);
    setTimeout(onDismiss, 200);
  }, [onDismiss]);

  useEffect(() => {
    const timer = setTimeout(startExit, duration);
    return () => clearTimeout(timer);
  }, [startExit, duration]);

  return (
    <div className={`${styles.toast} ${exiting ? styles.exiting : ''}`}>
      <span>{message}</span>
      <button className={styles.undoBtn} onClick={onUndo}>Undo</button>
    </div>
  );
}
