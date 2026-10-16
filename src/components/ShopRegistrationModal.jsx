import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Store, Phone, User, MapPin, CheckCircle2, ShieldCheck, Sparkles, X, Clock, ToggleLeft, ToggleRight, Cloud, RefreshCw } from 'lucide-react';

export default function ShopRegistrationModal({ isOpen, onClose, isInitial = false }) {
  const { shopProfile, saveShopProfile, syncCloudNow, cloudShopCode, updateCloudSyncSettings, showToast } = useApp();

  const [shopName, setShopName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [address, setAddress] = useState('');
  const [timerTrackingEnabled, setTimerTrackingEnabled] = useState(true);
  const [error, setError] = useState('');
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [syncCode, setSyncCode] = useState(cloudShopCode || 'ATTENDS-MAIN');

  useEffect(() => {
    if (shopProfile) {
      setShopName(shopProfile.shop_name || '');
      setPhoneNumber(shopProfile.phone_number || '');
      setOwnerName(shopProfile.owner_name || '');
      setAddress(shopProfile.address || '');
      setTimerTrackingEnabled(shopProfile.timer_tracking_enabled !== 0);
    }
  }, [shopProfile, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!shopName.trim()) {
      setError('Please enter your Shop Name');
      return;
    }
    if (!phoneNumber.trim()) {
      setError('Please enter your Shop Phone Number');
      return;
    }

    const success = saveShopProfile({
      shop_name: shopName.trim(),
      phone_number: phoneNumber.trim(),
      owner_name: ownerName.trim(),
      address: address.trim(),
      timer_tracking_enabled: timerTrackingEnabled ? 1 : 0
    });

    if (success && onClose) {
      onClose();
    }
  };

  const handleSyncExistingShop = async () => {
    setError('');
    setIsSyncingCloud(true);
    try {
      if (syncCode.trim()) {
        await updateCloudSyncSettings({ shopCode: syncCode.trim().toUpperCase(), role: 'owner' });
      }
      const success = await syncCloudNow();
      if (!success) {
        setError('Could not connect to cloud. Please check internet connection.');
      }
    } catch (e) {
      setError('Sync failed: ' + e.message);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 99999 }}>
      <div
        className="modal-content shop-register-modal"
        style={{
          maxWidth: '520px',
          padding: '2rem 1.75rem',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          background: 'var(--bg-card)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              <img
                src="/logo.png"
                alt="Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                {isInitial ? 'Register Your Shop' : 'Shop Profile & Settings'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                {isInitial ? 'Enter details once to setup your business profile' : 'Update your business information anytime'}
              </p>
            </div>
          </div>
          {!isInitial && onClose && (
            <button className="btn-icon" onClick={onClose} type="button">
              <X size={18} />
            </button>
          )}
        </div>

        {error && (
          <div style={{
            background: 'var(--accent-danger-subtle)',
            color: 'var(--accent-danger)',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.82rem',
            fontWeight: 600,
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        {isInitial && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(99,102,241,0.08) 100%)',
            border: '1.5px solid var(--accent-primary-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem',
            marginBottom: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <Cloud size={18} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                Already created a shop on Mobile?
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>
              Connect with your <strong>Shop Sync Code</strong> to instantly load your shop profile, staff, and attendance.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={syncCode}
                onChange={(e) => setSyncCode(e.target.value.toUpperCase())}
                placeholder="Shop Code (e.g. ATTENDS-MAIN)"
                style={{
                  flex: 1,
                  padding: '0.55rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)'
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSyncExistingShop}
                disabled={isSyncingCloud}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  padding: '0.55rem 0.9rem',
                  whiteSpace: 'nowrap'
                }}
              >
                <RefreshCw size={14} className={isSyncingCloud ? 'spin' : ''} />
                <span>{isSyncingCloud ? 'Syncing...' : 'Sync Mobile Shop'}</span>
              </button>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '1.1rem 0 0.2rem',
              color: 'var(--text-muted)',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.05em'
            }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
              <span style={{ padding: '0 0.5rem' }}>OR REGISTER AS NEW SHOP</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Store size={14} color="var(--accent-primary)" />
              <span>Shop / Business Name *</span>
            </label>
            <input
              type="text"
              required
              className="form-input"
              style={{ fontSize: '1rem', fontWeight: 600 }}
              placeholder="e.g. Ekdant Supermarket & Wholesale"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Phone size={14} color="var(--accent-success)" />
              <span>Shop Phone / Mobile Number *</span>
            </label>
            <input
              type="tel"
              required
              className="form-input"
              style={{ fontSize: '1rem', fontWeight: 600 }}
              placeholder="e.g. +91 98765 43210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <User size={14} color="var(--accent-purple)" />
                <span>Owner / Manager Name</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Prajwal"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <MapPin size={14} color="var(--accent-warning)" />
                <span>Shop Address / City</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Market Road, Pune"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>

          {/* Staff Shift Timer & Late Penalty Toggle */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: timerTrackingEnabled ? '1.5px solid var(--accent-primary-subtle)' : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: timerTrackingEnabled ? 'var(--accent-primary-subtle)' : 'var(--bg-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: timerTrackingEnabled ? 'var(--accent-primary)' : 'var(--text-muted)'
              }}>
                <Clock size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Staff Shift Timers & Late Arrival
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {timerTrackingEnabled
                    ? 'Active: Punches count late minutes & overtime'
                    : 'Disabled: Flexible hours without late penalties'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTimerTrackingEnabled(!timerTrackingEnabled)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0.2rem',
                color: timerTrackingEnabled ? 'var(--accent-primary)' : 'var(--text-muted)',
                transition: 'transform var(--transition-fast)'
              }}
              aria-label="Toggle Staff Shift Timers"
            >
              {timerTrackingEnabled ? (
                <ToggleRight size={34} color="var(--accent-primary)" />
              ) : (
                <ToggleLeft size={34} color="var(--text-muted)" />
              )}
            </button>
          </div>

          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}>
            <ShieldCheck size={18} color="var(--accent-success)" style={{ flexShrink: 0 }} />
            <span>
              All shop data is securely saved on your device with <strong>automated local backups</strong>.
            </span>
          </div>

          {/* Sticky action footer - NEVER hidden by lower navigation */}
          <div className="modal-footer-sticky" style={{
            position: 'sticky',
            bottom: 0,
            background: 'var(--bg-card)',
            paddingTop: '0.85rem',
            paddingBottom: '0.25rem',
            marginTop: '0.75rem',
            borderTop: '1px solid var(--border-subtle)',
            zIndex: 30
          }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                padding: '0.85rem 1.25rem',
                fontSize: '1rem',
                fontWeight: 700,
                width: '100%',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
              }}
            >
              <CheckCircle2 size={18} />
              <span>{isInitial ? 'Save & Start Register' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
