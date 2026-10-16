import { generateUUID } from './sqliteEngine';

export const INITIAL_STAFF = [
  {
    id: 'staff-101-ramesh-mgr',
    name: 'Ramesh Kumar',
    phone: '+91 98765 43210',
    role: 'Store Manager',
    salary_type: 'MONTHLY',
    base_rate: 26000,
    work_start_time: '09:00',
    work_end_time: '20:00',
    pin_code: '1122',
    photo_path: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    is_active: 1,
    sync_status: 0
  },
  {
    id: 'staff-102-priya-cashier',
    name: 'Priya Sharma',
    phone: '+91 98221 87654',
    role: 'Head Cashier',
    salary_type: 'MONTHLY',
    base_rate: 19500,
    work_start_time: '09:30',
    work_end_time: '20:30',
    pin_code: '2233',
    photo_path: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    is_active: 1,
    sync_status: 0
  },
  {
    id: 'staff-103-suresh-helper',
    name: 'Suresh Yadav',
    phone: '+91 97112 34567',
    role: 'Inventory & Stock Helper',
    salary_type: 'DAILY',
    base_rate: 700,
    work_start_time: '09:00',
    work_end_time: '19:30',
    pin_code: '3344',
    photo_path: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    is_active: 1,
    sync_status: 0
  },
  {
    id: 'staff-104-anita-sales',
    name: 'Anita Verma',
    phone: '+91 96543 21098',
    role: 'Counter Sales',
    salary_type: 'MONTHLY',
    base_rate: 16500,
    work_start_time: '10:00',
    work_end_time: '21:00',
    pin_code: '4455',
    photo_path: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    is_active: 1,
    sync_status: 0
  },
  {
    id: 'staff-105-vikas-delivery',
    name: 'Vikas Patel',
    phone: '+91 99887 76655',
    role: 'Delivery Associate',
    salary_type: 'HOURLY',
    base_rate: 90,
    per_piece_rate: 0,
    work_start_time: '10:00',
    work_end_time: '20:00',
    pin_code: '5566',
    photo_path: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    is_active: 1,
    sync_status: 0
  },
  {
    id: 'staff-106-kavita-packer',
    name: 'Kavita Desai',
    phone: '+91 98011 55432',
    role: 'Packing Worker',
    salary_type: 'PIECE_RATE',
    base_rate: 0,
    per_piece_rate: 12,
    work_start_time: '09:00',
    work_end_time: '18:00',
    pin_code: '6677',
    photo_path: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=150&auto=format&fit=crop&q=80',
    is_active: 1,
    sync_status: 0
  }
];

