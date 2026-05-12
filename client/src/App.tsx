import { Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { TodayPage } from './pages/TodayPage';
import { HistoryPage } from './pages/HistoryPage';

export function App() {
  return (
    <>
      <Header />
      <main style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
