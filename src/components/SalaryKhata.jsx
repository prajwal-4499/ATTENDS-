import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Wallet,
  PlusCircle,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  TrendingDown,
  TrendingUp,
  CreditCard,
  Trash2,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

export default function SalaryKhata() {
  const {
    staffList,
    salaryLedger,
    attendanceRecords,
    addLedgerTransaction,
    deleteLedgerTransaction,
    getTodayStr
  } = useApp();

  const [selectedStaffId, setSelectedStaffId] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [txnType, setTxnType] = useState('ADVANCE');
  
  const [formData, setFormData] = useState({
    staff_id: staffList[0]?.id || '',
    transaction_date: getTodayStr(),
    type: 'ADVANCE',
    amount: '',
    payment_mode: 'CASH',
    remarks: ''
  });

  const handleOpenTxn = (type = 'ADVANCE', defaultStaffId = null) => {
    setTxnType(type);
    setFormData({
      staff_id: defaultStaffId || staffList[0]?.id || '',
      transaction_date: getTodayStr(),
      type: type,
      amount: '',
      payment_mode: 'CASH',
      remarks: ''
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) return;
    const ok = addLedgerTransaction(formData);
    if (ok) {
      setIsModalOpen(false);
    }
  };

  // Calculate accrued earnings, advances, bonuses, deductions for each staff member for the current month
  const staffSalarySummaries = useMemo(() => {
    return staffList.map((staff) => {
      // Filter transactions for this staff
      const txns = salaryLedger.filter((l) => l.staff_id === staff.id);
      
      let advances = 0;
      let bonuses = 0;
      let deductions = 0;
      let payouts = 0;

      txns.forEach((t) => {
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'ADVANCE') advances += amt;
        else if (t.type === 'BONUS') bonuses += amt;
        else if (t.type === 'DEDUCTION') deductions += amt;
        else if (t.type === 'PAYOUT') payouts += amt;
      });

      // Filter attendance records for this staff
      // Here we estimate accrued days from attendance table
      const staffAtt = attendanceRecords.filter((a) => a.staff_id === staff.id);
      let daysPresent = 0;
      let halfDays = 0;
      let totalOtHours = 0;
      let totalPieces = 0;

      staffAtt.forEach((a) => {
        if (a.status === 'PRESENT') daysPresent += 1;
        else if (a.status === 'HALF_DAY') halfDays += 1;
        totalOtHours += (parseFloat(a.overtime_hours) || 0);
        totalPieces += (parseInt(a.pieces_produced) || 0);
      });

      const effectiveDays = daysPresent + (halfDays * 0.5);

      // Wage Calculation based on type
      let grossAccrued = 0;
      let otRate = 0;

      if (staff.salary_type === 'MONTHLY') {
        const dailyRate = staff.base_rate / 30;
        grossAccrued = effectiveDays * dailyRate;
        otRate = dailyRate / 8; // approx 8hr shift
      } else if (staff.salary_type === 'DAILY') {
        grossAccrued = effectiveDays * staff.base_rate;
        otRate = staff.base_rate / 8;
      } else if (staff.salary_type === 'HOURLY') {
        const estHours = (effectiveDays * 8) + totalOtHours;
        grossAccrued = estHours * staff.base_rate;
        otRate = staff.base_rate;
      } else if (staff.salary_type === 'PIECE_RATE') {
        // Earnings = Total pieces × per-piece rate
        grossAccrued = totalPieces * (parseFloat(staff.per_piece_rate) || 0);
        otRate = 0; // piece-rate workers don't get extra OT
      }

      const otPay = staff.salary_type === 'PIECE_RATE' ? 0 : totalOtHours * otRate;
      const totalEarnings = grossAccrued + otPay + bonuses;
      const totalDebits = advances + deductions + payouts;
      const netPayable = Math.max(0, totalEarnings - totalDebits);

      return {
        ...staff,
        effectiveDays,
        totalOtHours,
        totalPieces,
        grossAccrued: Math.round(grossAccrued),
        otPay: Math.round(otPay),
        advances,
        bonuses,
        deductions,
        payouts,
        netPayable: Math.round(netPayable)
      };
    });
  }, [staffList, salaryLedger, attendanceRecords]);

  // Overall totals
  const overallTotals = useMemo(() => {
    let totalAdvances = 0;
    let totalBonuses = 0;
    let totalNetPayable = 0;

    staffSalarySummaries.forEach((s) => {
      totalAdvances += s.advances;
      totalBonuses += s.bonuses;
      totalNetPayable += s.netPayable;
    });

    return { totalAdvances, totalBonuses, totalNetPayable };
  }, [staffSalarySummaries]);

  // Filtered transactions for the ledger table
  const filteredLedger = useMemo(() => {
    if (selectedStaffId === 'ALL') return salaryLedger;
    return salaryLedger.filter((l) => l.staff_id === selectedStaffId);
  }, [salaryLedger, selectedStaffId]);

  return (
    <div>
      {/* Metrics Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Pending Advances</div>
            <div className="stat-val" style={{ color: 'var(--accent-warning)' }}>
              ₹{overallTotals.totalAdvances.toLocaleString()}
            </div>
          </div>
          <div className="stat-icon-box" style={{ background: 'var(--accent-warning-subtle)', color: 'var(--accent-warning)' }}>
            <TrendingDown size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Incentives & Bonuses</div>
            <div className="stat-val" style={{ color: 'var(--accent-success)' }}>
              ₹{overallTotals.totalBonuses.toLocaleString()}
            </div>
          </div>
          <div className="stat-icon-box" style={{ background: 'var(--accent-success-subtle)', color: 'var(--accent-success)' }}>
            <TrendingUp size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Estimated Net Payable</div>
            <div className="stat-val" style={{ color: 'var(--accent-primary)' }}>
              ₹{overallTotals.totalNetPayable.toLocaleString()}
            </div>
          </div>
          <div className="stat-icon-box" style={{ background: 'var(--accent-primary-subtle)', color: 'var(--accent-primary)' }}>
            <Wallet size={22} />
          </div>
        </div>
      </div>

      {/* Quick Action Toolbar */}
      <div className="attendance-header-actions">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => handleOpenTxn('ADVANCE')}>
            <ArrowUpRight size={17} />
            <span>+ Give Advance</span>
          </button>
          <button className="btn btn-secondary" onClick={() => handleOpenTxn('BONUS')}>
            <TrendingUp size={17} color="var(--accent-success)" />
            <span>+ Incentive / Bonus</span>
          </button>
          <button className="btn btn-secondary" onClick={() => handleOpenTxn('DEDUCTION')}>
            <TrendingDown size={17} color="var(--accent-danger)" />
            <span>- Penalty / Deduction</span>
          </button>
          <button className="btn btn-secondary" onClick={() => handleOpenTxn('PAYOUT')}>
            <CreditCard size={17} color="var(--accent-info)" />
            <span>Record Salary Payout</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} color="var(--text-muted)" />
          <select
            className="filter-select"
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
          >
            <option value="ALL">All Staff Ledger</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Staff Net Pay Calculation Cards */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.85rem' }}>
          Staff Net Pay & Khata Balances
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1rem' }}>
          {staffSalarySummaries.map((s) => (
            <div key={s.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h4 style={{ fontWeight: 800, fontSize: '1.05rem' }}>{s.name}</h4>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {s.role} • {s.salary_type === 'PIECE_RATE'
                        ? `🧵 ₹${s.per_piece_rate}/pc × ${s.totalPieces} pcs`
                        : `${s.salary_type} (₹${Number(s.base_rate).toLocaleString()})`
                      }
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elevated)',
                    fontWeight: 700
                  }}>
                    {s.effectiveDays} Days Worked
                  </span>
                </div>

                {/* Formula Breakdown */}
                <div style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: '1rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Gross Earned:</span>
                    <span>₹{s.grossAccrued.toLocaleString()}</span>
                  </div>
                  {s.otPay > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: 'var(--accent-success)' }}>
                      <span>Overtime Pay ({s.totalOtHours}h):</span>
                      <span>+₹{s.otPay.toLocaleString()}</span>
                    </div>
                  )}
                  {s.bonuses > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: 'var(--accent-success)' }}>
                      <span>Bonuses:</span>
                      <span>+₹{s.bonuses.toLocaleString()}</span>
                    </div>
                  )}
                  {s.advances > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: 'var(--accent-warning)' }}>
                      <span>Advances Taken:</span>
                      <span>-₹{s.advances.toLocaleString()}</span>
                    </div>
                  )}
                  {s.deductions > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: 'var(--accent-danger)' }}>
                      <span>Deductions:</span>
                      <span>-₹{s.deductions.toLocaleString()}</span>
                    </div>
                  )}
                  {s.payouts > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: 'var(--accent-info)' }}>
                      <span>Paid Out:</span>
                      <span>-₹{s.payouts.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{
                    borderTop: '1px dashed var(--border-subtle)',
                    paddingTop: '0.4rem',
                    marginTop: '0.4rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 800,
                    fontSize: '0.95rem'
                  }}>
                    <span>Net Payable:</span>
                    <span style={{ color: 'var(--accent-primary)' }}>₹{s.netPayable.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                  onClick={() => handleOpenTxn('ADVANCE', s.id)}
                >
                  + Advance
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                  onClick={() => handleOpenTxn('PAYOUT', s.id)}
                >
                  Pay ₹{s.netPayable.toLocaleString()}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Salary Ledger Transactions Table */}
      <div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.85rem' }}>
          Transaction & Advance Passbook
        </h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Staff Member</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Payment Mode</th>
                <th>Remarks / Reason</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                    No ledger transactions recorded yet.
                  </td>
                </tr>
              ) : (
                filteredLedger.map((t) => {
                  let badgeStyle = { color: 'var(--accent-primary)', background: 'var(--accent-primary-subtle)' };
                  if (t.type === 'ADVANCE') {
                    badgeStyle = { color: 'var(--accent-warning)', background: 'var(--accent-warning-subtle)' };
                  } else if (t.type === 'BONUS') {
                    badgeStyle = { color: 'var(--accent-success)', background: 'var(--accent-success-subtle)' };
                  } else if (t.type === 'DEDUCTION') {
                    badgeStyle = { color: 'var(--accent-danger)', background: 'var(--accent-danger-subtle)' };
                  } else if (t.type === 'PAYOUT') {
                    badgeStyle = { color: 'var(--accent-info)', background: 'var(--accent-info-subtle)' };
                  }

                  return (
                    <tr key={t.id}>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{t.transaction_date}</td>
                      <td style={{ fontWeight: 700 }}>{t.staff_name || 'Staff'}</td>
                      <td>
                        <span style={{
                          ...badgeStyle,
                          padding: '0.2rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: 700,
                          fontSize: '0.75rem'
                        }}>
                          {t.type}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                        ₹{Number(t.amount).toLocaleString()}
                      </td>
                      <td>
                        <span style={{
                          background: 'var(--bg-elevated)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          {t.payment_mode}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{t.remarks || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-icon"
                          style={{ width: '30px', height: '30px' }}
                          onClick={() => deleteLedgerTransaction(t.id)}
                          title="Delete transaction entry"
                        >
                          <Trash2 size={14} color="var(--accent-danger)" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Record {formData.type}</h3>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}>
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label className="form-label">Staff Member *</label>
                <select
                  className="form-select"
                  value={formData.staff_id}
                  onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Transaction Type</label>
                  <select
                    className="form-select"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="ADVANCE">Advance Given</option>
                    <option value="BONUS">Bonus / Incentive</option>
                    <option value="DEDUCTION">Deduction / Fine</option>
                    <option value="PAYOUT">Full / Part Salary Payout</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 1500"
                    className="form-input"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select
                    className="form-select"
                    value={formData.payment_mode}
                    onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                  >
                    <option value="CASH">Cash (Shop Drawer)</option>
                    <option value="UPI">UPI (GooglePay / PhonePe / Paytm)</option>
                    <option value="BANK">Bank Transfer / IMPS</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Transaction Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.transaction_date}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Remarks / Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Family emergency, festival advance, target reward..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>

              <div className="modal-footer-sticky">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }}>
                  Confirm Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
