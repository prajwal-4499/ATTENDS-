import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Coffee,
  CheckCheck,
  MessageSquare,
  AlertCircle,
  UserCheck,
  Package,
  Layers,
  Plus,
  Minus
} from 'lucide-react';

export default function AttendanceGrid() {
  const {
    staffList,
    attendanceRecords,
    selectedDate,
    markAttendance,
    markAllPresent,
    updatePiecesProduced
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [editingNoteStaff, setEditingNoteStaff] = useState(null);
  const [noteText, setNoteText] = useState('');
  // Track live piece input values per staff id
  const [piecesInputMap, setPiecesInputMap] = useState({});

  // Filter staff
  const activeStaff = staffList.filter((s) => s.is_active);
  const filteredStaff = activeStaff.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(searchQuery));
    const matchesRole = roleFilter === 'ALL' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Unique roles
  const roles = ['ALL', ...new Set(staffList.map((s) => s.role))];

  // Helper to get attendance record for staff on selectedDate
  const getRecord = (staffId) => {
    return attendanceRecords.find((a) => a.staff_id === staffId);
  };

  // Metrics
  const stats = {
    total: activeStaff.length,
    present: 0,
    absent: 0,
    halfDay: 0,
    leave: 0,
    lateArrivals: 0,
    totalPieces: 0
  };

  attendanceRecords.forEach((r) => {
    if (r.status === 'PRESENT') stats.present++;
    else if (r.status === 'ABSENT') stats.absent++;
    else if (r.status === 'HALF_DAY') stats.halfDay++;
    else if (r.status === 'LEAVE') stats.leave++;
    if (r.late_minutes > 0) stats.lateArrivals++;
    stats.totalPieces += (parseInt(r.pieces_produced) || 0);
  });

  const handleOpenNoteModal = (staff, currentRecord) => {
    setEditingNoteStaff(staff);
    setNoteText(currentRecord?.notes || '');
  };

  const handleSaveNote = () => {
    if (!editingNoteStaff) return;
    const rec = getRecord(editingNoteStaff.id);
    const status = rec?.status || 'PRESENT';
    markAttendance(editingNoteStaff.id, status, noteText);
    setEditingNoteStaff(null);
    setNoteText('');
  };

  const handlePiecesChange = (staffId, val) => {
    setPiecesInputMap((prev) => ({ ...prev, [staffId]: val }));
  };

  const handlePiecesBlur = (staffId) => {
    const val = piecesInputMap[staffId];
    if (val === undefined || val === '') return;
    updatePiecesProduced(staffId, val);
  };

  const handlePiecesKeyDown = (e, staffId) => {
    if (e.key === 'Enter') {
      handlePiecesBlur(staffId);
      e.target.blur();
    }
  };

  const handlePiecesStep = (staffId, delta) => {
    const record = getRecord(staffId);
    const saved = parseInt(record?.pieces_produced) || 0;
    const live = piecesInputMap[staffId];
    const current = live !== undefined ? (parseInt(live) || 0) : saved;
    const nextVal = Math.max(0, current + delta);
    setPiecesInputMap((prev) => ({ ...prev, [staffId]: String(nextVal) }));
    updatePiecesProduced(staffId, nextVal);
  };

  return (
    <div>
      {/* Metric Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Active Staff</div>
            <div className="stat-val">{stats.total}</div>
          </div>
          <div className="stat-icon-box" style={{ background: 'var(--accent-primary-subtle)', color: 'var(--accent-primary)' }}>
            <UserCheck size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Present Today</div>
            <div className="stat-val" style={{ color: 'var(--accent-success)' }}>{stats.present}</div>
          </div>
          <div className="stat-icon-box" style={{ background: 'var(--accent-success-subtle)', color: 'var(--accent-success)' }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Absent</div>
            <div className="stat-val" style={{ color: 'var(--accent-danger)' }}>{stats.absent}</div>
          </div>
          <div className="stat-icon-box" style={{ background: 'var(--accent-danger-subtle)', color: 'var(--accent-danger)' }}>
            <XCircle size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Half Day / Leave</div>
            <div className="stat-val" style={{ color: 'var(--accent-warning)' }}>
              {stats.halfDay + stats.leave}
            </div>
          </div>
          <div className="stat-icon-box" style={{ background: 'var(--accent-warning-subtle)', color: 'var(--accent-warning)' }}>
            <Coffee size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Late Arrivals</div>
            <div className="stat-val" style={{ color: stats.lateArrivals > 0 ? 'var(--accent-danger)' : 'var(--text-secondary)' }}>
              {stats.lateArrivals}
            </div>
          </div>
          <div className="stat-icon-box" style={{ background: 'var(--accent-danger-subtle)', color: 'var(--accent-danger)' }}>
            <Clock size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Pieces Today</div>
            <div className="stat-val" style={{ color: 'var(--accent-purple)' }}>{stats.totalPieces}</div>
          </div>
          <div className="stat-icon-box" style={{ background: 'var(--accent-purple-subtle)', color: 'var(--accent-purple)' }}>
            <Layers size={22} />
          </div>
        </div>
      </div>

      {/* Toolbar / Actions */}
      <div className="attendance-header-actions">
        <div className="search-filter-row">
          <div className="search-box">
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search staff by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="filter-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r === 'ALL' ? 'All Roles' : r}
              </option>
            ))}
          </select>
        </div>

        <button className="btn btn-primary" onClick={markAllPresent}>
          <CheckCheck size={18} />
          <span>Mark All Present</span>
        </button>
      </div>

      {/* Staff Attendance Row List */}
      <div className="staff-att-list">
        {filteredStaff.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <AlertCircle size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>No staff found</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Try adjusting your search query or role filter.
            </p>
          </div>
        ) : (
          filteredStaff.map((staff) => {
            const record = getRecord(staff.id);
            const status = record?.status || 'UNMARKED';
            const punchInTime = record?.punch_in ? record.punch_in.split('T')[1]?.slice(0, 5) : null;
            const punchOutTime = record?.punch_out ? record.punch_out.split('T')[1]?.slice(0, 5) : null;
            const isPieceRate = staff.salary_type === 'PIECE_RATE';
            const savedPieces = parseInt(record?.pieces_produced) || 0;
            const liveVal = piecesInputMap[staff.id];
            const displayPieces = liveVal !== undefined ? liveVal : (savedPieces > 0 ? String(savedPieces) : '');

            return (
              <div
                key={staff.id}
                className={`staff-att-row ${isPieceRate ? 'is-piece-worker' : ''}`}
              >
                {/* Identity */}
                <div className="staff-identity">
                  {staff.photo_path ? (
                    <img
                      src={staff.photo_path}
                      alt={staff.name}
                      className="staff-avatar"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className="avatar-fallback"
                    style={{ display: staff.photo_path ? 'none' : 'flex' }}
                  >
                    {staff.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div className="staff-name">{staff.name}</div>
                      {isPieceRate && (
                        <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                          Piecework • ₹{staff.per_piece_rate}/pc
                        </span>
                      )}
                    </div>
                    <div className="staff-meta">
                      <span>{staff.role}</span>
                      <span>•</span>
                      <span className="staff-shift-pill">
                        {staff.work_start_time || '09:00'} - {staff.work_end_time || '20:00'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Attendance Status Buttons */}
                <div className="att-button-group">
                  <button
                    type="button"
                    className={`att-btn present ${status === 'PRESENT' ? 'active' : ''}`}
                    onClick={() => markAttendance(staff.id, 'PRESENT')}
                    title="Mark Present"
                  >
                    <span>P</span>
                    <span className="att-btn-lbl">Present</span>
                  </button>
                  <button
                    type="button"
                    className={`att-btn absent ${status === 'ABSENT' ? 'active' : ''}`}
                    onClick={() => markAttendance(staff.id, 'ABSENT')}
                    title="Mark Absent"
                  >
                    <span>A</span>
                    <span className="att-btn-lbl">Absent</span>
                  </button>
                  <button
                    type="button"
                    className={`att-btn halfday ${status === 'HALF_DAY' ? 'active' : ''}`}
                    onClick={() => markAttendance(staff.id, 'HALF_DAY')}
                    title="Mark Half Day"
                  >
                    <span>HD</span>
                    <span className="att-btn-lbl">Half Day</span>
                  </button>
                  <button
                    type="button"
                    className={`att-btn leave ${status === 'LEAVE' ? 'active' : ''}`}
                    onClick={() => markAttendance(staff.id, 'LEAVE')}
                    title="Mark Paid Leave"
                  >
                    <span>L</span>
                    <span className="att-btn-lbl">Leave</span>
                  </button>
                </div>

                {/* Pieces Produced — Clean, Integrated Stepper (ONLY FOR PIECE-RATE WORKERS) */}
                {isPieceRate ? (
                  <div className="piece-work-stepper-box">
                    <div className="piece-work-label">
                      <Package size={14} color="var(--accent-primary)" />
                      <span>Pieces Today:</span>
                    </div>

                    <div className="piece-stepper-controls">
                      <button
                        type="button"
                        className="piece-step-btn"
                        onClick={() => handlePiecesStep(staff.id, -1)}
                        title="Decrease pieces (-1)"
                      >
                        <Minus size={14} />
                      </button>

                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        className="piece-input-field"
                        value={displayPieces}
                        onChange={(e) => handlePiecesChange(staff.id, e.target.value)}
                        onBlur={() => handlePiecesBlur(staff.id)}
                        onKeyDown={(e) => handlePiecesKeyDown(e, staff.id)}
                      />

                      <button
                        type="button"
                        className="piece-step-btn"
                        onClick={() => handlePiecesStep(staff.id, 1)}
                        title="Increase pieces (+1)"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <div className="piece-earnings-badge">
                      = ₹{((parseInt(displayPieces) || 0) * (staff.per_piece_rate || 0)).toLocaleString()}
                    </div>
                  </div>
                ) : null}

                {/* Timestamps, Late indicator, Overtime, Notes */}
                <div className="punch-details">
                  {punchInTime ? (
                    <div className="punch-chip" title="Punch In Time">
                      <Clock size={14} color="var(--accent-primary)" />
                      <span>In: {punchInTime}</span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>--:--</span>
                  )}

                  {punchOutTime ? (
                    <div className="punch-chip" title="Punch Out Time">
                      <Clock size={14} color="var(--accent-purple)" />
                      <span>Out: {punchOutTime}</span>
                    </div>
                  ) : null}

                  {record?.late_minutes > 0 ? (
                    <span className="late-tag">+{record.late_minutes}m Late</span>
                  ) : null}

                  {record?.overtime_hours > 0 ? (
                    <span className="ot-tag">+{record.overtime_hours}h OT</span>
                  ) : null}

                  {record?.punch_method ? (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      [{record.punch_method === 'PIN_KIOSK' ? 'KIOSK' : 'MANUAL'}]
                    </span>
                  ) : null}

                  <button
                    className="btn-icon"
                    style={{ width: '30px', height: '30px' }}
                    onClick={() => handleOpenNoteModal(staff, record)}
                    title={record?.notes ? `Notes: ${record.notes}` : 'Add note / remark'}
                  >
                    <MessageSquare size={14} color={record?.notes ? 'var(--accent-warning)' : 'inherit'} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Note Modal */}
      {editingNoteStaff && (
        <div className="modal-overlay" onClick={() => setEditingNoteStaff(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Attendance Remarks</h3>
              <button className="btn-icon" onClick={() => setEditingNoteStaff(null)}>
                <XCircle size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Staff: <strong>{editingNoteStaff.name}</strong> • Date: <strong>{selectedDate}</strong>
            </div>

            <div className="form-group">
              <label className="form-label">Reason / Notes for Attendance</label>
              <textarea
                className="form-textarea"
                rows="3"
                placeholder="e.g. Traffic jam delay, medical leave, approved early departure..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                autoFocus
              ></textarea>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setEditingNoteStaff(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveNote}>
                Save Remarks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
