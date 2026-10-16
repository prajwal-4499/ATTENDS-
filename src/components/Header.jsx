import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import ShopRegistrationModal from './ShopRegistrationModal';
import {
  Sun,
  Moon,
  Calendar,
  Store,
  MonitorCheck,
  Download,
  ShieldCheck,
  Edit2,
  Clock
} from 'lucide-react';

export default function Header() {
  const {
    theme,
    toggleTheme,
    selectedDate,
    setSelectedDate,
    activeTab,
    setActiveTab,
    downloadSqliteBackup,
    shopProfile,
    lastAutoBackupTime,
    executeAutoBackup
  } = useApp();

  const [editShopOpen, setEditShopOpen] = useState(false);

  // Time ago calculation for last auto backup
  const getBackupTimeAgo = () => {
    if (!lastAutoBackupTime) return 'Active';
    const minsAgo = Math.floor((Date.now() - lastAutoBackupTime) / 60000);
    if (minsAgo < 1) return 'Just now';
    if (minsAgo < 60) return `${minsAgo}m ago`;
    const hrs = Math.floor(minsAgo / 60);
    return `${hrs}h ago`;
  };

  return (
    <>
      <header className="top-header no-print">
        <div
          className="brand-section"
          onClick={() => setEditShopOpen(true)}
          title="Click to view or edit Shop Registration details"
          style={{ cursor: 'pointer' }}
        >
          <div className="brand-icon" style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}>
            <img
              src="/logo.png"
              alt="Logo"
              style={{
                height: '38px',
                width: 'auto',
                maxWidth: '72px',
                objectFit: 'contain',
                borderRadius: 'var(--radius-sm)'
              }}
            />
          </div>
          <div className="brand-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <h1 style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shopProfile?.shop_name || 'Ekdant Attendance'}
              </h1>
              <span className="brand-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <Edit2 size={10} />
                <span>Shop</span>
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {shopProfile?.phone_number ? `📞 ${shopProfile.phone_number}` : 'Staff & Wage Management'}
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
          {/* Status Badge */}
          <button
            type="button"
            className="offline-pill"
            onClick={() => executeAutoBackup(true)}
            title="Automated local backup active. Click to save snapshot now."
            style={{ border: 'none', cursor: 'pointer', background: 'var(--accent-success-subtle)' }}
          >
            <span className="pulse-dot"></span>
            <span>Synced • {getBackupTimeAgo()}</span>
          </button>

          <button
            className="btn btn-secondary kiosk-nav-btn"
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
            title="Download SQLite Database Backup file (.sqlite)"
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

      {/* Edit Shop Profile Modal */}
      <ShopRegistrationModal
        isOpen={editShopOpen}
        onClose={() => setEditShopOpen(false)}
        isInitial={false}
      />
    </>
  );
}
