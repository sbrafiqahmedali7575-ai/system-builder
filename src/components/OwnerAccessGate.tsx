import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';

type OwnerState = 'checking' | 'authorized' | 'required' | 'unconfigured';

interface OwnerAccessGateProps {
  children: React.ReactNode;
}

export const OwnerAccessGate: React.FC<OwnerAccessGateProps> = ({
  children,
}) => {
  const [state, setState] = useState<OwnerState>('checking');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch('/api/owner/session', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const data = await response.json();

      if (data.authenticated) {
        setState('authorized');
        setError('');
        return;
      }

      setState(data.configured ? 'required' : 'unconfigured');
    } catch {
      setState('required');
      setError('Unable to verify the owner session.');
    }
  }, []);

  useEffect(() => {
    void checkSession();

    const handleAuthRequired = () => {
      setState('required');
      setError('Your owner session expired. Sign in again to continue.');
    };

    const handleFocus = () => void checkSession();

    window.addEventListener(
      'system-builder-owner-auth-required',
      handleAuthRequired
    );
    window.addEventListener('focus', handleFocus);

    const intervalId = window.setInterval(
      () => void checkSession(),
      5 * 60 * 1000
    );

    return () => {
      window.removeEventListener(
        'system-builder-owner-auth-required',
        handleAuthRequired
      );
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(intervalId);
    };
  }, [checkSession]);

  const login = async () => {
    if (!token.trim() || submitting) return;

    try {
      setSubmitting(true);
      setError('');

      const response = await fetch('/api/owner/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 503) setState('unconfigured');
        setError(data.error || 'Owner authentication failed.');
        return;
      }

      setToken('');
      setState('authorized');
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Owner authentication failed.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'authorized') {
    return <>{children}</>;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 shrink-0 rounded-xl border border-teal-500/30 bg-teal-500/10 flex items-center justify-center">
            {state === 'checking' ? (
              <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
            ) : state === 'required' ? (
              <LockKeyhole className="w-5 h-5 text-teal-400" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            )}
          </div>

          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.16em] font-black text-teal-400">
              System Builder
            </div>
            <h1 className="mt-1 text-xl font-black text-white">
              {state === 'checking'
                ? 'Checking owner access'
                : state === 'unconfigured'
                ? 'Owner security needs configuration'
                : 'Owner access required'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {state === 'unconfigured'
                ? 'Set OWNER_ACCESS_TOKEN in the server environment to a random value of at least 32 characters. The app and privileged data APIs remain locked until it is configured.'
                : state === 'required'
                ? 'Enter your server-side owner access token. The token is exchanged for a 12-hour HttpOnly session cookie and is not stored in browser JavaScript.'
                : 'Verifying the secure owner session…'}
            </p>
          </div>
        </div>

        {state === 'required' && (
          <div className="mt-5 space-y-2">
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void login();
              }}
              placeholder="Owner access token"
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-teal-500"
            />

            <button
              type="button"
              onClick={() => void login()}
              disabled={!token.trim() || submitting}
              className="h-11 w-full rounded-xl bg-teal-600 text-sm font-black text-white hover:bg-teal-500 disabled:opacity-50"
            >
              {submitting ? 'Unlocking…' : 'Unlock System Builder'}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-rose-800/60 bg-rose-950/30 p-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}
      </section>
    </main>
  );
};
