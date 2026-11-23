import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Initialize the AutoViral Firebase app/Auth/Firestore clients at startup.
// Existing Supabase-backed modules remain unchanged during the migration.
import './lib/firebase';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);