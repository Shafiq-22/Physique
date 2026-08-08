import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { startQueueSync } from './lib/offlineQueue';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // The app must open and render from cache with no signal at all.
      networkMode: 'offlineFirst',
    },
  },
});

startQueueSync();

/**
 * Reload once when a new service worker takes over.
 *
 * The worker is registered with `autoUpdate`, so it activates itself — but the
 * already-open page keeps running the old bundle until something reloads it. In
 * a browser tab you would just refresh; in an installed PWA there is no address
 * bar, and the app can sit on a stale build indefinitely. The `reloaded` guard
 * stops this from looping if activation fires more than once.
 */
if ('serviceWorker' in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
