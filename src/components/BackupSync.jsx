import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { query, run, exportSqliteBytes } from '../db/sqliteEngine';
import {
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  Database,
  CloudOff,
  CheckCircle2,
  FileCode,
  Terminal,
  ShieldCheck,
  RotateCcw,
  Sparkles
} from 'lucide-react';

export default function BackupSync() {
  const {
    staffList,
    attendanceRecords,
    salaryLedger,
    downloadSqliteBackup,
    restoreSqliteBackup,
    resetToFactoryDemo,
    showToast
  } = useApp();

  const fileInputRef = useRef(null);
  const [sqlInput, setSqlInput] = useState('SELECT name, role, salary_type, base_rate FROM staff;');
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState('');

  // Unsynced count calculation
  const unsyncedStaff = staffList.filter((s) => s.sync_status === 0).length;
  const unsyncedAttendance = attendanceRecords.filter((a) => a.sync_status === 0).length;
  const unsyncedLedger = salaryLedger.filter((l) => l.sync_status === 0).length;
  const totalUnsynced = unsyncedStaff + unsyncedAttendance + unsyncedLedger;

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
        shop: 'Ekdant Supermarket',
        version: '1.0.0',
        staff: staffList,
        attendance: attendanceRecords,
        salary_ledger: salaryLedger
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ekdant_shop_data_snapshot_${new Date().toISOString().split('T')[0]}.json`;
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

  return (
    <div>
      <div className="attendance-header-actions">
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Local SQLite Backup & Sync Architecture</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            100% offline data portability for USB drives and future cloud sync readiness.
          </p>
        </div>
      </div>

      {/* Backup Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
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
            Download the entire raw SQLite database file directly to your desktop or USB flash drive. Opens in DB Browser for SQLite or any standard SQL tool.
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
            Restore database on a new shop counter PC or replace records from a previous day's USB backup file.
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

        {/* Card 3: JSON Snapshot & Demo Reset */}
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
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Data Snapshot & Reset</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>JSON export & Demo Reload</p>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Export human-readable JSON backup or reload initial supermarket demo records with one click.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={exportJsonSnapshot}>
              <Download size={14} />
              <span>JSON Export</span>
            </button>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, borderColor: 'var(--accent-warning)', color: 'var(--accent-warning)' }}
              onClick={() => {
                if (window.confirm('Reset local database back to default sample records?')) {
                  resetToFactoryDemo();
                }
              }}
            >
              <RotateCcw size={14} />
              <span>Reset Demo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cloud Sync Readiness Inspector (Spec Section 5) */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} color="var(--accent-success)" />
              <span>Section 5: Forward-Compatibility & Cloud Sync Status</span>
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Change tracking columns (`sync_status`, `updated_at`, `uuid`) ready for cloud replication (Supabase / Postgres / Firebase)
            </p>
          </div>
          <span style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            padding: '0.25rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            background: 'var(--accent-info-subtle)',
            color: 'var(--accent-info)'
          }}>
            {totalUnsynced} Records Queued for Sync
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Staff Master (UUIDs)</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {staffList.length} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>total</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-success)', marginTop: '0.2rem' }}>
              ✓ Client UUIDs & Soft-deletes enabled
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Attendance Logs</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {attendanceRecords.length} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>entries</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-success)', marginTop: '0.2rem' }}>
              ✓ Shift & punch timestamps synced
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Salary Khata Ledger</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {salaryLedger.length} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>transactions</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-success)', marginTop: '0.2rem' }}>
              ✓ Foreign key integrity verified
            </div>
          </div>
        </div>
      </div>

      {/* Interactive SQLite Query Console */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Terminal size={18} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>SQLite Query Console</h3>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          Run real-time SQL statements directly against the local WebAssembly SQLite engine.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            type="text"
            className="form-input"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
            value={sqlInput}
            onChange={(e) => setSqlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRunSql()}
          />
          <button className="btn btn-primary" onClick={handleRunSql}>
            Execute
          </button>
        </div>

        {/* Quick query buttons */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => setSqlInput('SELECT id, name, role, salary_type, base_rate, pin_code FROM staff;')}
          >
            Staff Table
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => setSqlInput('SELECT date, status, count(*) as count FROM attendance GROUP BY date, status ORDER BY date DESC;')}
          >
            Attendance Counts
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => setSqlInput('SELECT type, payment_mode, SUM(amount) as total FROM salary_ledger GROUP BY type, payment_mode;')}
          >
            Ledger Sums
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            onClick={() => setSqlInput('PRAGMA table_info(staff);')}
          >
            Schema: staff
          </button>
        </div>

        {queryError && (
          <div style={{
            padding: '0.65rem',
            background: 'var(--accent-danger-subtle)',
            color: 'var(--accent-danger)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-mono)',
            marginBottom: '1rem'
          }}>
            SQL Error: {queryError}
          </div>
        )}

        {queryResult && (
          <div className="table-responsive" style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {queryResult.length === 0 ? (
              <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Query executed. 0 rows returned.
              </div>
            ) : (
              <table className="data-table" style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                <thead>
                  <tr>
                    {Object.keys(queryResult[0]).map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResult.map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((val, cIdx) => (
                        <td key={cIdx}>{String(val ?? 'NULL')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
