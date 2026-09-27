import { Component, type PropsWithChildren } from 'react';

type AppCrashBoundaryProps = PropsWithChildren<{}>;

interface AppCrashBoundaryState {
  error: string;
}

export class AppCrashBoundary extends Component<
  AppCrashBoundaryProps,
  AppCrashBoundaryState
> {
  state: AppCrashBoundaryState = { error: '' };

  static getDerivedStateFromError(error: unknown): AppCrashBoundaryState {
    return {
      error:
        error instanceof Error
          ? error.message
          : String(error || 'Unknown application error'),
    };
  }

  componentDidCatch(error: unknown): void {
    console.error('System Builder render error:', error);
  }

  componentDidMount(): void {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener(
      'unhandledrejection',
      this.handleUnhandledRejection
    );
  }

  componentWillUnmount(): void {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener(
      'unhandledrejection',
      this.handleUnhandledRejection
    );
  }

  private handleWindowError = (event: ErrorEvent) => {
    if (!event.error && !event.message) return;
    this.setState({
      error:
        event.error instanceof Error
          ? event.error.message
          : event.message || 'Unknown browser error',
    });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    this.setState({
      error:
        reason instanceof Error
          ? reason.message
          : String(reason || 'Unhandled promise rejection'),
    });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-slate-950 p-4 text-slate-100 flex items-center justify-center">
        <section className="w-full max-w-lg rounded-2xl border border-rose-800/60 bg-slate-900 p-5 shadow-2xl">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-400">
            System Builder
          </div>
          <h1 className="mt-2 text-xl font-black text-white">
            App startup error
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            The app shell loaded, but a browser runtime error stopped the
            current screen. Copy or photograph the message below.
          </p>
          <pre className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-rose-900/60 bg-slate-950 p-3 text-xs text-rose-300">
            {this.state.error}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 h-10 w-full rounded-xl bg-teal-600 text-sm font-black text-white hover:bg-teal-500"
          >
            Reload app
          </button>
        </section>
      </main>
    );
  }
}
