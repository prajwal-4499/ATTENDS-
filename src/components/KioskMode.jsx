import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import confetti from 'canvas-confetti';
import {
  LogIn,
  LogOut,
  Clock,
  Delete,
  CheckCircle,
  AlertTriangle,
  X,
  Sparkles,
  UserCheck
} from 'lucide-react';

export default function KioskMode() {
  const { staffList, attendanceRecords, kioskPunchIn, kioskPunchOut, getTodayStr } = useApp();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [punchMode, setPunchMode] = useState('IN'); // 'IN' or 'OUT'
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [pinDigits, setPinDigits] = useState('');
  const [punchResult, setPunchResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Live Clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-dismiss confirmation modal after 5 seconds
  useEffect(() => {
    if (punchResult) {
      const resetTimer = setTimeout(() => {
        handleCloseModal();
      }, 5000);
      return () => clearTimeout(resetTimer);
    }
  }, [punchResult]);

  // Keyboard numeric listener
  useEffect(() => {
    if (!selectedStaff || punchResult) return;

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        if (pinDigits.length < 4) {
          setPinDigits((prev) => prev + e.key);
        }
      } else if (e.key === 'Backspace') {
        setPinDigits((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        if (pinDigits.length === 4) {
          submitPin(pinDigits);
        }
      } else if (e.key === 'Escape') {
        handleCloseModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStaff, pinDigits, punchResult]);

  const activeStaff = staffList.filter((s) => s.is_active);

  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setPinDigits('');
    setErrorMessage('');
    setPunchResult(null);
  };

  const handleCloseModal = () => {
    setSelectedStaff(null);
    setPinDigits('');
    setErrorMessage('');
    setPunchResult(null);
  };

  const handleKeypadPress = (val) => {
    setErrorMessage('');
    if (val === 'CLEAR') {
      setPinDigits('');
    } else if (val === 'BACK') {
      setPinDigits((prev) => prev.slice(0, -1));
    } else {
      if (pinDigits.length < 4) {
        const next = pinDigits + val;
        setPinDigits(next);
        if (next.length === 4) {
          submitPin(next);
        }
      }
    }
  };

  const submitPin = (pinToTest) => {
    if (!selectedStaff) return;

    if (punchMode === 'IN') {
      const res = kioskPunchIn(selectedStaff.id, pinToTest);
      if (res.success) {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 }
        });
        setPunchResult(res);
      } else {
        setErrorMessage(res.message);
        setPinDigits('');
      }
    } else {
      const res = kioskPunchOut(selectedStaff.id, pinToTest);
      if (res.success) {
        confetti({
          particleCount: 60,
          spread: 50,
          origin: { y: 0.6 }
        });
        setPunchResult(res);
      } else {
        setErrorMessage(res.message);
        setPinDigits('');
      }
    }
  };

  // Check today's punch state for each staff
  const todayStr = getTodayStr();
  const getStaffTodayPunch = (staffId) => {
    return attendanceRecords.find((a) => a.staff_id === staffId && a.date === todayStr);
  };

  return (
    <div className="kiosk-wrapper">
      {/* Top Kiosk Header */}
      <div className="kiosk-header">
        <div>
          <div className="kiosk-clock">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="kiosk-subtext">
            {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {/* Punch IN / Punch OUT Mode Selector */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-primary)', padding: '0.4rem', borderRadius: 'var(--radius-lg)' }}>
          <button
            className={`btn ${punchMode === 'IN' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPunchMode('IN')}
            style={{ minWidth: '130px' }}
          >
            <LogIn size={18} />
            <span>Punch IN</span>
          </button>
          <button
            className={`btn ${punchMode === 'OUT' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPunchMode('OUT')}
            style={{
              minWidth: '130px',
              background: punchMode === 'OUT' ? 'var(--accent-purple)' : undefined
            }}
          >
            <LogOut size={18} />
            <span>Punch OUT</span>
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
          Select Your Name & Avatar to {punchMode === 'IN' ? 'Punch In' : 'Punch Out'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Tap your photo card and enter your 4-digit personal security PIN.
        </p>
      </div>

      {/* Staff Grid for Kiosk */}
      <div className="kiosk-grid">
        {activeStaff.map((staff) => {
          const punch = getStaffTodayPunch(staff.id);
          const hasIn = Boolean(punch?.punch_in);
          const hasOut = Boolean(punch?.punch_out);

          let statusText = 'Not In Yet';
          let badgeColor = 'var(--text-muted)';
          let badgeBg = 'var(--bg-elevated)';

          if (hasIn && !hasOut) {
            statusText = `In at ${punch.punch_in.split('T')[1]?.slice(0, 5)}`;
            badgeColor = 'var(--accent-success)';
            badgeBg = 'var(--accent-success-subtle)';
          } else if (hasIn && hasOut) {
            statusText = `Shift Done (${punch.punch_out.split('T')[1]?.slice(0, 5)})`;
            badgeColor = 'var(--accent-info)';
            badgeBg = 'var(--accent-info-subtle)';
          }

          return (
            <div
              key={staff.id}
              className={`kiosk-staff-card ${selectedStaff?.id === staff.id ? 'selected' : ''}`}
              onClick={() => handleSelectStaff(staff)}
            >
              <div
                className="kiosk-status-badge"
                style={{ color: badgeColor, background: badgeBg }}
              >
                {statusText}
              </div>

              {staff.photo_path ? (
                <img
                  src={staff.photo_path}
                  alt={staff.name}
                  className="kiosk-avatar"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="avatar-fallback kiosk-avatar"
                style={{ display: staff.photo_path ? 'none' : 'flex', fontSize: '1.5rem' }}
              >
                {staff.name.slice(0, 2).toUpperCase()}
              </div>

              <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.2rem' }}>
                {staff.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {staff.role}
              </div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', marginTop: '0.35rem' }}>
                Shift: {staff.work_start_time} - {staff.work_end_time}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4-Digit PIN Modal */}
      {selectedStaff && (
        <div className="pin-modal-overlay" onClick={handleCloseModal}>
          <div className="pin-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-icon" onClick={handleCloseModal}>
                <X size={18} />
              </button>
            </div>

            {!punchResult ? (
              <>
                <div style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                  Hello, {selectedStaff.name}!
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Enter your 4-digit PIN to <strong>Punch {punchMode}</strong>
                </div>

                {errorMessage && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.5rem',
                    background: 'var(--accent-danger-subtle)',
                    color: 'var(--accent-danger)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}>
                    <AlertTriangle size={16} />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* PIN Dots */}
                <div className="pin-display">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`pin-dot ${idx < pinDigits.length ? 'filled' : ''}`}
                    />
                  ))}
                </div>

                {/* Numeric Keypad */}
                <div className="keypad-grid">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      className="keypad-btn"
                      onClick={() => handleKeypadPress(digit)}
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    className="keypad-btn"
                    style={{ fontSize: '0.85rem', fontWeight: 600 }}
                    onClick={() => handleKeypadPress('CLEAR')}
                  >
                    CLEAR
                  </button>
                  <button
                    className="keypad-btn"
                    onClick={() => handleKeypadPress('0')}
                  >
                    0
                  </button>
                  <button
                    className="keypad-btn"
                    onClick={() => handleKeypadPress('BACK')}
                  >
                    <Delete size={20} />
                  </button>
                </div>
              </>
            ) : (
              /* Punch Success Screen */
              <div style={{ padding: '1rem 0' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'var(--accent-success-subtle)',
                  color: 'var(--accent-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}>
                  <CheckCircle size={38} />
                </div>

                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                  Punch {punchResult.action} Confirmed!
                </h3>

                <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {punchResult.staffName}
                </p>

                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Logged at <strong>{punchResult.punchTime}</strong>
                </p>

                {punchResult.lateMins > 0 && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.6rem',
                    background: 'var(--accent-danger-subtle)',
                    color: 'var(--accent-danger)',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 700,
                    fontSize: '0.9rem'
                  }}>
                    Late Arrival: {punchResult.lateMins} minutes past shift start ({selectedStaff.work_start_time})
                  </div>
                )}

                {punchResult.overtimeHours > 0 && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.6rem',
                    background: 'var(--accent-success-subtle)',
                    color: 'var(--accent-success)',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 700,
                    fontSize: '0.9rem'
                  }}>
                    Overtime Accrued: +{punchResult.overtimeHours} hours past shift end
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  onClick={handleCloseModal}
                  style={{ marginTop: '1.5rem', width: '100%' }}
                >
                  Done
                </button>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
                  Auto-closing in a few seconds...
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
