import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { query, run, exportSqliteBytes } from '../db/sqliteEngine';
import ShopRegistrationModal from './ShopRegistrationModal';
import {
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  Database,
  CheckCircle2,
  FileCode,
  Terminal,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Clock,
  Store,
  Edit2,
  Layers,
  Timer,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export default function BackupSync() {
  const {
    staffList,
    attendanceRecords,
    salaryLedger,
    downloadSqliteBackup,
    restoreSqliteBackup,
    resetToFactoryDemo,
    shopProfile,
    toggleGlobalTimerTracking,
    lastAutoBackupTime,
    autoBackupHistory,
    executeAutoBackup,
    restoreAutoBackupSnapshot,
    showToast
  } = useApp();

  const fileInputRef = useRef(null);
  const [sqlInput, setSqlInput] = useState('SELECT name, role, salary_type, base_rate FROM staff;');
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState('');
  const [shopModalOpen, setShopModalOpen] = useState(false);

  // Execute raw SQL in console
  const handleRunSql = () => {
    setQueryError('');
    try {
      const trimmed = sqlInput.trim();
      if (trimmed.toUpperCase().startsWith('SELECT') || trimmed.toUpperCase().startsWith('PRAGMA')) {
        const rows = query(trimmed);
        setQueryResult(rows);
      } else {
        run(trimmed);
        setQueryResult([{ message: 'Query executed successfully.' }]);
        showToast('Statement executed successfully!');
      }
    } catch (err) {
      setQueryError(err.message);
      setQueryResult(null);
    }
  };

  // Export full JSON snapshot
  const exportJsonSnapshot = () => {
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        shop: shopProfile || { shop_name: 'Shop', phone_number: '' },
        version: '1.0.0',
        staff: staffList,
        attendance: attendanceRecords,
        salary_ledger: salaryLedger
      };

      const shopSlug = (shopProfile?.shop_name || 'shop').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${shopSlug}_data_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('JSON Snapshot downloaded!');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (window.confirm('Restoring this backup will replace current local database. Continue?')) {
        restoreSqliteBackup(file);
      }
    }
    e.target.value = '';
  };

  // Download snapshot from auto-backup history
  const downloadSnapshot = (backupItem) => {
    try {
      const binaryString = atob(backupItem.data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `autobackup_${new Date(backupItem.timestamp).toISOString().replace(/[:.]/g, '-')}.sqlite`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast('Failed to download snapshot', 'error');
    }
  };

  return (
    <div>
      <div className="attendance-header-actions">
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Data Backup & Shop Profile</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Automated local snapshots and manual SQLite / JSON exports.
          </p>
        </div>
      </div>

      {/* Auto-Backup System Card (FEATURED) */}
      <div className="card" style={{
        marginBottom: '1.5rem',
        border: '1px solid var(--border-default)',
        background: 'var(--bg-card)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-success-subtle)',
              color: 'var(--accent-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Clock size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Automated Local Backups</h3>
                <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                  ✓ Scheduled Auto-Backup Active
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
                Last automated snapshot: <strong>{lastAutoBackupTime ? new Date(lastAutoBackupTime).toLocaleTimeString() : 'Pending'}</strong> ({lastAutoBackupTime ? new Date(lastAutoBackupTime).toLocaleDateString() : 'Today'})
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => executeAutoBackup(true)}
            style={{ padding: '0.6rem 1.25rem' }}
          >
            <RefreshCw size={16} />
            <span>Create Backup Snapshot Now</span>
          </button>
        </div>

        {/* Snapshots Table / List */}
        {autoBackupHistory && autoBackupHistory.length > 0 ? (
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Backup Snapshots (Last {autoBackupHistory.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {autoBackupHistory.map((item, idx) => (
                <div
                  key={item.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.82rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <ShieldCheck size={16} color="var(--accent-success)" />
                    <div>
                      <span style={{ fontWeight: 700 }}>{item.dateFormatted}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                        ({(item.sizeBytes / 1024).toFixed(1)} KB • {item.staffCount || 0} Staff)
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                      onClick={() => {
                        if (window.confirm(`Restore database from snapshot taken at ${item.dateFormatted}? Current data will be replaced.`)) {
                          restoreAutoBackupSnapshot(item);
                        }
                      }}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      style={{ width: '28px', height: '28px' }}
                      onClick={() => downloadSnapshot(item)}
                      title="Download as .sqlite file"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            Initial backup snapshot is taking place in the background.
          </p>
        )}
      </div>

      {/* Shop Profile & Registration Summary Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-primary-subtle)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Store size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                {shopProfile?.shop_name || 'Shop Not Registered'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0' }}>
                📞 {shopProfile?.phone_number || 'No phone set'}
                {shopProfile?.owner_name ? ` • Owner: ${shopProfile.owner_name}` : ''}
                {shopProfile?.address ? ` • ${shopProfile.address}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShopModalOpen(true)}
            style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
          >
            <Edit2 size={15} />
            <span>Edit Shop Profile</span>
          </button>
        </div>
      </div>

      {/* Staff Shift Timers & Late Arrival Policy Card */}
      <div className="card" style={{
        marginBottom: '1.5rem',
        border: '1px solid var(--border-default)',
        background: 'var(--bg-card)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: (shopProfile?.timer_tracking_enabled !== 0) ? 'var(--accent-primary-subtle)' : 'var(--bg-elevated)',
              color: (shopProfile?.timer_tracking_enabled !== 0) ? 'var(--accent-primary)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Timer size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
                  Staff Shift Timers &amp; Late Tracking
                </h3>
                <span
                  className={shopProfile?.timer_tracking_enabled !== 0 ? 'badge badge-success' : 'badge badge-warning'}
                  style={{ fontSize: '0.72rem' }}
                >
                  {shopProfile?.timer_tracking_enabled !== 0 ? '✓ Timers Enabled' : '○ Timers Disabled'}
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
                {shopProfile?.timer_tracking_enabled !== 0
                  ? 'Active: Punching in after work start time automatically calculates and logs late minutes.'
                  : 'Disabled: Staff can punch in anytime without late arrival calculation (flexible work hours).'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleGlobalTimerTracking}
            className={shopProfile?.timer_tracking_enabled !== 0 ? 'btn btn-secondary' : 'btn btn-primary'}
            style={{
              padding: '0.55rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 700
            }}
          >
            {shopProfile?.timer_tracking_enabled !== 0 ? (
              <>
                <ToggleRight size={20} color="var(--accent-success)" />
                <span>Disable Timers</span>
              </>
            ) : (
              <>
                <ToggleLeft size={20} />
                <span>Enable Timers</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Manual Export & Restore Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {/* Card 1: SQLite Binary */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-primary-subtle)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Database size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Export SQLite Database</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Native .sqlite binary format</p>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Download the raw SQLite database file directly to your desktop or USB drive. Opens in DB Browser for SQLite.
          </p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={downloadSqliteBackup}>
            <Download size={16} />
            <span>Download .sqlite File</span>
          </button>
        </div>

        {/* Card 2: Restore */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-success-subtle)',
              color: 'var(--accent-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Upload size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Restore from Backup</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Import existing .sqlite file</p>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Restore database on a new phone, PC, or replace records from a previous day's backup file.
          </p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button
            className="btn btn-secondary"
            style={{ width: '100%' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} />
            <span>Select .sqlite File to Restore</span>
          </button>
        </div>

        {/* Card 3: JSON Snapshot */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-purple-subtle)',
              color: 'var(--accent-purple)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileCode size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>JSON Data Snapshot</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Export data as JSON</p>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Export human-readable JSON backup containing staff, attendance records, and salary ledger.
          </p>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={exportJsonSnapshot}>
            <Download size={16} />
            <span>Download JSON Snapshot</span>
          </button>
        </div>
      </div>

      {/* Embedded SQL Query Console */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Terminal size={18} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Direct SQLite SQL Terminal</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Advanced Query Runner</span>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <textarea
            className="form-input"
            rows="3"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}
            value={sqlInput}
            onChange={(e) => setSqlInput(e.target.value)}
            placeholder="e.g. SELECT * FROM staff;"
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <button className="btn btn-primary" onClick={handleRunSql}>
            <span>Run SQL Statement</span>
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setSqlInput('SELECT id, name, role, salary_type, per_piece_rate FROM staff;')}
          >
            Show Staff
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setSqlInput('SELECT * FROM shop_profile;')}
          >
            Show Shop Profile
          </button>
        </div>

        {queryError && (
          <div style={{
            background: 'var(--accent-danger-subtle)',
            color: 'var(--accent-danger)',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem'
          }}>
            {queryError}
          </div>
        )}

        {queryResult && (
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {JSON.stringify(queryResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Edit Shop Registration Modal */}
      <ShopRegistrationModal
        isOpen={shopModalOpen}
        onClose={() => setShopModalOpen(false)}
        isInitial={false}
      />
    </div>
  );
}
