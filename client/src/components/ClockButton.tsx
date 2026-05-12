import styles from './ClockButton.module.css';

interface Props {
  isClockedIn: boolean;
  loading: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
}

export function ClockButton({ isClockedIn, loading, onClockIn, onClockOut }: Props) {
  return (
    <button
      className={`${styles.button} ${isClockedIn ? styles.out : styles.in}`}
      onClick={isClockedIn ? onClockOut : onClockIn}
      disabled={loading}
    >
      {loading
        ? 'Working...'
        : isClockedIn
          ? 'Clock Out'
          : 'Clock In'}
    </button>
  );
}
