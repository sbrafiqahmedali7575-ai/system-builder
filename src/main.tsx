import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {AppLaunchSplash} from './components/AppLaunchSplash.tsx';
import {installInteractionFeedback} from './utils/interactionFeedback';

// Restore reader preferences from a local backup only where the profile has no value.
const savedState = await window.systemBuilderDesktop.read();
const savedUser = Object.values(savedState.collections.users)[0] as any;
for (const [key,value] of Object.entries(savedUser?.desktopPreferences || {})) {
  if ((key.startsWith('SYSTEM_BUILDER_CAL_NEWPORT_') || key === 'SYSTEM_BUILDER_BOOKS_AUTHOR' || key.startsWith('system-builder:timer-')) && localStorage.getItem(key) === null && typeof value === 'string') localStorage.setItem(key,value);
}
installInteractionFeedback();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLaunchSplash />
    <App />
  </StrictMode>,
);
