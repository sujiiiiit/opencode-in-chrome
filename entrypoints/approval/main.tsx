import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApprovalWindow } from '@/components/browser/approval-window';
import '@/assets/styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApprovalWindow id={new URLSearchParams(location.search).get('id') ?? ''} />
  </React.StrictMode>,
);
