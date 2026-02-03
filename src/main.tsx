import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { tradingBot } from './lib/trading/tradingBot'

// Expose tradingBot globally for testing
if (typeof window !== 'undefined') {
  (window as any).tradingBot = tradingBot;
}

// Add global error handler to catch any browser extension related errors
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  console.error('Error message:', event.message);
  console.error('Error filename:', event.filename);
  console.error('Error lineno:', event.lineno);
  console.error('Error colno:', event.colno);
});

// Add unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Log app initialization
console.log('Forex Pulse app initializing...');

createRoot(document.getElementById("root")!).render(<App />);
