import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

/** True when running as an installed PWA rather than a browser tab. */
const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // iOS Safari predates the standard and exposes its own flag.
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

const CODE_LENGTH = 6;

/**
 * Email sign-in with a typed code.
 *
 * A magic link cannot work in an installed iOS PWA: tapping the link in Mail
 * opens **Safari**, which is a separate browsing context with its own storage,
 * so the session lands somewhere the app can never read. PKCE compounds it — the
 * code verifier is written by whichever context started the sign-in.
 *
 * A one-time code sidesteps the whole problem: it is typed into the app, so the
 * exchange happens in the same context that will hold the session. The link
 * still works for browser use, so both paths are offered and the code is
 * emphasised when we know we are installed.
 */
export default function Auth() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resentAt, setResentAt] = useState<number | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const installed = isStandalone();

  const onSubmitPassword = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) {
      setError(
        /invalid login/i.test(err.message)
          ? 'Wrong email or password. If you have never set a password, use the emailed code instead.'
          : err.message,
      );
    }
  };

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  const sendCode = async (address: string): Promise<boolean> => {
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        shouldCreateUser: true,
        // Only used by the emailed link, which is the browser path.
        emailRedirectTo: window.location.origin,
      },
    });
    if (err) {
      setError(err.message);
      return false;
    }
    return true;
  };

  const onSubmitEmail = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    const ok = await sendCode(email.trim());
    setBusy(false);
    if (ok) setStep('code');
  };

  const onSubmitCode = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError('');

    const token = code.replace(/\D/g, '');
    // Supabase labels this token 'email' for the OTP flow, but older projects
    // issue it as 'magiclink'. Try both rather than fail on a naming detail.
    let err = (await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' })).error;
    if (err) {
      const retry = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: 'magiclink',
      });
      if (!retry.error) err = null;
    }

    setBusy(false);
    if (err) {
      setError(
        /expired|invalid/i.test(err.message)
          ? 'That code did not work. Codes expire after an hour — request a new one.'
          : err.message,
      );
    }
    // On success the auth listener in App swaps this screen out.
  };

  const resend = async (): Promise<void> => {
    setBusy(true);
    const ok = await sendCode(email.trim());
    setBusy(false);
    if (ok) setResentAt(Date.now());
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6">
      <h1 className="text-3xl font-semibold">Vector</h1>
      <p className="mt-2 text-slate-300">
        Trend-based physique tracking that tells you what to do next.
      </p>

      {step === 'email' ? (
        <form onSubmit={onSubmitEmail} className="mt-8 space-y-3">
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
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Sending…' : 'Email me a sign-in code'}
          </button>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="button"
            onClick={() => {
              setStep('password');
              setError('');
            }}
            className="w-full pt-1 text-sm font-medium text-sky-300"
          >
            Use a password instead
          </button>
        </form>
      ) : step === 'password' ? (
        <form onSubmit={onSubmitPassword} className="mt-8 space-y-3">
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
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            className="w-full rounded-xl bg-ink-800 px-4 py-3 outline-none ring-1 ring-ink-700 focus:ring-2 focus:ring-accent/60"
          />
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <p className="pt-1 text-xs muted">
            Set a password from Settings once you are signed in. Passwords work everywhere,
            including the installed app.
          </p>
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setError('');
            }}
            className="w-full text-sm font-medium text-sky-300"
          >
            Email me a code instead
          </button>
        </form>
      ) : (
        <form onSubmit={onSubmitCode} className="mt-8 space-y-3">
          <div className="card">
            <p className="text-sm text-slate-300">
              We sent a {CODE_LENGTH}-digit code to <span className="font-medium">{email}</span>.
            </p>
            {installed ? (
              <p className="mt-1 text-xs muted">
                Type the code here. Don't tap the link in the email — it opens Safari, which is a
                separate app from this one and cannot sign you in here.
              </p>
            ) : (
              <p className="mt-1 text-xs muted">
                Type the code here, or tap the link in the email.
              </p>
            )}
          </div>

          <input
            ref={codeRef}
            // iOS offers the code straight from Mail with this.
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            placeholder="000000"
            aria-label="Sign-in code"
            className="w-full rounded-xl bg-ink-800 px-4 py-4 text-center text-3xl font-semibold tracking-[0.4em] tabular-nums outline-none ring-1 ring-ink-700 focus:ring-2 focus:ring-accent/60 placeholder:text-slate-700"
          />

          <button
            type="submit"
            disabled={busy || code.length < CODE_LENGTH}
            className="btn-primary w-full"
          >
            {busy ? 'Checking…' : 'Sign in'}
          </button>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError('');
              }}
              className="text-sm muted"
            >
              Change email
            </button>
            <button
              type="button"
              onClick={() => void resend()}
              disabled={busy}
              className="text-sm font-medium text-sky-300"
            >
              {resentAt ? 'Sent again' : 'Resend code'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
