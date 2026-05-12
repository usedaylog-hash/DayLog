import { useEffect } from 'react';
import styles from './Toast.module.css';

interface Props {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, onUndo, onDismiss, duration = 5000 }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div className={styles.toast}>
      <span>{message}</span>
      <button className={styles.undoBtn} onClick={onUndo}>Undo</button>
    </div>
  );
}
