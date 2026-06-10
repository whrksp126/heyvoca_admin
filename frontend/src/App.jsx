import React, { useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { checkSession, logout as apiLogout } from './lib/api';
import { Spinner } from './components/ui/primitives';
import AdminShell from './components/shell/AdminShell';
import LoginPage from './features/auth/LoginPage';
import OverviewPage from './features/overview/OverviewPage';
import VocaBooksPage from './features/vocaBooks/VocaBooksPage';
import VocaPage from './features/voca/VocaPage';
import BookstorePage from './features/bookstore/BookstorePage';
import DictSyncPage from './features/dictSync/DictSyncPage';

export default function App() {
  const [status, setStatus] = useState('loading'); // loading | out | in
  const [userId, setUserId] = useState('');

  const refresh = useCallback(async () => {
    try {
      const r = await checkSession();
      if (r?.authenticated) {
        setUserId(r?.data?.user_id || '');
        setStatus('in');
      } else {
        setStatus('out');
      }
    } catch {
      setStatus('out');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleLogout = useCallback(async () => {
    try { await apiLogout(); } catch { /* noop */ }
    setStatus('out');
  }, []);

  if (status === 'loading') {
    return <div className="h-full grid place-items-center"><Spinner label="세션 확인 중…" /></div>;
  }
  if (status === 'out') {
    return <LoginPage onSuccess={refresh} />;
  }

  return (
    <AdminShell userId={userId} onLogout={handleLogout}>
      <Routes>
        <Route path="/overview" element={<OverviewPage onAuthError={handleLogout} />} />
        <Route path="/voca-books" element={<VocaBooksPage onAuthError={handleLogout} />} />
        <Route path="/voca" element={<VocaPage onAuthError={handleLogout} />} />
        <Route path="/bookstore" element={<BookstorePage onAuthError={handleLogout} />} />
        <Route path="/dict-sync" element={<DictSyncPage onAuthError={handleLogout} />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </AdminShell>
  );
}
