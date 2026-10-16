# System Architecture & Technical Specification: Offline-First Staff Attendance & Payroll (Shop Edition)

## 1. Project Overview & Objectives
A lightweight, 100% offline-first desktop and mobile attendance application tailored for retail shops, grocery stores, and local businesses. 

### Key Principles
- **Zero Cloud / Zero Internet Dependency:** Initial version runs completely self-contained with no external API calls or telemetry.
- **Local SQLite Storage:** All logs, staff records, and salary ledgers persist on disk.
- **Future-Ready Sync Architecture:** Schema and change-tracking columns (`sync_status`, `updated_at`, `uuid`) ready for future cloud replication.
- **Cross-Platform Delivery:**
  - Desktop: Windows / macOS / Linux (Tauri + React/Svelte or Electron).
  - Mobile / Tablet Kiosk: Android / iOS (Flutter or React Native with local SQLite).

---

## 2. Recommended Tech Stack

| Layer | Recommended Choice | Alternative | Justification |
| :--- | :--- | :--- | :--- |
| **Desktop Shell** | **Tauri (Rust + Web)** | Electron | Tauri produces tiny binaries (<15 MB), uses very low RAM, and runs fast on older shop counter PCs. |
| **Mobile App / Kiosk** | **Flutter** | React Native | Single codebase for Android/iOS tablets; native SQLite support via `sqflite`/`drift`. |
| **Local Database** | **SQLite (WAL mode enabled)** | DuckDB / TinyDB | Zero setup, rock-solid ACID transactions, file-based portability. |
| **UI Framework** | **React / Tailwind CSS** | Svelte / Vue | Rapid interface design and rich table/form ecosystems. |
| **Report Generation** | **Local PDF / CSV Exporter** | Excel export | Generates pay slips and monthly muster rolls locally without network. |

---

## 3. Database Schema (SQLite)

```sql
-- Staff Master Table
CREATE TABLE staff (
    id TEXT PRIMARY KEY,               -- UUID v4
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'Staff',          -- Helper, Cashier, Manager
    salary_type TEXT NOT NULL,         -- 'MONTHLY', 'DAILY', 'HOURLY'
    base_rate REAL NOT NULL,           -- Monthly wage or daily rate
    work_start_time TEXT DEFAULT '09:00',
    work_end_time TEXT DEFAULT '20:00',
    pin_code TEXT,                     -- 4-digit PIN for Kiosk check-in
    photo_path TEXT,                   -- Local path to staff profile image
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_status INTEGER DEFAULT 0      -- 0 = local/unsynced, 1 = synced
);

-- Daily Attendance Log
CREATE TABLE attendance (
    id TEXT PRIMARY KEY,               -- UUID v4
    staff_id TEXT NOT NULL,
    date TEXT NOT NULL,                -- YYYY-MM-DD
    punch_in DATETIME,
    punch_out DATETIME,
    status TEXT NOT NULL,              -- 'PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'
    late_minutes INTEGER DEFAULT 0,
    overtime_hours REAL DEFAULT 0.0,
    punch_method TEXT DEFAULT 'MANUAL',-- 'MANUAL', 'PIN_KIOSK', 'FACE_LOCAL'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_status INTEGER DEFAULT 0,
    FOREIGN KEY(staff_id) REFERENCES staff(id)
);

-- Advance Payments & Salary Adjustments Ledger
CREATE TABLE salary_ledger (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    transaction_date TEXT NOT NULL,    -- YYYY-MM-DD
    type TEXT NOT NULL,                -- 'ADVANCE', 'BONUS', 'DEDUCTION', 'PAYOUT'
    amount REAL NOT NULL,
    payment_mode TEXT DEFAULT 'CASH',  -- 'CASH', 'UPI', 'BANK'
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_status INTEGER DEFAULT 0,
    FOREIGN KEY(staff_id) REFERENCES staff(id)
);
```

---

## 4. Core Feature Modules

### 4.1. Fast Attendance Marking
- **Shop Owner Quick View:** A 1-click grid showing all staff with buttons for `Present (P)`, `Absent (A)`, `Half-Day (HD)`, and `Paid Leave (L)`.
- **Counter Kiosk Mode:** A fullscreen locked screen where staff tap their name or avatar and enter a 4-digit PIN to punch in and out.
- **Automatic Shift & Late Detection:** Compares punch-in timestamp against shift start time and calculates late arrival minutes automatically.

### 4.2. Salary & Advance Khata Calculation
- **Monthly Salary Calculation:**
  $$\text{Net Salary} = (\text{Days Worked} \times \text{Daily Equivalent}) + \text{Overtime Pay} + \text{Bonuses} - \text{Advances Taken} - \text{Deductions}$$
- **Daily Wage Calculation:**
  $$\text{Net Pay} = (\text{Total Present Days} \times \text{Daily Rate}) - \text{Advances}$$
- Real-time balance tracker per staff member showing pending advance amounts.

### 4.3. Offline Data Backup & Portability
- **One-Click Local Backup:** Export database as an encrypted `.sqlite` or `.db` backup file to a local USB flash drive or folder.
- **Reports:**
  - Monthly attendance sheet (Muster Roll) exported directly as printable PDF or `.csv` spreadsheet.
  - Staff salary slips generated offline in PDF format.

---

## 5. Forward-Compatibility: Preparing for Internet Sync

To ensure smooth migration to a cloud database (Supabase, PostgreSQL, or Firebase) later without rewriting the app:
1. **UUID Primary Keys:** All tables use client-generated UUIDs (`id TEXT PRIMARY KEY`) rather than auto-incrementing integers (`1, 2, 3`) to avoid ID collisions during future multi-device syncing.
2. **Change Tracking Columns:** Every record includes `updated_at` (UTC timestamp) and `sync_status` (`0` = not synced, `1` = synced).
3. **Soft Deletes:** Records are marked `is_active = 0` or `deleted_at = TIMESTAMP` rather than physically deleted, enabling delete-syncing later.
4. **Local REST / WebSocket Interface (LAN Sync):** Optional feature allowing the mobile kiosk app and counter PC to sync locally over shop Wi-Fi / hotspot even without internet connectivity.