import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { SystemBuilderLogo } from './SystemBuilderLogo';

type AuthStatus = {
  loginRequired: boolean;
  authenticated: boolean;
  userName: string;
  profileReady: boolean;
};

type AuthContextValue = {
  loginRequired: boolean;
  userName: string;
  openAccount: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAppAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAppAuth must be used inside AuthGate.');
  return value;
}

async function readJson(response: Response): Promise<any> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.error || 'Request failed.'));
  }
  return payload;
}

const PasswordField: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
}> = ({ id, label, value, onChange, autoComplete, placeholder }) => {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
};

const LoginScreen: React.FC<{
  onAuthenticated: (userName: string) => void;
}> = ({ onAuthenticated }) => {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userName.trim() || !password) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: userName.trim(), password }),
      });
      const payload = await readJson(response);
      setPassword('');
      onAuthenticated(String(payload.userName || userName.trim()));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f8ff] px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1100px] items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_28px_90px_rgba(37,99,235,0.16)] dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1.08fr_.92fr]">
          <section className="hidden min-h-[590px] flex-col justify-between bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 p-10 text-white lg:flex">
            <div>
              <SystemBuilderLogo className="size-14 text-lg" animated />
              <div className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-blue-100">
                System Builder
              </div>
              <h1 className="mt-3 max-w-md text-4xl font-black tracking-[-0.04em]">
                Protect the system that builds your progress.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-blue-100">
                Sign in to continue to your tasks, habits, analytics, books, and underlying data.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-100">
              <ShieldCheck className="h-4 w-4" />
              Credentials are verified by the System Builder server.
            </div>
          </section>

          <section className="flex min-h-[560px] items-center px-5 py-8 sm:px-10">
            <div className="mx-auto w-full max-w-sm">
              <div className="mb-8 flex items-center gap-3 lg:hidden">
                <SystemBuilderLogo className="size-12 text-base" animated />
                <div>
                  <div className="text-lg font-black tracking-tight">System Builder</div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Secure sign in
                  </div>
                </div>
              </div>

              <div className="inline-flex rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.03em]">Welcome back</h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Enter the username and password stored for the active System Builder user.
              </p>

              <form className="mt-7 space-y-4" onSubmit={submit}>
                <label className="block" htmlFor="system-builder-user-name">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Username
                  </span>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="system-builder-user-name"
                      value={userName}
                      onChange={(event) => setUserName(event.target.value)}
                      autoComplete="username"
                      autoFocus
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                    />
                  </div>
                </label>

                <PasswordField
                  id="system-builder-password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                />

                {error && (
                  <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy || !userName.trim() || !password}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

const AccountDialog: React.FC<{
  userName: string;
  loginRequired: boolean;
  onClose: () => void;
  onUpdated: (userName: string) => void;
  onLogout: () => Promise<void>;
}> = ({ userName, loginRequired, onClose, onUpdated, onLogout }) => {
  const [nextUserName, setNextUserName] = useState(userName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaved(false);
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/auth/credentials', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          userName: nextUserName.trim(),
          newPassword,
        }),
      });
      const payload = await readJson(response);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
      onUpdated(String(payload.userName || nextUserName.trim()));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[26px] border border-white/80 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black">Account</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Update your System Builder login credentials.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Close account settings">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
          Login requirement: <strong>{loginRequired ? 'Enabled' : 'Disabled'}</strong>. This follows the Users table <code>IsLoginRequired</code> value.
        </div>

        <form className="mt-5 space-y-4" onSubmit={save}>
          <label className="block" htmlFor="account-user-name">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Username</span>
            <input id="account-user-name" value={nextUserName} onChange={(event) => setNextUserName(event.target.value)} autoComplete="username" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-blue-950" />
          </label>

          <PasswordField id="account-current-password" label="Current password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          <PasswordField id="account-new-password" label="New password (optional)" value={newPassword} onChange={setNewPassword} autoComplete="new-password" placeholder="Leave blank to keep current password" />
          <PasswordField id="account-confirm-password" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />

          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
          {saved && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">Account credentials updated.</div>}

          <button type="submit" disabled={busy || !currentPassword || !nextUserName.trim()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Save credentials
          </button>
        </form>

        {loginRequired && (
          <button type="button" onClick={() => void onLogout()} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        )}
      </section>
    </div>
  );
};

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);

  const refreshStatus = async () => {
    setStatusError('');
    try {
      const response = await fetch('/api/auth/status', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = await readJson(response);
      setStatus({
        loginRequired: Boolean(payload.loginRequired),
        authenticated: Boolean(payload.authenticated),
        userName: String(payload.userName || ''),
        profileReady: Boolean(payload.profileReady),
      });
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Unable to check login status.');
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
    setAccountOpen(false);
    await refreshStatus();
  };

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      loginRequired: Boolean(status?.loginRequired),
      userName: status?.userName || '',
      openAccount: () => setAccountOpen(true),
      logout,
    }),
    [status]
  );

  if (statusError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8ff] p-4 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl border border-rose-200 bg-white p-5 text-center shadow-xl dark:border-rose-900/60 dark:bg-slate-900">
          <div className="text-sm font-black text-slate-900 dark:text-white">Login service unavailable</div>
          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{statusError}</p>
          <button type="button" onClick={() => void refreshStatus()} className="mt-4 h-10 rounded-xl bg-blue-600 px-4 text-xs font-black text-white">Retry</button>
        </div>
      </main>
    );
  }

  if (!status) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8ff] dark:bg-slate-950">
        <div className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Securing System Builder…
        </div>
      </main>
    );
  }

  if (status.loginRequired && !status.authenticated) {
    return (
      <LoginScreen
        onAuthenticated={(userName) =>
          setStatus((current) =>
            current
              ? { ...current, authenticated: true, userName }
              : current
          )
        }
      />
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      {accountOpen && (
        <AccountDialog
          userName={status.userName}
          loginRequired={status.loginRequired}
          onClose={() => setAccountOpen(false)}
          onUpdated={(userName) =>
            setStatus((current) =>
              current ? { ...current, userName } : current
            )
          }
          onLogout={logout}
        />
      )}
    </AuthContext.Provider>
  );
};
