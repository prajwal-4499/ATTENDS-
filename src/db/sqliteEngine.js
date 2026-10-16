import initSqlJs from 'sql.js';

// Schema matching offline_attendance_system_spec.md
export const SCHEMA_SQL = `
-- Staff Master Table
CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'Staff',
    salary_type TEXT NOT NULL,          -- 'MONTHLY', 'DAILY', 'HOURLY', 'PIECE_RATE'
    base_rate REAL NOT NULL,
    per_piece_rate REAL DEFAULT 0,      -- Rate per piece for PIECE_RATE workers
    work_start_time TEXT DEFAULT '09:00',
    work_end_time TEXT DEFAULT '20:00',
    is_timer_enabled INTEGER DEFAULT 1,  -- 1 = shift timer & late arrival enabled, 0 = disabled (flexible hours)
    pin_code TEXT,
    photo_path TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_status INTEGER DEFAULT 0
);

-- Daily Attendance Log
CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    date TEXT NOT NULL,
    punch_in DATETIME,
    punch_out DATETIME,
    status TEXT NOT NULL,
    late_minutes INTEGER DEFAULT 0,
    overtime_hours REAL DEFAULT 0.0,
    punch_method TEXT DEFAULT 'MANUAL',
    pieces_produced INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_status INTEGER DEFAULT 0,
    FOREIGN KEY(staff_id) REFERENCES staff(id)
);

-- Advance Payments & Salary Adjustments Ledger
CREATE TABLE IF NOT EXISTS salary_ledger (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_mode TEXT DEFAULT 'CASH',
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_status INTEGER DEFAULT 0,
    FOREIGN KEY(staff_id) REFERENCES staff(id)
);

-- Shop Profile & Registration Table
CREATE TABLE IF NOT EXISTS shop_profile (
    id TEXT PRIMARY KEY,
    shop_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    owner_name TEXT,
    address TEXT,
    timer_tracking_enabled INTEGER DEFAULT 1, -- 1 = staff shift timer & late penalty tracking enabled, 0 = disabled
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const DB_STORAGE_KEY = 'ekdant_shop_attendance_sqlite_bytes_v1';
const DB_METADATA_KEY = 'ekdant_shop_attendance_meta_v1';

let SQL = null;
let dbInstance = null;

// Helper to generate UUID v4
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Convert SQL query results to array of plain JS objects
export function queryToObjects(res) {
  if (!res || res.length === 0) return [];
  const columns = res[0].columns;
  const values = res[0].values;
  return values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

// Save binary DB snapshot to localStorage
export function persistDatabase() {
  if (!dbInstance) return;
  try {
    const binary = dbInstance.export();
    // Convert Uint8Array to binary string chunked for safe storage
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < binary.length; i += chunkSize) {
      binaryString += String.fromCharCode.apply(null, binary.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binaryString);
    localStorage.setItem(DB_STORAGE_KEY, base64);
    localStorage.setItem(DB_METADATA_KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      byteSize: binary.length
    }));
  } catch (err) {
    console.warn('Failed to persist SQLite binary snapshot to localStorage:', err);
  }
}

// Load binary DB snapshot from localStorage
export function loadPersistedBytes() {
  try {
    const base64 = localStorage.getItem(DB_STORAGE_KEY);
    if (!base64) return null;
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    console.warn('Failed to load persisted SQLite bytes:', err);
    return null;
  }
}

// Initialize SQLite WASM
export async function initDatabase() {
  if (dbInstance) return dbInstance;

  try {
    SQL = await initSqlJs({
      locateFile: (file) => {
        // Support file:// protocol (Electron) and http(s):// (Web & mobile)
        return `./${file}`;
      }
    });
  } catch (err) {
    console.warn('WASM initialization attempt 1 failed, trying fallback locateFile...', err);
    try {
      SQL = await initSqlJs({
        locateFile: () => './sql-wasm-browser.wasm'
      });
    } catch (err2) {
      console.warn('WASM initialization attempt 2 failed, trying sql-wasm.wasm...', err2);
      SQL = await initSqlJs({
        locateFile: () => './sql-wasm.wasm'
      });
    }
  }

  let existingBytes = null;
  try {
    existingBytes = loadPersistedBytes();
  } catch (e) {
    console.warn('Could not read existing SQLite localStorage, starting fresh', e);
  }

  if (existingBytes && existingBytes.length > 0) {
    try {
      dbInstance = new SQL.Database(existingBytes);
    } catch (e) {
      console.error('Failed to parse existing SQLite binary, resetting DB:', e);
      localStorage.removeItem(DB_STORAGE_KEY);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Run schema & auto-migrate columns
  try {
    dbInstance.run(SCHEMA_SQL);
    // Migration: pieces_produced in attendance
    const attCols = queryToObjects(dbInstance.exec("PRAGMA table_info(attendance)"));
    if (!attCols.some(c => c.name === 'pieces_produced')) {
      dbInstance.run("ALTER TABLE attendance ADD COLUMN pieces_produced INTEGER DEFAULT 0");
    }
    // Migration: per_piece_rate in staff
    const staffCols = queryToObjects(dbInstance.exec("PRAGMA table_info(staff)"));
    if (!staffCols.some(c => c.name === 'per_piece_rate')) {
      dbInstance.run("ALTER TABLE staff ADD COLUMN per_piece_rate REAL DEFAULT 0");
    }
    // Migration: is_timer_enabled in staff
    if (!staffCols.some(c => c.name === 'is_timer_enabled')) {
      dbInstance.run("ALTER TABLE staff ADD COLUMN is_timer_enabled INTEGER DEFAULT 1");
    }
    // Migration: timer_tracking_enabled in shop_profile
    const shopCols = queryToObjects(dbInstance.exec("PRAGMA table_info(shop_profile)"));
    if (!shopCols.some(c => c.name === 'timer_tracking_enabled')) {
      dbInstance.run("ALTER TABLE shop_profile ADD COLUMN timer_tracking_enabled INTEGER DEFAULT 1");
    }
    persistDatabase();
  } catch (e) {
    console.error('Schema initialization warning:', e);
  }

  return dbInstance;
}

// Execute query with parameters and return array of objects
export function query(sql, params = []) {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Execute statement (INSERT, UPDATE, DELETE)
export function run(sql, params = []) {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  persistDatabase();
}

// Export raw .sqlite binary array
export function exportSqliteBytes() {
  if (!dbInstance) throw new Error('Database not initialized');
  return dbInstance.export();
}

// Import raw .sqlite binary array
export function importSqliteBytes(bytes) {
  if (!SQL) throw new Error('SQL engine not ready');
  dbInstance = new SQL.Database(bytes);
  persistDatabase();
  return dbInstance;
}

// Clear database
export function clearDatabase() {
  if (!SQL) return;
  dbInstance = new SQL.Database();
  dbInstance.run(SCHEMA_SQL);
  persistDatabase();
  return dbInstance;
}
