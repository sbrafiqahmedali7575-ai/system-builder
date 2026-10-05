import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {AppLaunchSplash} from './components/AppLaunchSplash.tsx';
import {installInteractionFeedback} from './utils/interactionFeedback';

// Restore reader preferences from a local backup only where the profile has no value.
const savedState = await window.systemBuilderDesktop.read();
const savedUser = Object.values(savedState.collections.users)[0] as any;
for (const [key,value] of Object.entries(savedState.desktopPreferences || savedUser?.desktopPreferences || {})) {
  if ((key.startsWith('SYSTEM_BUILDER_') || key.startsWith('system-builder:')) && !key.includes('CACHE') && localStorage.getItem(key) === null && typeof value === 'string') localStorage.setItem(key,value);
}
installInteractionFeedback();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLaunchSplash />
    <App />
  </StrictMode>,
);

