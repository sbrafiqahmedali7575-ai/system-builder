import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { OwnerAccessGate } from './components/OwnerAccessGate.tsx';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('System Builder root element is missing.');
}

function showStartupError(error: unknown): void {
  const message =
    error instanceof Error
      ? error.message
      : String(error || 'Unknown application error');

  rootElement.innerHTML = `
    <main style="min-height:100vh;background:#020617;color:#e2e8f0;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif;">
      <section style="width:100%;max-width:520px;background:#0f172a;border:1px solid #7f1d1d;border-radius:16px;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.35);">
        <div style="font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#fb7185;">SYSTEM BUILDER</div>
        <h1 style="margin:8px 0 0;font-size:22px;color:white;">App startup error</h1>
        <p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#94a3b8;">The app shell loaded, but a browser runtime error stopped the current screen. Photograph the message below.</p>
        <pre style="margin:16px 0 0;white-space:pre-wrap;word-break:break-word;background:#020617;border:1px solid #881337;border-radius:12px;padding:12px;font-size:12px;color:#fda4af;">${message.replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char] || char))}</pre>
        <button onclick="window.location.reload()" style="margin-top:16px;width:100%;height:40px;border:0;border-radius:12px;background:#0d9488;color:white;font-weight:800;">Reload app</button>
      </section>
    </main>
  `;
}

window.addEventListener('error', (event) => {
  if (event.error || event.message) {
    showStartupError(event.error || event.message);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  showStartupError(event.reason);
});

const root = createRoot(
  rootElement,
  {
    onUncaughtError: (error: unknown) => showStartupError(error),
  } as any
);

root.render(
  <StrictMode>
    <OwnerAccessGate>
      <App />
    </OwnerAccessGate>
  </StrictMode>,
);
