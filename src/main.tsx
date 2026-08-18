import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// No StrictMode — avoids double WebSocket connects hitting tier CONNECTION_LIMIT.
createRoot(document.getElementById('root')!).render(<App />);
