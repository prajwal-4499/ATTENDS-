import React from 'react';
import { useApp } from './context/AppContext';
import Header from './components/Header';
import Navigation from './components/Navigation';
import AttendanceGrid from './components/AttendanceGrid';
import KioskMode from './components/KioskMode';
import StaffManager from './components/StaffManager';
import SalaryKhata from './components/SalaryKhata';
import MusterRollReports from './components/MusterRollReports';
import BackupSync from './components/BackupSync';
import { CheckCircle2, AlertCircle, Info, Database } from 'lucide-react';

function AppContent() {
  const { isDbReady, dbError, initAppDb, activeTab, toast } = useApp();

  if (!isDbReady) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
        background: 'var(--bg-primary)'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: dbError ? 'var(--accent-danger)' : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)'
        }}>
          {dbError ? <AlertCircle size={28} /> : <Database size={28} />}
        </div>
        
        {dbError ? (
          <>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-danger)' }}>
              Database Initialization Failed
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '460px', fontFamily: 'var(--font-mono)' }}>
              {dbError}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={() => initAppDb()}>
                Retry Initialization
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
              >
                Clear Storage & Reload
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Loading Offline SQLite Engine...</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Initializing WebAssembly SQLite & local disk persistence
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header />
      <Navigation />

      <main className="main-content">
        {activeTab === 'attendance' && <AttendanceGrid />}
        {activeTab === 'kiosk' && <KioskMode />}
        {activeTab === 'staff' && <StaffManager />}
        {activeTab === 'salary' && <SalaryKhata />}
        {activeTab === 'muster' && <MusterRollReports />}
        {activeTab === 'backup' && <BackupSync />}
      </main>

      {/* Toast Alerts */}
      {toast && (
        <div className="toast-container no-print">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' && <CheckCircle2 size={18} />}
            {toast.type === 'error' && <AlertCircle size={18} />}
            {toast.type === 'info' && <Info size={18} />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
