import React, { useState, useEffect } from 'react';

interface NavbarProps {
  onTourClick: () => void;
}

export default function Navbar({ onTourClick }: NavbarProps) {
  const [syncTime, setSyncTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setSyncTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <nav
      style={{
        height: 56,
        background: '#FFFFFF',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
      }}
    >
      {/* Left: Logo + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            background: '#1E3A5F',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 14L9 4L15 14H3Z" fill="#C9963E" />
            <circle cx="9" cy="10" r="2" fill="white" />
          </svg>
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#1E3A5F',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              lineHeight: 1.2,
            }}
          >
            BIDCO ROUTE INTELLIGENCE
          </div>
          <div
            style={{
              fontSize: 10,
              color: '#9CA3AF',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            KENYA FIELD OPERATIONS
          </div>
        </div>
      </div>

      {/* Right: Tour button + Live indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onTourClick}
          title="Take a tour"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid rgba(0,0,0,0.1)',
            background: '#F9FAFB',
            color: '#1E3A5F',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
            letterSpacing: '0.02em',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5.5" stroke="#1E3A5F" strokeWidth="1.2"/>
            <text x="6" y="9" textAnchor="middle" fill="#1E3A5F" fontSize="7" fontWeight="700" fontFamily="Inter, sans-serif">?</text>
          </svg>
          Tour
        </button>

        <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.08)' }} />

        <div
          className="pulse-dot"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#22C55E',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#1E3A5F' }}>LIVE</span>
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>
          Last sync {formatTime(syncTime)}
        </span>
      </div>
    </nav>
  );
}
