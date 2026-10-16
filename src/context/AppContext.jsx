import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  initDatabase,
  query,
  run,
  generateUUID,
  exportSqliteBytes,
  importSqliteBytes,
  clearDatabase
} from '../db/sqliteEngine';
import { seedDatabaseIfEmpty, INITIAL_STAFF } from '../db/seedData';
import {
  initFirebaseService,
  isCloudSyncReady,
  pushRecordToCloud,
  startRealtimeListeners,
  stopRealtimeListeners,
  executeFullCloudSync,
  saveCloudSyncSettings,
  getStoredShopCode,
  getStoredDeviceRole,
  getStoredFirebaseConfig
} from '../services/firebaseSync';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Theme state: light / dark (Light is primary default)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('ekdant_theme') || 'light';
  });

  const [isDbReady, setIsDbReady] = useState(false);
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance', 'kiosk', 'staff', 'salary', 'muster', 'backup'
  
  // Format today as YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [staffList, setStaffList] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [salaryLedger, setSalaryLedger] = useState([]);
  const [toast, setToast] = useState(null);
  const [dbError, setDbError] = useState(null);

  // Shop Profile state
  const [shopProfile, setShopProfile] = useState(() => {
    try {
      const cached = localStorage.getItem('ekdant_shop_profile');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });

  // Auto-backup state (2-hour interval)
  const AUTO_BACKUP_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
  const [lastAutoBackupTime, setLastAutoBackupTime] = useState(() => {
    const ts = localStorage.getItem('ekdant_last_auto_backup_ts');
    return ts ? parseInt(ts, 10) : null;
  });
  const [autoBackupHistory, setAutoBackupHistory] = useState(() => {
    try {
      const hist = localStorage.getItem('ekdant_auto_backup_history');
      return hist ? JSON.parse(hist) : [];
    } catch (e) {
      return [];
    }
  });

  // Live Multi-Device Cloud Sync States (Firebase Firestore)
  const [cloudShopCode, setCloudShopCode] = useState(getStoredShopCode);
  const [deviceRole, setDeviceRole] = useState(getStoredDeviceRole);
  const [isCloudReady, setIsCloudReady] = useState(isCloudSyncReady);
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState(() => {
    const ts = localStorage.getItem('attends_last_cloud_sync_ts');
    return ts ? parseInt(ts, 10) : null;
  });

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ekdant_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast(current => (current && current.message === message ? null : current));
    }, 4000);
  }, []);

  // Fetch all state from SQLite
  const reloadFromDb = useCallback(() => {
    try {
      const staffRows = query("SELECT * FROM staff ORDER BY is_active DESC, name ASC");
      const attRows = query("SELECT * FROM attendance WHERE date = ?", [selectedDate]);
      const ledgerRows = query("SELECT l.*, s.name as staff_name FROM salary_ledger l JOIN staff s ON l.staff_id = s.id ORDER BY l.transaction_date DESC, l.created_at DESC");

      setStaffList(staffRows);
      setAttendanceRecords(attRows);
      setSalaryLedger(ledgerRows);

      try {
        const profRows = query("SELECT * FROM shop_profile ORDER BY created_at DESC LIMIT 1");
        if (profRows && profRows.length > 0) {
          setShopProfile(profRows[0]);
          localStorage.setItem('ekdant_shop_profile', JSON.stringify(profRows[0]));
        }
      } catch (e) {
        // Table might be initializing
      }
    } catch (err) {
      console.error('Failed to reload from DB:', err);
    }
  }, [selectedDate]);

  const initAppDb = useCallback(async () => {
    setDbError(null);
    try {
      const db = await initDatabase();
      seedDatabaseIfEmpty(db);
      setIsDbReady(true);
      reloadFromDb();
    } catch (err) {
      console.error('Initialization error:', err);
      setDbError(err.message || 'SQLite initialization error');
    }
  }, [reloadFromDb]);

  // Initialize DB on boot
  useEffect(() => {
    initAppDb();
  }, [initAppDb]);

  // Whenever selectedDate changes, reload attendance for that date
  useEffect(() => {
    if (isDbReady) {
      reloadFromDb();
    }
  }, [selectedDate, isDbReady, reloadFromDb]);

  // Mark Attendance manually (Shop owner 1-click grid)
  const markAttendance = useCallback((staffId, status, notes = '', pieces = null) => {
    try {
      const existing = query("SELECT * FROM attendance WHERE staff_id = ? AND date = ?", [staffId, selectedDate]);
      const now = new Date();
      const timeStr = `${selectedDate}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

      if (existing.length > 0) {
        // Update
        const rec = existing[0];
        let punchIn = rec.punch_in;
        let punchOut = rec.punch_out;
        let lateMinutes = rec.late_minutes;
        const staffObj = staffList.find(s => s.id === staffId);
        const isTimerOn = (shopProfile?.timer_tracking_enabled !== 0) && (staffObj?.is_timer_enabled !== 0);

        if (status === 'PRESENT' && !punchIn) {
          punchIn = timeStr;
          // Calculate late minutes if staff has work_start_time and timer tracking is enabled
          if (isTimerOn && staffObj && staffObj.work_start_time) {
            const [sH, sM] = staffObj.work_start_time.split(':').map(Number);
            const inTotalMins = (now.getHours() * 60) + now.getMinutes();
            const startTotalMins = (sH * 60) + sM;
            lateMinutes = Math.max(0, inTotalMins - startTotalMins);
          } else {
            lateMinutes = 0;
          }
        } else if (status === 'ABSENT' || status === 'LEAVE') {
          punchIn = null;
          punchOut = null;
          lateMinutes = 0;
        }

        run(`
          UPDATE attendance
          SET status = ?, punch_in = ?, punch_out = ?, late_minutes = ?, notes = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 0
          WHERE id = ?
        `, [status, punchIn, punchOut, lateMinutes, notes || rec.notes, rec.id]);
        // Update pieces if provided
        if (pieces !== null) {
          run(`UPDATE attendance SET pieces_produced = ? WHERE id = ?`, [parseInt(pieces) || 0, rec.id]);
        }
      } else {
        // Insert new record
        const staffObj = staffList.find(s => s.id === staffId);
        const isTimerOn = (shopProfile?.timer_tracking_enabled !== 0) && (staffObj?.is_timer_enabled !== 0);
        let punchIn = null;
        let lateMinutes = 0;

        if (status === 'PRESENT' || status === 'HALF_DAY') {
          punchIn = timeStr;
          if (isTimerOn && staffObj && staffObj.work_start_time) {
            const [sH, sM] = staffObj.work_start_time.split(':').map(Number);
            const inTotalMins = (now.getHours() * 60) + now.getMinutes();
            const startTotalMins = (sH * 60) + sM;
            lateMinutes = Math.max(0, inTotalMins - startTotalMins);
          } else {
            lateMinutes = 0;
          }
        }

        run(`
          INSERT INTO attendance (id, staff_id, date, punch_in, punch_out, status, late_minutes, overtime_hours, punch_method, pieces_produced, notes, sync_status)
          VALUES (?, ?, ?, ?, NULL, ?, ?, 0.0, 'MANUAL', ?, ?, 0)
        `, [generateUUID(), staffId, selectedDate, punchIn, status, lateMinutes, parseInt(pieces) || 0, notes]);
      }

      reloadFromDb();
      showToast(`Marked ${status} for staff`, 'success');

      // Async cloud sync
      try {
        const savedAtt = query("SELECT * FROM attendance WHERE staff_id = ? AND date = ?", [staffId, selectedDate]);
        if (savedAtt.length > 0) pushRecordToCloud('attendance', savedAtt[0]);
      } catch (e) {}
    } catch (err) {
      console.error(err);
      showToast('Error saving attendance: ' + err.message, 'error');
    }
  }, [selectedDate, staffList, shopProfile, reloadFromDb, showToast]);

  // Update pieces produced count for today
  const updatePiecesProduced = useCallback((staffId, pieces) => {
    try {
      const existing = query("SELECT id FROM attendance WHERE staff_id = ? AND date = ?", [staffId, selectedDate]);
      if (existing.length > 0) {
        run(`UPDATE attendance SET pieces_produced = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 0 WHERE id = ?`,
          [parseInt(pieces) || 0, existing[0].id]);
      } else {
        // Create a PRESENT record with pieces
        run(`
          INSERT INTO attendance (id, staff_id, date, punch_in, punch_out, status, late_minutes, overtime_hours, punch_method, pieces_produced, notes, sync_status)
          VALUES (?, ?, ?, NULL, NULL, 'PRESENT', 0, 0, 'MANUAL', ?, '', 0)
        `, [generateUUID(), staffId, selectedDate, parseInt(pieces) || 0]);
      }
      reloadFromDb();

      // Async cloud sync
      try {
        const savedAtt = query("SELECT * FROM attendance WHERE staff_id = ? AND date = ?", [staffId, selectedDate]);
        if (savedAtt.length > 0) pushRecordToCloud('attendance', savedAtt[0]);
      } catch (e) {}
    } catch (err) {
      console.error(err);
      showToast('Error updating pieces: ' + err.message, 'error');
    }
  }, [selectedDate, reloadFromDb, showToast]);

  // Bulk mark all active staff as Present
  const markAllPresent = useCallback(() => {
    try {
      const activeStaff = staffList.filter(s => s.is_active);
      const now = new Date();
      const timeStr = `${selectedDate}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

      activeStaff.forEach(staff => {
        const existing = query("SELECT id FROM attendance WHERE staff_id = ? AND date = ?", [staff.id, selectedDate]);
        if (existing.length > 0) {
          run(`
            UPDATE attendance 
            SET status = 'PRESENT', punch_in = COALESCE(punch_in, ?), updated_at = CURRENT_TIMESTAMP, sync_status = 0
            WHERE id = ?
          `, [timeStr, existing[0].id]);
        } else {
          run(`
            INSERT INTO attendance (id, staff_id, date, punch_in, punch_out, status, late_minutes, overtime_hours, punch_method, notes, sync_status)
            VALUES (?, ?, ?, ?, NULL, 'PRESENT', 0, 0, 'MANUAL', '', 0)
          `, [generateUUID(), staff.id, selectedDate, timeStr]);
        }
      });

      reloadFromDb();
      showToast(`Marked all ${activeStaff.length} active staff Present!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to bulk mark: ' + err.message, 'error');
    }
  }, [selectedDate, staffList, reloadFromDb, showToast]);

  // Kiosk Punch In with auto late detection
  const kioskPunchIn = useCallback((staffId, pinEntered) => {
    try {
      const staff = staffList.find(s => s.id === staffId);
      if (!staff) return { success: false, message: 'Staff not found' };

      // Verify PIN
      if (staff.pin_code && staff.pin_code !== pinEntered) {
        return { success: false, message: 'Incorrect 4-digit PIN' };
      }

      const todayStr = getTodayStr();
      const now = new Date();
      const punchTime = `${todayStr}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      // Calculate late minutes if timer is enabled
      const isTimerOn = (shopProfile?.timer_tracking_enabled !== 0) && (staff.is_timer_enabled !== 0);
      let lateMins = 0;
      if (isTimerOn && staff.work_start_time) {
        const [sH, sM] = staff.work_start_time.split(':').map(Number);
        const inMins = (now.getHours() * 60) + now.getMinutes();
        const startMins = (sH * 60) + sM;
        if (inMins > startMins) {
          lateMins = inMins - startMins;
        }
      }

      const existing = query("SELECT * FROM attendance WHERE staff_id = ? AND date = ?", [staffId, todayStr]);
      if (existing.length > 0) {
        if (existing[0].punch_in) {
          return { success: false, message: `Already punched in today at ${existing[0].punch_in.split('T')[1]?.slice(0, 5)}` };
        }
        run(`
          UPDATE attendance 
          SET status = 'PRESENT', punch_in = ?, late_minutes = ?, punch_method = 'PIN_KIOSK', updated_at = CURRENT_TIMESTAMP, sync_status = 0
          WHERE id = ?
        `, [punchTime, lateMins, existing[0].id]);
      } else {
        run(`
          INSERT INTO attendance (id, staff_id, date, punch_in, punch_out, status, late_minutes, overtime_hours, punch_method, notes, sync_status)
          VALUES (?, ?, ?, ?, NULL, 'PRESENT', ?, 0, 'PIN_KIOSK', '', 0)
        `, [generateUUID(), staffId, todayStr, punchTime, lateMins]);
      }

      reloadFromDb();
      return {
        success: true,
        staffName: staff.name,
        punchTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        lateMins,
        action: 'IN'
      };
    } catch (err) {
      console.error('Kiosk punch in error:', err);
      return { success: false, message: err.message };
    }
  }, [staffList, shopProfile, reloadFromDb]);

  // Kiosk Punch Out with auto overtime calculation
  const kioskPunchOut = useCallback((staffId, pinEntered) => {
    try {
      const staff = staffList.find(s => s.id === staffId);
      if (!staff) return { success: false, message: 'Staff not found' };

      // Verify PIN
      if (staff.pin_code && staff.pin_code !== pinEntered) {
        return { success: false, message: 'Incorrect 4-digit PIN' };
      }

      const todayStr = getTodayStr();
      const now = new Date();
      const punchTime = `${todayStr}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      // Calculate Overtime Hours
      let overtimeHours = 0;
      if (staff.work_end_time) {
        const [eH, eM] = staff.work_end_time.split(':').map(Number);
        const outMins = (now.getHours() * 60) + now.getMinutes();
        const endMins = (eH * 60) + eM;
        if (outMins > endMins) {
          overtimeHours = parseFloat(((outMins - endMins) / 60).toFixed(1));
        }
      }

      const existing = query("SELECT * FROM attendance WHERE staff_id = ? AND date = ?", [staffId, todayStr]);
      if (existing.length === 0 || !existing[0].punch_in) {
        return { success: false, message: 'No Punch-In recorded for today yet. Punch In first.' };
      }

      run(`
        UPDATE attendance 
        SET punch_out = ?, overtime_hours = ?, punch_method = 'PIN_KIOSK', updated_at = CURRENT_TIMESTAMP, sync_status = 0
        WHERE id = ?
      `, [punchTime, overtimeHours, existing[0].id]);

      reloadFromDb();
      return {
        success: true,
        staffName: staff.name,
        punchTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        overtimeHours,
        action: 'OUT'
      };
    } catch (err) {
      console.error('Kiosk punch out error:', err);
      return { success: false, message: err.message };
    }
  }, [staffList, reloadFromDb]);

  // Add / Edit Staff
  const saveStaff = useCallback((staffData) => {
    try {
      const isTimerEnabled = staffData.is_timer_enabled !== undefined ? (staffData.is_timer_enabled ? 1 : 0) : 1;
      if (staffData.id) {
        // Update
        run(`
          UPDATE staff
          SET name = ?, phone = ?, role = ?, salary_type = ?, base_rate = ?, per_piece_rate = ?,
              work_start_time = ?, work_end_time = ?, pin_code = ?, photo_path = ?,
              is_active = ?, is_timer_enabled = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 0
          WHERE id = ?
        `, [
          staffData.name, staffData.phone, staffData.role, staffData.salary_type,
          staffData.base_rate, staffData.per_piece_rate || 0, staffData.work_start_time, staffData.work_end_time,
          staffData.pin_code, staffData.photo_path, staffData.is_active ?? 1,
          isTimerEnabled, staffData.id
        ]);
        showToast('Staff member updated successfully');
      } else {
        // Insert
        const newId = generateUUID();
        run(`
          INSERT INTO staff (id, name, phone, role, salary_type, base_rate, per_piece_rate, work_start_time, work_end_time, pin_code, photo_path, is_active, is_timer_enabled, sync_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0)
        `, [
          newId, staffData.name, staffData.phone, staffData.role || 'Staff',
          staffData.salary_type || 'MONTHLY', staffData.base_rate || 0,
          staffData.per_piece_rate || 0,
          staffData.work_start_time || '09:00', staffData.work_end_time || '20:00',
          staffData.pin_code || '1234', staffData.photo_path || '',
          isTimerEnabled
        ]);
        showToast('New staff member added');
      }
      reloadFromDb();
      try {
        const targetId = staffData.id || newId;
        const savedStaff = query("SELECT * FROM staff WHERE id = ?", [targetId]);
        if (savedStaff.length > 0) pushRecordToCloud('staff', savedStaff[0]);
      } catch (e) {}
      return true;
    } catch (err) {
      console.error(err);
      showToast('Error saving staff: ' + err.message, 'error');
      return false;
    }
  }, [reloadFromDb, showToast]);

  // Toggle active state (soft delete)
  const toggleStaffActive = useCallback((staffId, currentStatus) => {
    try {
      const newStatus = currentStatus === 1 ? 0 : 1;
      run("UPDATE staff SET is_active = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 0 WHERE id = ?", [newStatus, staffId]);
      reloadFromDb();
      showToast(`Staff marked as ${newStatus ? 'Active' : 'Inactive'}`);
      try {
        const savedStaff = query("SELECT * FROM staff WHERE id = ?", [staffId]);
        if (savedStaff.length > 0) pushRecordToCloud('staff', savedStaff[0]);
      } catch (e) {}
    } catch (err) {
      console.error(err);
      showToast('Failed to update staff status', 'error');
    }
  }, [reloadFromDb, showToast]);

  // Permanently delete a staff member and ALL their data
  const deleteStaff = useCallback((staffId, staffName) => {
    try {
      // Remove attendance records
      run("DELETE FROM attendance WHERE staff_id = ?", [staffId]);
      // Remove salary ledger entries
      run("DELETE FROM salary_ledger WHERE staff_id = ?", [staffId]);
      // Remove the staff record itself
      run("DELETE FROM staff WHERE id = ?", [staffId]);
      reloadFromDb();
      showToast(`${staffName} permanently deleted`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete staff: ' + err.message, 'error');
    }
  }, [reloadFromDb, showToast]);

  // Salary Ledger: Add Advance / Bonus / Deduction / Payout
  const addLedgerTransaction = useCallback((data) => {
    try {
      const transId = generateUUID();
      run(`
        INSERT INTO salary_ledger (id, staff_id, transaction_date, type, amount, payment_mode, remarks, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `, [
        transId,
        data.staff_id,
        data.transaction_date || getTodayStr(),
        data.type,
        parseFloat(data.amount),
        data.payment_mode || 'CASH',
        data.remarks || ''
      ]);
      reloadFromDb();
      showToast(`${data.type} of ₹${data.amount} recorded!`);
      try {
        pushRecordToCloud('salary_ledger', {
          id: transId,
          staff_id: data.staff_id,
          transaction_date: data.transaction_date || getTodayStr(),
          type: data.type,
          amount: parseFloat(data.amount),
          payment_mode: data.payment_mode || 'CASH',
          remarks: data.remarks || ''
        });
      } catch (e) {}
      return true;
    } catch (err) {
      console.error(err);
      showToast('Failed to record transaction: ' + err.message, 'error');
      return false;
    }
  }, [reloadFromDb, showToast]);

  // Delete ledger item
  const deleteLedgerTransaction = useCallback((id) => {
    try {
      run("DELETE FROM salary_ledger WHERE id = ?", [id]);
      reloadFromDb();
      showToast('Ledger entry removed');
    } catch (err) {
      showToast('Failed to delete transaction', 'error');
    }
  }, [reloadFromDb, showToast]);

  // Download raw SQLite Database file (.sqlite)
  const downloadSqliteBackup = useCallback(() => {
    try {
      const bytes = exportSqliteBytes();
      const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ekdant_attendance_backup_${getTodayStr()}.sqlite`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('SQLite Database backup downloaded successfully!');
    } catch (err) {
      showToast('Failed to export SQLite file: ' + err.message, 'error');
    }
  }, [showToast]);

  // Restore DB from file
  const restoreSqliteBackup = useCallback(async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      importSqliteBytes(bytes);
      reloadFromDb();
      showToast('Database successfully restored from backup file!');
    } catch (err) {
      showToast('Restore failed: invalid SQLite file: ' + err.message, 'error');
    }
  }, [reloadFromDb, showToast]);

  // Reset to default shop seed data
  const resetToFactoryDemo = useCallback(() => {
    try {
      clearDatabase();
      const db = initDatabase();
      db.then(d => {
        seedDatabaseIfEmpty(d);
        reloadFromDb();
        showToast('Reset to demo supermarket records');
      });
    } catch (err) {
      showToast('Reset failed: ' + err.message, 'error');
    }
  }, [reloadFromDb, showToast]);

  // Save / Update Shop Profile
  const saveShopProfile = useCallback((profileData) => {
    try {
      const existing = query("SELECT * FROM shop_profile LIMIT 1");
      const id = existing.length > 0 ? existing[0].id : generateUUID();
      const shopName = profileData.shop_name?.trim() || '';
      const phoneNo = profileData.phone_number?.trim() || '';
      const ownerName = profileData.owner_name?.trim() || '';
      const address = profileData.address?.trim() || '';
      const timerTracking = profileData.timer_tracking_enabled !== undefined ? (profileData.timer_tracking_enabled ? 1 : 0) : 1;

      if (!shopName || !phoneNo) {
        showToast('Shop Name and Phone Number are required', 'error');
        return false;
      }

      if (existing.length > 0) {
        run(
          "UPDATE shop_profile SET shop_name = ?, phone_number = ?, owner_name = ?, address = ?, timer_tracking_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [shopName, phoneNo, ownerName, address, timerTracking, id]
        );
      } else {
        run(
          "INSERT INTO shop_profile (id, shop_name, phone_number, owner_name, address, timer_tracking_enabled) VALUES (?, ?, ?, ?, ?, ?)",
          [id, shopName, phoneNo, ownerName, address, timerTracking]
        );
      }

      const updated = { id, shop_name: shopName, phone_number: phoneNo, owner_name: ownerName, address, timer_tracking_enabled: timerTracking };
      setShopProfile(updated);
      localStorage.setItem('ekdant_shop_profile', JSON.stringify(updated));
      showToast('Shop details registered & saved successfully!');
      try {
        pushRecordToCloud('shop_profile', updated);
      } catch (e) {}
      return true;
    } catch (err) {
      showToast('Failed to save shop details: ' + err.message, 'error');
      return false;
    }
  }, [showToast]);

  // Toggle global staff shift timer tracking
  const toggleGlobalTimerTracking = useCallback(() => {
    try {
      const current = (shopProfile?.timer_tracking_enabled !== 0) ? 1 : 0;
      const nextVal = current === 1 ? 0 : 1;
      const existing = query("SELECT * FROM shop_profile LIMIT 1");
      if (existing.length > 0) {
        run("UPDATE shop_profile SET timer_tracking_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [nextVal, existing[0].id]);
      } else {
        run("INSERT INTO shop_profile (id, shop_name, phone_number, timer_tracking_enabled) VALUES (?, 'My Shop', '0000000000', ?)", [generateUUID(), nextVal]);
      }
      const updated = { ...(shopProfile || {}), timer_tracking_enabled: nextVal };
      setShopProfile(updated);
      localStorage.setItem('ekdant_shop_profile', JSON.stringify(updated));
      showToast(nextVal ? 'Staff shift timers & late tracking enabled' : 'Staff shift timers & late tracking disabled');
    } catch (err) {
      showToast('Failed to toggle timer setting: ' + err.message, 'error');
    }
  }, [shopProfile, showToast]);

  // Execute Auto Backup (saves snapshot every 2 hours)
  const executeAutoBackup = useCallback((isManual = false) => {
    try {
      const bytes = exportSqliteBytes();
      if (!bytes || bytes.length === 0) return;

      // Base64 chunked encode
      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binaryString += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      const base64Data = btoa(binaryString);
      const now = Date.now();
      const timestampStr = new Date(now).toLocaleString();

      const backupItem = {
        id: generateUUID(),
        timestamp: now,
        dateFormatted: timestampStr,
        sizeBytes: bytes.length,
        staffCount: staffList.length,
        shopName: shopProfile?.shop_name || 'Shop',
        data: base64Data
      };

      const existingHistory = JSON.parse(localStorage.getItem('ekdant_auto_backup_history') || '[]');
      const newHistory = [backupItem, ...existingHistory.slice(0, 5)];

      localStorage.setItem('ekdant_auto_backup_history', JSON.stringify(newHistory));
      localStorage.setItem('ekdant_last_auto_backup_ts', String(now));

      setLastAutoBackupTime(now);
      setAutoBackupHistory(newHistory);

      if (isManual) {
        showToast('Local backup saved successfully!');
      } else {
        showToast('Local backup snapshot saved', 'info');
      }
    } catch (err) {
      console.warn('Auto backup failed:', err);
    }
  }, [staffList.length, shopProfile, showToast]);

  // Check 2-hour backup timer
  useEffect(() => {
    if (!isDbReady) return;

    const checkBackup = () => {
      const lastTs = localStorage.getItem('ekdant_last_auto_backup_ts');
      const now = Date.now();
      if (!lastTs || (now - parseInt(lastTs, 10)) >= AUTO_BACKUP_INTERVAL_MS) {
        executeAutoBackup(false);
      }
    };

    const initialTimer = setTimeout(checkBackup, 4000);
    const interval = setInterval(checkBackup, 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isDbReady, executeAutoBackup, AUTO_BACKUP_INTERVAL_MS]);

  // Restore from an auto-backup snapshot item
  const restoreAutoBackupSnapshot = useCallback((backupItem) => {
    try {
      if (!backupItem?.data) throw new Error('Backup data is missing');
      const binaryString = atob(backupItem.data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      importSqliteBytes(bytes);
      reloadFromDb();
      showToast(`Database restored from auto-backup (${backupItem.dateFormatted})!`);
    } catch (err) {
      showToast('Restore failed: ' + err.message, 'error');
    }
  }, [reloadFromDb, showToast]);

  // Handle incoming real-time records from cloud (Other Devices)
  const handleCloudIncomingUpdate = useCallback(({ table, records }) => {
    if (!records || records.length === 0) return;
    try {
      if (table === 'attendance') {
        records.forEach(rec => {
          if (!rec.id || !rec.staff_id || !rec.date) return;
          const exists = query("SELECT id FROM attendance WHERE id = ?", [rec.id]);
          if (exists.length > 0) {
            run(`
              UPDATE attendance
              SET staff_id = ?, date = ?, punch_in = ?, punch_out = ?, status = ?,
                  late_minutes = ?, overtime_hours = ?, punch_method = ?, pieces_produced = ?,
                  notes = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 1
              WHERE id = ?
            `, [
              rec.staff_id, rec.date, rec.punch_in || null, rec.punch_out || null,
              rec.status || 'PRESENT', rec.late_minutes || 0, rec.overtime_hours || 0,
              rec.punch_method || 'CLOUD', rec.pieces_produced || 0, rec.notes || '', rec.id
            ]);
          } else {
            run(`
              INSERT INTO attendance (id, staff_id, date, punch_in, punch_out, status, late_minutes, overtime_hours, punch_method, pieces_produced, notes, sync_status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `, [
              rec.id, rec.staff_id, rec.date, rec.punch_in || null, rec.punch_out || null,
              rec.status || 'PRESENT', rec.late_minutes || 0, rec.overtime_hours || 0,
              rec.punch_method || 'CLOUD', rec.pieces_produced || 0, rec.notes || ''
            ]);
          }
        });
      } else if (table === 'staff') {
        records.forEach(s => {
          if (!s.id || !s.name) return;
          const exists = query("SELECT id FROM staff WHERE id = ?", [s.id]);
          if (exists.length > 0) {
            run(`
              UPDATE staff
              SET name = ?, phone = ?, role = ?, salary_type = ?, base_rate = ?, per_piece_rate = ?,
                  work_start_time = ?, work_end_time = ?, pin_code = ?, photo_path = ?,
                  is_active = ?, is_timer_enabled = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 1
              WHERE id = ?
            `, [
              s.name, s.phone || '', s.role || 'Staff', s.salary_type || 'MONTHLY',
              s.base_rate || 0, s.per_piece_rate || 0, s.work_start_time || '09:00',
              s.work_end_time || '20:00', s.pin_code || '1234', s.photo_path || '',
              s.is_active ?? 1, s.is_timer_enabled ?? 1, s.id
            ]);
          } else {
            run(`
              INSERT INTO staff (id, name, phone, role, salary_type, base_rate, per_piece_rate, work_start_time, work_end_time, pin_code, photo_path, is_active, is_timer_enabled, sync_status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `, [
              s.id, s.name, s.phone || '', s.role || 'Staff', s.salary_type || 'MONTHLY',
              s.base_rate || 0, s.per_piece_rate || 0, s.work_start_time || '09:00',
              s.work_end_time || '20:00', s.pin_code || '1234', s.photo_path || '',
              s.is_active ?? 1, s.is_timer_enabled ?? 1
            ]);
          }
        });
      } else if (table === 'salary_ledger') {
        records.forEach(l => {
          if (!l.id || !l.staff_id) return;
          const exists = query("SELECT id FROM salary_ledger WHERE id = ?", [l.id]);
          if (exists.length > 0) {
            run(`
              UPDATE salary_ledger
              SET staff_id = ?, transaction_date = ?, type = ?, amount = ?, payment_mode = ?, remarks = ?, sync_status = 1
              WHERE id = ?
            `, [
              l.staff_id, l.transaction_date || getTodayStr(), l.type || 'ADVANCE',
              parseFloat(l.amount) || 0, l.payment_mode || 'CASH', l.remarks || '', l.id
            ]);
          } else {
            run(`
              INSERT INTO salary_ledger (id, staff_id, transaction_date, type, amount, payment_mode, remarks, sync_status)
              VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            `, [
              l.id, l.staff_id, l.transaction_date || getTodayStr(), l.type || 'ADVANCE',
              parseFloat(l.amount) || 0, l.payment_mode || 'CASH', l.remarks || ''
            ]);
          }
        });
      } else if (table === 'shop_profile') {
        records.forEach(p => {
          if (!p.id || !p.shop_name) return;
          const exists = query("SELECT id FROM shop_profile WHERE id = ?", [p.id]);
          if (exists.length > 0) {
            run(`
              UPDATE shop_profile
              SET shop_name = ?, phone_number = ?, owner_name = ?, address = ?, timer_tracking_enabled = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [
              p.shop_name, p.phone_number || '', p.owner_name || '', p.address || '',
              p.timer_tracking_enabled ?? 1, p.id
            ]);
          } else {
            run(`
              INSERT INTO shop_profile (id, shop_name, phone_number, owner_name, address, timer_tracking_enabled)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              p.id, p.shop_name, p.phone_number || '', p.owner_name || '', p.address || '',
              p.timer_tracking_enabled ?? 1
            ]);
          }
        });
      }

      reloadFromDb();
      setLastCloudSyncTime(Date.now());
    } catch (e) {
      console.warn('Error merging cloud data into SQLite:', e);
    }
  }, [reloadFromDb, getTodayStr]);

  // Two-way manual sync now
  const syncCloudNow = useCallback(async (silent = false) => {
    if (!isCloudSyncReady()) {
      if (!silent) showToast('Please configure Firebase and Shop Code in Settings first', 'error');
      return false;
    }

    try {
      if (!silent) showToast('Syncing with cloud...', 'info');
      const localStaff = query("SELECT * FROM staff");
      const localAtt = query("SELECT * FROM attendance");
      const localLedger = query("SELECT * FROM salary_ledger");
      const localProfile = query("SELECT * FROM shop_profile LIMIT 1")[0] || null;

      const result = await executeFullCloudSync({
        staff: localStaff,
        attendance: localAtt,
        salaryLedger: localLedger,
        shopProfile: localProfile
      });

      if (result.success) {
        if (result.cloudData.staff) {
          handleCloudIncomingUpdate({ table: 'staff', records: result.cloudData.staff });
        }
        if (result.cloudData.attendance) {
          handleCloudIncomingUpdate({ table: 'attendance', records: result.cloudData.attendance });
        }
        if (result.cloudData.salaryLedger) {
          handleCloudIncomingUpdate({ table: 'salary_ledger', records: result.cloudData.salaryLedger });
        }
        if (result.cloudData.shopProfile) {
          handleCloudIncomingUpdate({ table: 'shop_profile', records: [result.cloudData.shopProfile] });
        }

        setLastCloudSyncTime(result.timestamp);
        setIsCloudReady(true);
        if (!silent) showToast('✓ Real-time sync complete between devices!');
        return true;
      } else {
        if (!silent) showToast('Sync failed: ' + result.message, 'error');
        return false;
      }
    } catch (err) {
      if (!silent) showToast('Cloud sync error: ' + err.message, 'error');
      return false;
    }
  }, [handleCloudIncomingUpdate, showToast]);

  // Update cloud sync configuration
  const updateCloudSyncSettings = useCallback(async ({ config, shopCode, role }) => {
    try {
      const initResult = saveCloudSyncSettings({ config, shopCode, role });
      setCloudShopCode(shopCode?.toUpperCase() || '');
      setDeviceRole(role || 'owner');
      setIsCloudReady(initResult.initialized);

      if (initResult.initialized) {
        startRealtimeListeners(handleCloudIncomingUpdate);
        showToast('✓ Cloud sync connected! Syncing devices...', 'success');
        await syncCloudNow();
      } else {
        showToast('Cloud sync settings saved');
      }
      return true;
    } catch (err) {
      showToast('Failed to save cloud sync settings: ' + err.message, 'error');
      return false;
    }
  }, [handleCloudIncomingUpdate, syncCloudNow, showToast]);

  // Auto-start listeners & background sync on mount
  useEffect(() => {
    if (!isDbReady) return;
    initFirebaseService();
    if (isCloudSyncReady()) {
      setIsCloudReady(true);
      startRealtimeListeners(handleCloudIncomingUpdate);
      // Auto push/pull on launch so mobile pushes its shop data immediately
      syncCloudNow(true);
    }
    return () => {
      stopRealtimeListeners();
    };
  }, [isDbReady, handleCloudIncomingUpdate, syncCloudNow]);

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        isDbReady,
        dbError,
        initAppDb,
        activeTab,
        setActiveTab,
        selectedDate,
        setSelectedDate,
        staffList,
        attendanceRecords,
        salaryLedger,
        shopProfile,
        saveShopProfile,
        toggleGlobalTimerTracking,
        lastAutoBackupTime,
        autoBackupHistory,
        executeAutoBackup,
        restoreAutoBackupSnapshot,
        toast,
        showToast,
        markAttendance,
        markAllPresent,
        updatePiecesProduced,
        kioskPunchIn,
        kioskPunchOut,
        saveStaff,
        toggleStaffActive,
        deleteStaff,
        addLedgerTransaction,
        deleteLedgerTransaction,
        downloadSqliteBackup,
        restoreSqliteBackup,
        resetToFactoryDemo,
        reloadFromDb,
        getTodayStr,
        // Live Multi-Device Cloud Sync
        isCloudReady,
        cloudShopCode,
        deviceRole,
        lastCloudSyncTime,
        syncCloudNow,
        updateCloudSyncSettings,
        getStoredFirebaseConfig
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
