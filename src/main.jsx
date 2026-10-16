import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AppProvider } from './context/AppContext.jsx';
import './index.css';

// ─── One-time migration: clear old demo-data SQLite snapshot ─────────────────
// If the user previously ran the app with dummy data, wipe the old DB so the
// app starts fresh. The flag 'v2_clean_applied' is set so this only fires once.
const MIGRATION_FLAG = 'ekdant_v2_clean_applied';
if (!localStorage.getItem(MIGRATION_FLAG)) {
  localStorage.removeItem('ekdant_shop_attendance_sqlite_bytes_v1');
  localStorage.removeItem('ekdant_shop_attendance_meta_v1');
  localStorage.setItem(MIGRATION_FLAG, '1');
  console.info('[Migration] Cleared legacy demo-data SQLite snapshot. Fresh start.');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
