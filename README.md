# StaffTrack Pro: Offline-First Staff Attendance & Payroll (Shop Edition)

Built in accordance with [offline_attendance_system_spec.md](file:///d:/EKDANT/ATTENDANCE%20SYSTEM/offline_attendance_system_spec.md).

## Features Implemented

### 1. Dual Light & Dark Mode
- Seamless toggle with high-contrast, curated color palettes.
- Persisted to local storage across restarts.
- Print-optimized stylesheet for paper salary slips and muster roll printouts.

### 2. Fast Attendance Marking (Shop Owner Quick View)
- 1-click grid: **Present (P)**, **Absent (A)**, **Half-Day (HD)**, and **Paid Leave (L)**.
- **Bulk Mark All Present** shortcut.
- Search staff by name/phone & filter by job role.
- Attendance remarks/notes popup.

### 3. Dedicated Counter Kiosk Mode
- Live digital clock (HH:MM:SS) and date display.
- Touch-friendly employee card grid.
- **4-Digit PIN Security**: Numeric keypad for touch screens or physical keyboard (0-9, Backspace, Enter).
- **Automatic Shift & Late Detection**:
  - Compares punch-in against `work_start_time` (e.g. 09:00) and displays late arrival minutes.
  - Compares punch-out against `work_end_time` (e.g. 20:00) and displays overtime hours accrued.
- Celebration confetti on punch-in.
- Auto-reset timer back to ready kiosk screen.

### 4. Salary & Advance Khata Calculation
- **Monthly Fixed Wage**:
  $$\text{Net Salary} = (\text{Days Worked} \times \text{Daily Equivalent}) + \text{Overtime Pay} + \text{Bonuses} - \text{Advances Taken} - \text{Deductions}$$
- **Daily Wage**:
  $$\text{Net Pay} = (\text{Effective Days} \times \text{Daily Rate}) + \text{Overtime} + \text{Bonuses} - \text{Advances}$$
- **Hourly Wage**:
  $$\text{Net Pay} = (\text{Total Hours} \times \text{Hourly Rate}) + \text{Overtime} - \text{Advances}$$
- Real-time balance tracker per staff member.
- Passbook transaction ledger for `ADVANCE`, `BONUS`, `DEDUCTION`, `PAYOUT` across `CASH`, `UPI`, and `BANK`.

### 5. Muster Roll Matrix & Offline Payslip Generator
- 1 to 31 days monthly attendance matrix with color-coded status badges.
- Instant **CSV Export** for spreadsheets.
- **Printable Official Payslip**: Formal shop header, earnings, deductions, net payable in figures and words, with signature blocks.

### 6. Local SQLite Engine & Forward Compatibility
- Real **WebAssembly SQLite** (`sql.js`) with ACID queries matching the spec schema.
- **1-Click SQLite Backup**: Download native `.sqlite` file for USB flash drives.
- **Restore Database**: Upload existing `.sqlite` or `.json` snapshot.
- Interactive SQL query console.
- Cloud-ready change tracking: `uuid`, `updated_at`, and `sync_status` columns.

---

## Running Locally

```bash
# Start development server
npm run dev

# Or build production bundle
npm run build
```
Access the application in your browser at: `http://localhost:5173/`
