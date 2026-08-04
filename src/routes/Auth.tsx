import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const send = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setStatus('sending');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setStatus('error');
      setMessage(error.message);
    } else {
      setStatus('sent');
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6">
      <h1 className="text-3xl font-semibold">Vector</h1>
      <p className="mt-2 text-slate-300">
        Trend-based physique tracking that tells you what to do next.
      </p>

      {status === 'sent' ? (
        <div className="card mt-8">
          <p className="font-medium">Check your email.</p>
          <p className="mt-1 text-sm muted">
            We sent a sign-in link to {email}. Open it on this device.
          </p>
        </div>
      ) : (
        <form onSubmit={send} className="mt-8 space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email address"
            className="w-full rounded-xl bg-ink-800 px-4 py-3 outline-none ring-1 ring-ink-700 focus:ring-2 focus:ring-accent/60"
          />
          <button type="submit" disabled={status === 'sending'} className="btn-primary w-full">
            {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
          </button>
          {status === 'error' ? <p className="text-sm text-danger">{message}</p> : null}
        </form>
      )}
    </div>
  );
}
