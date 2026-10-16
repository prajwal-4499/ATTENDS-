import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Sun,
  Moon,
  Calendar,
  Database,
  Store,
  MonitorCheck,
  Download
} from 'lucide-react';

export default function Header() {
  const {
    theme,
    toggleTheme,
    selectedDate,
    setSelectedDate,
    activeTab,
    setActiveTab,
    downloadSqliteBackup
  } = useApp();

  return (
    <header className="top-header no-print">
      <div className="brand-section">
        <div className="brand-icon">
          <Store size={22} />
        </div>
        <div className="brand-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1>StaffTrack Pro</h1>
            <span className="brand-badge">Shop Edition</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Ekdant Supermarket • 100% Offline System
          </p>
        </div>
      </div>

      <div className="header-center">
        <div className="date-badge-picker">
          <Calendar size={16} color="var(--accent-primary)" />
          <input
            type="date"
            className="date-input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            title="Change active attendance date"
          />
        </div>
      </div>

      <div className="header-actions">
        <div className="offline-pill" title="All data stored locally in SQLite on this counter machine">
          <span className="pulse-dot"></span>
          <span>Zero-Cloud SQLite</span>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => setActiveTab(activeTab === 'kiosk' ? 'attendance' : 'kiosk')}
          title="Toggle Staff Counter Kiosk Mode"
          style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
        >
          <MonitorCheck size={16} color="var(--accent-purple)" />
          <span>{activeTab === 'kiosk' ? 'Exit Kiosk' : 'Kiosk Screen'}</span>
        </button>

        <button
          className="btn-icon"
          onClick={downloadSqliteBackup}
          title="One-click SQLite Database Backup to USB/Disk"
        >
          <Download size={18} />
        </button>

        <button
          className="btn-icon"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun size={18} color="#f59e0b" />
          ) : (
            <Moon size={18} color="#6366f1" />
          )}
        </button>
      </div>
    </header>
  );
}
