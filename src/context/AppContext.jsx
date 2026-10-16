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

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Theme state: dark / light
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('ekdant_theme') || 'dark';
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

        if (status === 'PRESENT' && !punchIn) {
          punchIn = timeStr;
          // Calculate late minutes if staff has work_start_time
          const staffObj = staffList.find(s => s.id === staffId);
          if (staffObj && staffObj.work_start_time) {
            const [sH, sM] = staffObj.work_start_time.split(':').map(Number);
            const inTotalMins = (now.getHours() * 60) + now.getMinutes();
            const startTotalMins = (sH * 60) + sM;
            lateMinutes = Math.max(0, inTotalMins - startTotalMins);
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
        let punchIn = null;
        let lateMinutes = 0;

        if (status === 'PRESENT' || status === 'HALF_DAY') {
          punchIn = timeStr;
          if (staffObj && staffObj.work_start_time) {
            const [sH, sM] = staffObj.work_start_time.split(':').map(Number);
            const inTotalMins = (now.getHours() * 60) + now.getMinutes();
            const startTotalMins = (sH * 60) + sM;
            lateMinutes = Math.max(0, inTotalMins - startTotalMins);
          }
        }

        run(`
          INSERT INTO attendance (id, staff_id, date, punch_in, punch_out, status, late_minutes, overtime_hours, punch_method, pieces_produced, notes, sync_status)
          VALUES (?, ?, ?, ?, NULL, ?, ?, 0.0, 'MANUAL', ?, ?, 0)
        `, [generateUUID(), staffId, selectedDate, punchIn, status, lateMinutes, parseInt(pieces) || 0, notes]);
      }

      reloadFromDb();
      showToast(`Marked ${status} for staff`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error saving attendance: ' + err.message, 'error');
    }
  }, [selectedDate, staffList, reloadFromDb, showToast]);

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

      // Calculate late minutes
      let lateMins = 0;
      if (staff.work_start_time) {
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
  }, [staffList, reloadFromDb]);

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
      if (staffData.id) {
        // Update
        run(`
          UPDATE staff
          SET name = ?, phone = ?, role = ?, salary_type = ?, base_rate = ?, per_piece_rate = ?,
              work_start_time = ?, work_end_time = ?, pin_code = ?, photo_path = ?,
              is_active = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 0
          WHERE id = ?
        `, [
          staffData.name, staffData.phone, staffData.role, staffData.salary_type,
          staffData.base_rate, staffData.per_piece_rate || 0, staffData.work_start_time, staffData.work_end_time,
          staffData.pin_code, staffData.photo_path, staffData.is_active ?? 1, staffData.id
        ]);
        showToast('Staff member updated successfully');
      } else {
        // Insert
        const newId = generateUUID();
        run(`
          INSERT INTO staff (id, name, phone, role, salary_type, base_rate, per_piece_rate, work_start_time, work_end_time, pin_code, photo_path, is_active, sync_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
        `, [
          newId, staffData.name, staffData.phone, staffData.role || 'Staff',
          staffData.salary_type || 'MONTHLY', staffData.base_rate || 0,
          staffData.per_piece_rate || 0,
          staffData.work_start_time || '09:00', staffData.work_end_time || '20:00',
          staffData.pin_code || '1234', staffData.photo_path || '',
        ]);
        showToast('New staff member added');
      }
      reloadFromDb();
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
      run(`
        INSERT INTO salary_ledger (id, staff_id, transaction_date, type, amount, payment_mode, remarks, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `, [
        generateUUID(),
        data.staff_id,
        data.transaction_date || getTodayStr(),
        data.type,
        parseFloat(data.amount),
        data.payment_mode || 'CASH',
        data.remarks || ''
      ]);
      reloadFromDb();
      showToast(`${data.type} of ₹${data.amount} recorded!`);
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
        getTodayStr
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
