import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { query } from '../db/sqliteEngine';
import {
  FileSpreadsheet,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  X
} from 'lucide-react';

export default function MusterRollReports() {
  const { staffList, selectedDate, showToast, shopProfile } = useApp();

  // Selected Year and Month (defaults to current)
  const [currentYear, setCurrentYear] = useState(() => {
    return parseInt(selectedDate.split('-')[0]) || 2026;
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    return parseInt(selectedDate.split('-')[1]) || 10;
  });

  const [activePayslipStaff, setActivePayslipStaff] = useState(null);

  // Month navigation
  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Number of days in selected month
  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth, 0).getDate();
  }, [currentYear, currentMonth]);

  // Query all attendance records for this month
  const monthAttendanceData = useMemo(() => {
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}%`;
    try {
      return query("SELECT * FROM attendance WHERE date LIKE ?", [monthPrefix]);
    } catch (e) {
      return [];
    }
  }, [currentYear, currentMonth]);

  // Query salary ledger entries for this month
  const monthLedgerData = useMemo(() => {
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}%`;
    try {
      return query("SELECT * FROM salary_ledger WHERE transaction_date LIKE ?", [monthPrefix]);
    } catch (e) {
      return [];
    }
  }, [currentYear, currentMonth]);

  // Build matrix: staff -> day (1..daysInMonth) -> record
  const musterMatrix = useMemo(() => {
    return staffList.map((staff) => {
      const staffAtt = monthAttendanceData.filter((a) => a.staff_id === staff.id);
      const dayMap = {};
      let totalP = 0;
      let totalA = 0;
      let totalHD = 0;
      let totalL = 0;
      let totalLateMins = 0;
      let totalOtHours = 0;
      let totalPieces = 0;

      staffAtt.forEach((a) => {
        const day = parseInt(a.date.split('-')[2]);
        dayMap[day] = a;

        if (a.status === 'PRESENT') totalP++;
        else if (a.status === 'ABSENT') totalA++;
        else if (a.status === 'HALF_DAY') totalHD++;
        else if (a.status === 'LEAVE') totalL++;

        totalLateMins += (a.late_minutes || 0);
        totalOtHours += (parseFloat(a.overtime_hours) || 0);
        totalPieces += (parseInt(a.pieces_produced) || 0);
      });

      return {
        staff,
        dayMap,
        totalP,
        totalA,
        totalHD,
        totalL,
        totalLateMins,
        totalOtHours: parseFloat(totalOtHours.toFixed(1)),
        totalPieces
      };
    });
  }, [staffList, monthAttendanceData]);

  // Export to CSV
  const exportMusterCsv = () => {
    try {
      const headers = ['Staff ID', 'Staff Name', 'Role', 'Wage Type', 'Base Rate'];
      for (let d = 1; d <= daysInMonth; d++) {
        headers.push(`Day ${d}`);
      }
      headers.push('Present', 'Absent', 'Half-Day', 'Leave', 'Late Mins', 'Overtime Hrs');

      const rows = [headers.join(',')];

      musterMatrix.forEach(({ staff, dayMap, totalP, totalA, totalHD, totalL, totalLateMins, totalOtHours }) => {
        const row = [
          staff.id,
          `"${staff.name}"`,
          `"${staff.role}"`,
          staff.salary_type,
          staff.base_rate
        ];

        for (let d = 1; d <= daysInMonth; d++) {
          const rec = dayMap[d];
          let code = '-';
          if (rec) {
            if (rec.status === 'PRESENT') code = 'P';
            else if (rec.status === 'ABSENT') code = 'A';
            else if (rec.status === 'HALF_DAY') code = 'HD';
            else if (rec.status === 'LEAVE') code = 'L';
          }
          row.push(code);
        }

        row.push(totalP, totalA, totalHD, totalL, totalLateMins, totalOtHours);
        rows.push(row.join(','));
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + rows.join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Muster_Roll_${monthNames[currentMonth - 1]}_${currentYear}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Muster roll exported as CSV!');
    } catch (err) {
      showToast('CSV export failed: ' + err.message, 'error');
    }
  };

  // Helper for converting number to words (simple INR format)
  const numberToWords = (num) => {
    if (num <= 0) return 'Zero Rupees Only';
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const formatHundreds = (n) => {
      let str = '';
      if (n > 99) {
        str += a[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
      }
      if (n > 19) {
        str += b[Math.floor(n / 10)] + ' ';
        n %= 10;
      }
      if (n > 0) {
        str += a[n] + ' ';
      }
      return str;
    };

    let n = Math.floor(num);
    let output = '';

    if (n >= 100000) {
      output += formatHundreds(Math.floor(n / 100000)) + 'Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      output += formatHundreds(Math.floor(n / 1000)) + 'Thousand ';
      n %= 1000;
    }
    if (n > 0) {
      output += formatHundreds(n);
    }
    return output.trim() + ' Rupees Only';
  };

  // Calculate Payslip specifics for activePayslipStaff
  const payslipDetails = useMemo(() => {
    if (!activePayslipStaff) return null;
    const { staff, totalP, totalA, totalHD, totalL, totalOtHours, totalLateMins, totalPieces } = activePayslipStaff;

    const staffTxns = monthLedgerData.filter((l) => l.staff_id === staff.id);
    let advances = 0;
    let bonuses = 0;
    let deductions = 0;

    staffTxns.forEach((t) => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'ADVANCE') advances += amt;
      else if (t.type === 'BONUS') bonuses += amt;
      else if (t.type === 'DEDUCTION') deductions += amt;
    });

    const effectiveDays = totalP + (totalHD * 0.5) + totalL;
    let dailyEquivalent = 0;
    let baseEarned = 0;
    let otRate = 0;

    if (staff.salary_type === 'MONTHLY') {
      dailyEquivalent = staff.base_rate / daysInMonth;
      baseEarned = effectiveDays * dailyEquivalent;
      otRate = dailyEquivalent / 8;
    } else if (staff.salary_type === 'DAILY') {
      dailyEquivalent = staff.base_rate;
      baseEarned = effectiveDays * dailyEquivalent;
      otRate = staff.base_rate / 8;
    } else if (staff.salary_type === 'HOURLY') {
      dailyEquivalent = staff.base_rate * 8;
      baseEarned = effectiveDays * dailyEquivalent;
      otRate = staff.base_rate;
    } else if (staff.salary_type === 'PIECE_RATE') {
      baseEarned = (totalPieces || 0) * (parseFloat(staff.per_piece_rate) || 0);
      otRate = 0;
      dailyEquivalent = effectiveDays > 0 ? (baseEarned / effectiveDays) : 0;
    }

    const otPay = staff.salary_type === 'PIECE_RATE' ? 0 : totalOtHours * otRate;
    const grossPay = Math.round(baseEarned + otPay + bonuses);
    const totalDeductions = Math.round(advances + deductions);
    const netPayable = Math.max(0, grossPay - totalDeductions);

    return {
      staff,
      effectiveDays,
      totalP,
      totalA,
      totalHD,
      totalL,
      totalLateMins,
      totalOtHours,
      totalPieces: totalPieces || 0,
      dailyEquivalent: Math.round(dailyEquivalent),
      baseEarned: Math.round(baseEarned),
      otPay: Math.round(otPay),
      bonuses,
      advances,
      deductions,
      grossPay,
      totalDeductions,
      netPayable
    };
  }, [activePayslipStaff, monthLedgerData, daysInMonth]);

  return (
    <div>
      {/* Month Navigator & Export Bar */}
      <div className="attendance-header-actions no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '0.2rem', border: '1px solid var(--border-subtle)' }}>
            <button className="btn-icon" onClick={prevMonth} title="Previous Month">
              <ChevronLeft size={16} />
            </button>
            <span style={{ padding: '0.3rem 0.85rem', fontWeight: 800, fontSize: '0.95rem', minWidth: '160px', textAlign: 'center' }}>
              {monthNames[currentMonth - 1]} {currentYear}
            </span>
            <button className="btn-icon" onClick={nextMonth} title="Next Month">
              <ChevronRight size={16} />
            </button>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {daysInMonth} Days in Month
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={exportMusterCsv}>
            <Download size={16} />
            <span>Export CSV</span>
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={16} />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="no-print" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.8rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <span className="muster-cell muster-p" style={{ padding: '0.1rem 0.4rem', borderRadius: '4px' }}>P</span> = Present
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <span className="muster-cell muster-a" style={{ padding: '0.1rem 0.4rem', borderRadius: '4px' }}>A</span> = Absent
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <span className="muster-cell muster-hd" style={{ padding: '0.1rem 0.4rem', borderRadius: '4px' }}>HD</span> = Half Day
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <span className="muster-cell muster-l" style={{ padding: '0.1rem 0.4rem', borderRadius: '4px' }}>L</span> = Paid Leave
        </span>
      </div>

      {/* Full Monthly Muster Roll Table */}
      <div className="table-responsive printable-area">
        <div style={{ padding: '1rem', display: 'none' }} className="print-header">
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>EKDANT SUPERMARKET - MONTHLY MUSTER ROLL</h2>
          <p>Period: {monthNames[currentMonth - 1]} {currentYear} • Total Staff: {staffList.length}</p>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg-secondary)', minWidth: '150px' }}>
                Staff Name
              </th>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                <th key={d} className="muster-cell">
                  {d}
                </th>
              ))}
              <th className="muster-cell" style={{ color: 'var(--accent-success)' }}>P</th>
              <th className="muster-cell" style={{ color: 'var(--accent-danger)' }}>A</th>
              <th className="muster-cell" style={{ color: 'var(--accent-warning)' }}>HD</th>
              <th className="muster-cell" style={{ color: 'var(--accent-info)' }}>L</th>
              <th className="muster-cell">Late</th>
              <th className="muster-cell">OT</th>
              <th className="no-print" style={{ textAlign: 'right' }}>Slip</th>
            </tr>
          </thead>
          <tbody>
            {musterMatrix.map((item) => {
              const { staff, dayMap, totalP, totalA, totalHD, totalL, totalLateMins, totalOtHours } = item;
              return (
                <tr key={staff.id}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 5, background: 'var(--bg-card)', fontWeight: 700 }}>
                    <div>{staff.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{staff.role}</div>
                  </td>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                    const rec = dayMap[d];
                    let code = '-';
                    let cls = 'muster-empty';
                    if (rec) {
                      if (rec.status === 'PRESENT') { code = 'P'; cls = 'muster-p'; }
                      else if (rec.status === 'ABSENT') { code = 'A'; cls = 'muster-a'; }
                      else if (rec.status === 'HALF_DAY') { code = 'HD'; cls = 'muster-hd'; }
                      else if (rec.status === 'LEAVE') { code = 'L'; cls = 'muster-l'; }
                    }

                    return (
                      <td key={d} className={`muster-cell ${cls}`} title={rec ? `${rec.status} on Day ${d}` : `Day ${d}`}>
                        {code}
                      </td>
                    );
                  })}
                  <td className="muster-cell muster-p">{totalP}</td>
                  <td className="muster-cell muster-a">{totalA}</td>
                  <td className="muster-cell muster-hd">{totalHD}</td>
                  <td className="muster-cell muster-l">{totalL}</td>
                  <td className="muster-cell" style={{ color: totalLateMins > 0 ? 'var(--accent-danger)' : 'inherit' }}>
                    {totalLateMins}m
                  </td>
                  <td className="muster-cell" style={{ color: totalOtHours > 0 ? 'var(--accent-success)' : 'inherit' }}>
                    {totalOtHours}h
                  </td>
                  <td className="no-print" style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
                      onClick={() => setActivePayslipStaff(item)}
                    >
                      <Receipt size={13} />
                      <span>Payslip</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Official Printable Payslip Modal */}
      {activePayslipStaff && payslipDetails && (
        <div className="modal-overlay" onClick={() => setActivePayslipStaff(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '720px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header no-print">
              <h3 className="modal-title">Staff Salary Slip</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => window.print()}
                >
                  <Printer size={16} />
                  <span>Print Slip / PDF</span>
                </button>
                <button
                  className="btn-icon"
                  onClick={() => setActivePayslipStaff(null)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Formatted Printable Payslip Sheet */}
            <div className="payslip-sheet printable-area">
              <div className="payslip-header">
                <h2>{shopProfile?.shop_name ? shopProfile.shop_name.toUpperCase() : 'SHOP ATTENDANCE & PAYROLL'}</h2>
                <p style={{ fontSize: '0.85rem', color: '#475569' }}>
                  {shopProfile?.address ? `${shopProfile.address} • ` : ''}
                  {shopProfile?.phone_number ? `Ph: ${shopProfile.phone_number}` : ''}
                  {shopProfile?.owner_name ? ` • Prop: ${shopProfile.owner_name}` : ''}
                </p>
                <div style={{
                  display: 'inline-block',
                  background: '#0f172a',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  padding: '0.2rem 0.75rem',
                  borderRadius: '4px',
                  marginTop: '0.5rem',
                  letterSpacing: '0.05em'
                }}>
                  SALARY SLIP FOR {monthNames[currentMonth - 1].toUpperCase()} {currentYear}
                </div>
              </div>

              {/* Staff Details Grid */}
              <div className="payslip-info-grid">
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Employee Name</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{payslipDetails.staff.name}</div>
                  <div style={{ fontSize: '0.82rem', color: '#475569' }}>Role: {payslipDetails.staff.role}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Wage Category</div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>
                    {payslipDetails.staff.salary_type === 'PIECE_RATE' ? (
                      `PIECE RATE @ ₹${payslipDetails.staff.per_piece_rate}/piece`
                    ) : (
                      `${payslipDetails.staff.salary_type} @ ₹${Number(payslipDetails.staff.base_rate).toLocaleString()}`
                    )}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#475569' }}>Phone: {payslipDetails.staff.phone || 'N/A'}</div>
                </div>
              </div>

              {/* Attendance Summary */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: payslipDetails.staff.salary_type === 'PIECE_RATE' ? 'repeat(6, 1fr)' : 'repeat(5, 1fr)',
                gap: '0.5rem',
                textAlign: 'center',
                background: '#f1f5f9',
                padding: '0.6rem',
                borderRadius: '6px',
                marginBottom: '1.25rem',
                fontSize: '0.8rem'
              }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Days in Mo.</div>
                  <div style={{ fontWeight: 800 }}>{daysInMonth}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Present</div>
                  <div style={{ fontWeight: 800, color: '#059669' }}>{payslipDetails.totalP}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Half-Days</div>
                  <div style={{ fontWeight: 800, color: '#d97706' }}>{payslipDetails.totalHD}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Leaves/Off</div>
                  <div style={{ fontWeight: 800, color: '#2563eb' }}>{payslipDetails.totalL}</div>
                </div>
                {payslipDetails.staff.salary_type === 'PIECE_RATE' ? (
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Total Pieces</div>
                    <div style={{ fontWeight: 800, color: '#6366f1' }}>{payslipDetails.totalPieces} pcs</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Overtime Hrs</div>
                    <div style={{ fontWeight: 800 }}>{payslipDetails.totalOtHours}h</div>
                  </div>
                )}
                {payslipDetails.staff.salary_type === 'PIECE_RATE' && (
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Piece Rate</div>
                    <div style={{ fontWeight: 800 }}>₹{payslipDetails.staff.per_piece_rate}/pc</div>
                  </div>
                )}
              </div>

              {/* Earnings & Deductions Table */}
              <table className="payslip-breakdown-table">
                <thead>
                  <tr>
                    <th style={{ width: '50%' }}>EARNINGS</th>
                    <th style={{ width: '50%' }}>DEDUCTIONS & ADVANCES</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span>
                          {payslipDetails.staff.salary_type === 'PIECE_RATE'
                            ? `Piecework (${payslipDetails.totalPieces} units @ ₹${payslipDetails.staff.per_piece_rate}):`
                            : `Basic Earned (${payslipDetails.effectiveDays} days):`}
                        </span>
                        <strong>₹{payslipDetails.baseEarned.toLocaleString()}</strong>
                      </div>
                      {payslipDetails.otPay > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <span>Overtime Pay ({payslipDetails.totalOtHours} hrs):</span>
                          <strong>₹{payslipDetails.otPay.toLocaleString()}</strong>
                        </div>
                      )}
                      {payslipDetails.bonuses > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <span>Incentives / Bonuses:</span>
                          <strong>₹{payslipDetails.bonuses.toLocaleString()}</strong>
                        </div>
                      )}
                    </td>
                    <td style={{ verticalAlign: 'top' }}>
                      {payslipDetails.advances > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <span>Advances Recovered:</span>
                          <strong style={{ color: '#dc2626' }}>₹{payslipDetails.advances.toLocaleString()}</strong>
                        </div>
                      )}
                      {payslipDetails.deductions > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <span>Fines / Penalties:</span>
                          <strong style={{ color: '#dc2626' }}>₹{payslipDetails.deductions.toLocaleString()}</strong>
                        </div>
                      )}
                      {payslipDetails.advances === 0 && payslipDetails.deductions === 0 && (
                        <div style={{ color: '#64748b', fontSize: '0.8rem' }}>No deductions</div>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span>Gross Earnings:</span>
                        <span>₹{payslipDetails.grossPay.toLocaleString()}</span>
                      </div>
                    </td>
                    <td style={{ background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span>Total Deductions:</span>
                        <span>₹{payslipDetails.totalDeductions.toLocaleString()}</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="payslip-total-row">
                    <td colSpan="2" style={{ padding: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#475569' }}>
                            Net Amount Payable:
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', fontWeight: 500 }}>
                            ({numberToWords(payslipDetails.netPayable)})
                          </div>
                        </div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                          ₹{payslipDetails.netPayable.toLocaleString()}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ textAlign: 'center', width: '180px' }}>
                  <div style={{ borderTop: '1px solid #0f172a', paddingTop: '0.35rem', fontSize: '0.8rem', fontWeight: 700 }}>
                    Employee Signature
                  </div>
                </div>
                <div style={{ textAlign: 'center', width: '180px' }}>
                  <div style={{ borderTop: '1px solid #0f172a', paddingTop: '0.35rem', fontSize: '0.8rem', fontWeight: 700 }}>
                    For Ekdant Supermarket
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>(Authorized Signatory)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
