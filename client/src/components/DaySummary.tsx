import styles from './DaySummary.module.css';

interface Props {
  summary: string;
}

export function DaySummary({ summary }: Props) {
  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>Summary</h3>
      <p className={styles.text}>{summary}</p>
    </div>
  );
}
