import React, { useRef, useState } from 'react';
import { compressImageFile } from '../utils/imageUpload';
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
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImageFile(file);
      onChange(compressed);
    } catch (err) {
      alert(err?.message || 'Failed to process image');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
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
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? '⏳…' : '📁 Upload Logo/Flag'}
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
