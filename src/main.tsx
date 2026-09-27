import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { OwnerAccessGate } from './components/OwnerAccessGate.tsx';
import { AppCrashBoundary } from './components/AppCrashBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppCrashBoundary>
      <OwnerAccessGate>
        <App />
      </OwnerAccessGate>
    </AppCrashBoundary>
  </StrictMode>,
);
