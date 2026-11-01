import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/components/panel-app';
import '@/assets/styles/global.css';
import { syncDarkClass } from '@/lib/theme';

syncDarkClass();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