export function generateSeedData(currentDateStr = null) {
  const today = currentDateStr ? new Date(currentDateStr) : new Date();
  const attendance = [];
  const ledger = [];

  // Generate for past 12 days up to today
  for (let i = 12; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay(); // 0 is Sunday

    INITIAL_STAFF.forEach(staff => {
      // If Sunday, give leave to some staff
      if (dayOfWeek === 0 && staff.id === 'staff-103-suresh-helper') {
        attendance.push({
          id: generateUUID(),
          staff_id: staff.id,
          date: dateStr,
          punch_in: null,
          punch_out: null,
          status: 'LEAVE',
          late_minutes: 0,
          overtime_hours: 0,
          punch_method: 'MANUAL',
          notes: 'Weekly off',
          sync_status: 0
        });
        return;
      }

      // Randomize realistic punch attendance
      const rand = (staff.name.charCodeAt(0) + i) % 10;
      if (i > 0 && rand === 9) {
        // Absent
        attendance.push({
          id: generateUUID(),
          staff_id: staff.id,
          date: dateStr,
          punch_in: null,
          punch_out: null,
          status: 'ABSENT',
          late_minutes: 0,
          overtime_hours: 0,
          punch_method: 'MANUAL',
          notes: 'Uninformed absence',
          sync_status: 0
        });
      } else if (i > 0 && rand === 8) {
        // Half Day
        const punchIn = `${dateStr}T${staff.work_start_time}:00`;
        const punchOut = `${dateStr}T14:30:00`;
        attendance.push({
          id: generateUUID(),
          staff_id: staff.id,
          date: dateStr,
          punch_in: punchIn,
          punch_out: punchOut,
          status: 'HALF_DAY',
          late_minutes: 0,
          overtime_hours: 0,
          punch_method: 'PIN_KIOSK',
          notes: 'Personal work in afternoon',
          sync_status: 0
        });
      } else {
        // Present
        const isLate = rand % 3 === 0;
        const lateMins = isLate ? (10 + (rand * 3)) : 0;
        const otHours = (rand % 4 === 0) ? 1.5 : 0;

        const [startH, startM] = staff.work_start_time.split(':').map(Number);
        const inTotalMins = (startH * 60) + startM + lateMins;
        const inH = String(Math.floor(inTotalMins / 60)).padStart(2, '0');
        const inM = String(inTotalMins % 60).padStart(2, '0');
        const punchIn = `${dateStr}T${inH}:${inM}:00`;

        const [endH, endM] = staff.work_end_time.split(':').map(Number);
        const outTotalMins = (endH * 60) + endM + Math.round(otHours * 60);
        const outH = String(Math.floor(outTotalMins / 60)).padStart(2, '0');
        const outM = String(outTotalMins % 60).padStart(2, '0');
        const punchOut = (i === 0 && new Date().getHours() < 18) ? null : `${dateStr}T${outH}:${outM}:00`;

        attendance.push({
          id: generateUUID(),
          staff_id: staff.id,
          date: dateStr,
          punch_in: punchIn,
          punch_out: punchOut,
          status: 'PRESENT',
          late_minutes: lateMins,
          overtime_hours: otHours,
          punch_method: (rand % 2 === 0) ? 'PIN_KIOSK' : 'MANUAL',
          pieces_produced: staff.salary_type === 'PIECE_RATE' ? (80 + (rand * 12)) : 0,
          notes: isLate ? 'Slight traffic delay' : (otHours > 0 ? 'Customer rush assistance' : ''),
          sync_status: 0
        });
      }
    });
  }

  // Sample ledger entries (advances, bonuses, deductions)
  const d5 = new Date(today);
  d5.setDate(today.getDate() - 8);
  const date5 = d5.toISOString().split('T')[0];

  const d2 = new Date(today);
  d2.setDate(today.getDate() - 3);
  const date2 = d2.toISOString().split('T')[0];

  ledger.push({
    id: generateUUID(),
    staff_id: 'staff-101-ramesh-mgr',
    transaction_date: date5,
    type: 'ADVANCE',
    amount: 3500,
    payment_mode: 'UPI',
    remarks: 'Family emergency advance',
    sync_status: 0
  });

  ledger.push({
    id: generateUUID(),
    staff_id: 'staff-101-ramesh-mgr',
    transaction_date: date2,
    type: 'BONUS',
    amount: 1500,
    payment_mode: 'BANK',
    remarks: 'Monthly sales target incentive',
    sync_status: 0
  });

  ledger.push({
    id: generateUUID(),
    staff_id: 'staff-102-priya-cashier',
    transaction_date: date5,
    type: 'ADVANCE',
    amount: 2000,
    payment_mode: 'CASH',
    remarks: 'Home utility bills advance',
    sync_status: 0
  });

  ledger.push({
    id: generateUUID(),
    staff_id: 'staff-103-suresh-helper',
    transaction_date: date5,
    type: 'ADVANCE',
    amount: 1200,
    payment_mode: 'CASH',
    remarks: 'Mid-month cash advance',
    sync_status: 0
  });

  ledger.push({
    id: generateUUID(),
    staff_id: 'staff-104-anita-sales',
    transaction_date: date2,
    type: 'BONUS',
    amount: 800,
    payment_mode: 'UPI',
    remarks: 'Best customer service rating bonus',
    sync_status: 0
  });

  ledger.push({
    id: generateUUID(),
    staff_id: 'staff-105-vikas-delivery',
    transaction_date: date2,
    type: 'DEDUCTION',
    amount: 250,
    payment_mode: 'CASH',
    remarks: 'Damaged shipment container penalty',
    sync_status: 0
  });

  return { staff: INITIAL_STAFF, attendance, ledger };
}

// Seed the database if empty
export function seedDatabaseIfEmpty(db) {
  const existingStaff = db.exec("SELECT COUNT(*) as cnt FROM staff");
  const count = existingStaff.length > 0 ? existingStaff[0].values[0][0] : 0;
  if (count === 0) {
    const { staff, attendance, ledger } = generateSeedData();

    // Insert staff
    const staffStmt = db.prepare(`
      INSERT INTO staff (id, name, phone, role, salary_type, base_rate, per_piece_rate, work_start_time, work_end_time, pin_code, photo_path, is_active, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    staff.forEach(s => {
      staffStmt.run([
        s.id, s.name, s.phone, s.role, s.salary_type, s.base_rate, s.per_piece_rate || 0,
        s.work_start_time, s.work_end_time, s.pin_code, s.photo_path,
        s.is_active, s.sync_status
      ]);
    });
    staffStmt.free();

    // Insert attendance
    const attStmt = db.prepare(`
      INSERT INTO attendance (id, staff_id, date, punch_in, punch_out, status, late_minutes, overtime_hours, punch_method, pieces_produced, notes, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    attendance.forEach(a => {
      attStmt.run([
        a.id, a.staff_id, a.date, a.punch_in, a.punch_out, a.status,
        a.late_minutes, a.overtime_hours, a.punch_method, a.pieces_produced || 0, a.notes, a.sync_status
      ]);
    });
    attStmt.free();

    // Insert ledger
    const ledStmt = db.prepare(`
      INSERT INTO salary_ledger (id, staff_id, transaction_date, type, amount, payment_mode, remarks, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    ledger.forEach(l => {
      ledStmt.run([
        l.id, l.staff_id, l.transaction_date, l.type, l.amount, l.payment_mode, l.remarks, l.sync_status
      ]);
    });
    ledStmt.free();

    return true;
  }
  return false;
}
