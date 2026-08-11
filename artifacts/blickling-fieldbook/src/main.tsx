import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';
import { initialiseOfflineSync } from './lib/offline';

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`).then(initialiseOfflineSync).catch(console.error);
}
