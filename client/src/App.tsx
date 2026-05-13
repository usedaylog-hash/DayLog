import { Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { TodayPage } from './pages/TodayPage';
import { HistoryPage } from './pages/HistoryPage';
import { TestRunsPage } from './pages/TestRunsPage';
import { TestRunDetailPage } from './pages/TestRunDetailPage';

export function App() {
  return (
    <>
      <Header />
      <main style={{ padding: '1.5rem 1rem' }}>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/test-runs" element={<TestRunsPage />} />
          <Route path="/test-runs/:filename" element={<TestRunDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
