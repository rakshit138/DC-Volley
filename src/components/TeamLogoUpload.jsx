import React, { useRef } from 'react';
import './FairPlayForfeitModal.css';

/**
 * Team logo / country flag upload with preview (HTML mockup parity).
 * Stores base64 data URL — persisted to Firestore via parent onChange.
 */
export default function TeamLogoUpload({
  label = 'Team Logo / Country Flag',
  logoData,
  onChange,
  compact = false,
  disabled = false
}) {
  const inputRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange(ev.target?.result || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleClear = () => onChange('');

  return (
    <div className={`form-group team-logo-upload-wrap${compact ? ' team-logo-upload-compact' : ''}`}>
      {label && <label className="form-label">{label}</label>}
      <div className="team-logo-upload">
        <div
          className="team-logo-preview"
          onClick={() => !disabled && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
        >
          {logoData ? (
            <img src={logoData} alt="Team logo" />
          ) : (
            <span className="team-logo-fallback">🏐</span>
          )}
        </div>
        <div className="team-logo-actions">
          <button
            type="button"
            className="team-logo-upload-btn"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            📁 Upload Logo/Flag
          </button>
          {logoData && (
            <button type="button" className="team-logo-clear-btn" disabled={disabled} onClick={handleClear}>
              ✕ Clear
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          disabled={disabled}
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
