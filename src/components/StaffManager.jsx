import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  UserPlus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Phone,
  Clock,
  KeyRound,
  ShieldAlert,
  Search,
  DollarSign
} from 'lucide-react';

export default function StaffManager() {
  const { staffList, saveStaff, toggleStaffActive } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingStaff, setEditingStaff] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    phone: '',
    role: 'Staff',
    salary_type: 'MONTHLY',
    base_rate: 18000,
    per_piece_rate: 0,
    work_start_time: '09:00',
    work_end_time: '20:00',
    pin_code: '1234',
    photo_path: '',
    is_active: 1
  });

  const handleOpenAdd = () => {
    setFormData({
      id: '',
      name: '',
      phone: '',
      role: 'Counter Staff',
      salary_type: 'MONTHLY',
      base_rate: 18000,
      per_piece_rate: 0,
      work_start_time: '09:00',
      work_end_time: '20:00',
      pin_code: String(Math.floor(1000 + Math.random() * 9000)),
      photo_path: '',
      is_active: 1
    });
    setEditingStaff(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (staff) => {
    setFormData({
      id: staff.id,
      name: staff.name,
      phone: staff.phone || '',
      role: staff.role || 'Staff',
      salary_type: staff.salary_type || 'MONTHLY',
      base_rate: staff.base_rate || 0,
      per_piece_rate: staff.per_piece_rate || 0,
      work_start_time: staff.work_start_time || '09:00',
      work_end_time: staff.work_end_time || '20:00',
      pin_code: staff.pin_code || '1234',
      photo_path: staff.photo_path || '',
      is_active: staff.is_active ?? 1
    });
    setEditingStaff(staff);
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    const ok = saveStaff(formData);
    if (ok) {
      setIsModalOpen(false);
    }
  };

  const filteredStaff = staffList.filter((s) => {
    return (
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(searchQuery)) ||
      (s.role && s.role.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  return (
    <div>
      <div className="attendance-header-actions">
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Staff Roster & Profile Directory</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Manage employee shifts, wage structures, 4-digit counter PINs, and active status.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div className="search-box">
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by name, role, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <UserPlus size={18} />
            <span>Add New Staff</span>
          </button>
        </div>
      </div>

      {/* Staff Master Table */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Role</th>
              <th>Phone</th>
              <th>Shift Hours</th>
              <th>Wage Structure</th>
              <th>Kiosk PIN</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                  No staff members match the criteria.
                </td>
              </tr>
            ) : (
              filteredStaff.map((staff) => (
                <tr key={staff.id} style={{ opacity: staff.is_active ? 1 : 0.6 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {staff.photo_path ? (
                        <img
                          src={staff.photo_path}
                          alt={staff.name}
                          style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className="avatar-fallback"
                        style={{
                          width: '38px',
                          height: '38px',
                          fontSize: '0.85rem',
                          display: staff.photo_path ? 'none' : 'flex'
                        }}
                      >
                        {staff.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{staff.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          ID: {staff.id.slice(0, 14)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      background: 'var(--bg-elevated)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 600,
                      fontSize: '0.8rem'
                    }}>
                      {staff.role}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                      <Phone size={13} />
                      <span>{staff.phone || 'No phone'}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      <Clock size={13} color="var(--accent-primary)" />
                      <span>{staff.work_start_time} - {staff.work_end_time}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      ₹{Number(staff.base_rate).toLocaleString()}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '0.25rem' }}>
                        /{staff.salary_type.toLowerCase()}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                      <KeyRound size={14} color="var(--accent-warning)" />
                      <span>{staff.pin_code || '----'}</span>
                    </div>
                  </td>
                  <td>
                    {staff.is_active ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--accent-success)',
                        background: 'var(--accent-success-subtle)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-full)'
                      }}>
                        Active
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--accent-danger)',
                        background: 'var(--accent-danger-subtle)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-full)'
                      }}>
                        Inactive
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                      <button
                        className="btn-icon"
                        onClick={() => handleOpenEdit(staff)}
                        title="Edit Staff details"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => toggleStaffActive(staff.id, staff.is_active)}
                        title={staff.is_active ? 'Deactivate staff member' : 'Reactivate staff member'}
                      >
                        {staff.is_active ? (
                          <XCircle size={15} color="var(--accent-danger)" />
                        ) : (
                          <CheckCircle size={15} color="var(--accent-success)" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Staff Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h3>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}>
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Rahul Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Job Role</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Cashier, Helper, Manager"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Wage / Salary Type</label>
                  <select
                    className="form-select"
                    value={formData.salary_type}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary_type: e.target.value,
                      base_rate: e.target.value === 'PIECE_RATE' ? 0 : (formData.base_rate || 18000),
                      per_piece_rate: e.target.value === 'PIECE_RATE' ? (formData.per_piece_rate || 10) : 0
                    })}
                  >
                    <option value="MONTHLY">Monthly Fixed Wage</option>
                    <option value="DAILY">Daily Wage (Per Day)</option>
                    <option value="HOURLY">Hourly Wage (Per Hour)</option>
                    <option value="PIECE_RATE">🧵 Per Piece / Unit Rate (Piecework)</option>
                  </select>
                </div>

                {/* Conditional: Base Rate (hidden for PIECE_RATE) */}
                {formData.salary_type !== 'PIECE_RATE' && (
                  <div className="form-group">
                    <label className="form-label">
                      {formData.salary_type === 'MONTHLY' ? 'Monthly Salary (₹)' :
                       formData.salary_type === 'DAILY' ? 'Daily Rate (₹ / day)' :
                       'Hourly Rate (₹ / hr)'} *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      className="form-input"
                      placeholder="e.g. 18000"
                      value={formData.base_rate}
                      onChange={(e) => setFormData({ ...formData, base_rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </div>

              {/* ===== PER PIECE WAGE SECTION ===== */}
              {formData.salary_type === 'PIECE_RATE' && (
                <div style={{
                  border: '2px solid var(--accent-purple)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem 1.25rem',
                  background: 'var(--accent-purple-subtle)',
                  marginBottom: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>🧵</span>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--accent-purple)' }}>
                      Per Piece Wage Configuration
                    </span>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem',
                      background: 'var(--accent-purple)', color: '#fff',
                      borderRadius: 'var(--radius-full)', marginLeft: 'auto'
                    }}>
                      PIECEWORK
                    </span>
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <label className="form-label" style={{ color: 'var(--accent-purple)' }}>
                      ₹ Rate Per Piece / Unit Produced *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      className="form-input"
                      style={{ borderColor: 'var(--accent-purple)', fontSize: '1.15rem', fontWeight: 800 }}
                      placeholder="e.g. 12"
                      value={formData.per_piece_rate}
                      onChange={(e) => setFormData({ ...formData, per_piece_rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div style={{
                    background: 'rgba(168,85,247,0.12)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.6rem 0.85rem',
                    fontSize: '0.8rem',
                    color: 'var(--accent-purple)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem'
                  }}>
                    <div>📊 <strong>How earnings work:</strong></div>
                    <div>Daily Pay = <strong>Pieces Made Today × ₹{formData.per_piece_rate || 0}/pc</strong></div>
                    {formData.per_piece_rate > 0 && (
                      <div style={{ marginTop: '0.2rem' }}>
                        Example: 100 pieces → ₹{(100 * formData.per_piece_rate).toLocaleString()}
                        &nbsp;| 200 pieces → ₹{(200 * formData.per_piece_rate).toLocaleString()}
                      </div>
                    )}
                    <div style={{ marginTop: '0.25rem', fontSize: '0.74rem', opacity: 0.85 }}>
                      ⚡ Enter daily pieces in the Attendance tab for auto salary calculation.
                    </div>
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Shift Start Time (Auto Late calculation)</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formData.work_start_time}
                    onChange={(e) => setFormData({ ...formData, work_start_time: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Shift End Time (Auto Overtime calculation)</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formData.work_end_time}
                    onChange={(e) => setFormData({ ...formData, work_end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">4-Digit Kiosk Check-In PIN *</label>
                  <input
                    type="text"
                    maxLength="4"
                    required
                    className="form-input"
                    style={{ letterSpacing: '0.2em', fontFamily: 'var(--font-mono)' }}
                    placeholder="1234"
                    value={formData.pin_code}
                    onChange={(e) => setFormData({ ...formData, pin_code: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Profile Photo URL (or leave blank)</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://..."
                    value={formData.photo_path}
                    onChange={(e) => setFormData({ ...formData, photo_path: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingStaff ? 'Save Changes' : 'Add Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
