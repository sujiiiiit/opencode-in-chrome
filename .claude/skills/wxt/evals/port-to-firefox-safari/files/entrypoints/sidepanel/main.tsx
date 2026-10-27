import ReactDOM from 'react-dom/client';
import { useState } from 'react';

function App() {
  const [summary, setSummary] = useState('');
  const run = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    setSummary(await chrome.runtime.sendMessage({ type: 'summarize', url: tab.url }));
  };
  return (<div><button onClick={run}>Summarize this page</button><p>{summary}</p></div>);
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
