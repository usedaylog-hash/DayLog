import { Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { TodayPage } from './pages/TodayPage';
import { HistoryPage } from './pages/HistoryPage';
import { TestRunsPage } from './pages/TestRunsPage';
import { TestRunDetailPage } from './pages/TestRunDetailPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { InvoicesPage } from './pages/InvoicesPage';

export function App() {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/test-runs" element={<TestRunsPage />} />
          <Route path="/test-runs/:filename" element={<TestRunDetailPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
