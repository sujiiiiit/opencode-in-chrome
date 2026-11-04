import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsPage } from '@/components/settings/settings-page';
import '@/assets/styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsPage />
  </React.StrictMode>,
);
