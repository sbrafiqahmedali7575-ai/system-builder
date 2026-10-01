import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {AppLaunchSplash} from './components/AppLaunchSplash.tsx';
import {installInteractionFeedback} from './utils/interactionFeedback';

installInteractionFeedback();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLaunchSplash />
    <App />
  </StrictMode>,
);
