import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { isConfigured, supabase } from './lib/supabase';
import { flushQueue } from './lib/offlineQueue';
import { BottomNav } from './components/BottomNav';
import { SyncBadge } from './components/SyncBadge';
import Auth from './routes/Auth';
import Today from './routes/Today';
import Log from './routes/Log';
import Progress from './routes/Progress';
import Review from './routes/Review';
import Settings from './routes/Settings';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isConfigured) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // A fresh session is the moment queued offline writes can finally land.
      if (s) void flushQueue();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isConfigured) return <SetupNeeded />;
  if (!ready) return <Splash />;
  if (!session) return <Auth />;

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <Header />
      <main className="flex-1 px-4 pb-24">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/log" element={<Log />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/review" element={<Review />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

function Header() {
  const { pathname } = useLocation();
  const title =
    { '/': 'Today', '/log': 'Log', '/progress': 'Progress', '/review': 'Review', '/settings': 'Settings' }[
      pathname
    ] ?? 'Vector';

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-ink-900/90 px-4 py-3 backdrop-blur">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="flex items-center gap-2">
        <SyncBadge />
        <Link to="/settings" aria-label="Settings" className="rounded-lg p-2 text-slate-400">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.5.68.85 1.22.9H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>
    </header>
  );
}

function Splash() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="muted">Loading…</p>
    </div>
  );
}

function SetupNeeded() {
  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Vector needs a backend</h1>
      <p className="mt-3 text-slate-300">
        Set <code className="rounded bg-ink-700 px-1">VITE_SUPABASE_URL</code> and{' '}
        <code className="rounded bg-ink-700 px-1">VITE_SUPABASE_ANON_KEY</code>, then rebuild.
      </p>
      <p className="mt-3 text-sm muted">See README.md for the full setup steps.</p>
    </div>
  );
}
