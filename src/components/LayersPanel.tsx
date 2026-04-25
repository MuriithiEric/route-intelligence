import React from 'react';
import { Layers } from 'lucide-react';
import { useLayers } from '../context/AppContext';
import type { LayerState, Tier } from '../types';

interface LayersPanelProps {
  fieldStaffCount?: number;
  customerCount?: number;
  routeCount?: number;
}

const TIER_LEGEND: Array<{ key: Tier; label: string; color: string }> = [
  { key: 'DISTRIBUTOR',   label: 'Distributor',   color: '#C0392B' },
  { key: 'KEY ACCOUNT',  label: 'Key Account',   color: '#7E57C2' },
  { key: 'HUB',          label: 'Hub',           color: '#C9963E' },
  { key: 'STOCKIST',     label: 'Stockist',      color: '#E07B39' },
  { key: 'MODERN TRADE', label: 'Modern Trade',  color: '#0E8C7A' },
  { key: 'GENERAL TRADE',label: 'General Trade', color: '#9E9E9E' },
];

export default function LayersPanel({ fieldStaffCount, customerCount, routeCount }: LayersPanelProps) {
  const { layers, setLayers } = useLayers();

  const toggle = (key: keyof LayerState) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setTier = (tier: Tier | null) => {
    setLayers(prev => ({ ...prev, customerTier: tier, customerUniverse: true }));
  };

  const Row = ({
    label,
    count,
    active,
    onToggle,
    color,
  }: {
    label: string;
    count?: string;
    active: boolean;
    onToggle: () => void;
    color?: string;
  }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color || (active ? '#1E3A5F' : '#D1D5DB'),
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 12, color: '#1E3A5F', fontWeight: 500 }}>{label}</span>
        {count && (
          <span style={{ fontSize: 10, color: '#9CA3AF', background: '#F3F4F6', padding: '1px 5px', borderRadius: 10 }}>
            {count}
          </span>
        )}
      </div>
      <button
        onClick={onToggle}
        style={{
          width: 36,
          height: 18,
          borderRadius: 9,
          background: active ? '#1E3A5F' : '#D1D5DB',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#FFFFFF',
            position: 'absolute',
            top: 2,
            left: active ? 20 : 2,
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </button>
    </div>
  );

  const tierOptions: Array<{ key: Tier | null; label: string; color: string }> = [
    { key: null,            label: 'All tiers',    color: '#6B7280' },
    ...TIER_LEGEND,
  ];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        zIndex: 800,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(8px)',
        borderRadius: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        border: '1px solid rgba(0,0,0,0.08)',
        padding: '10px 14px',
        minWidth: 230,
        maxWidth: 260,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Layers size={14} color="#1E3A5F" />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#1E3A5F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Layers
        </span>
      </div>

      <Row
        label="Field Staff"
        count={fieldStaffCount != null ? fieldStaffCount.toLocaleString() : undefined}
        active={layers.fieldStaff}
        onToggle={() => toggle('fieldStaff')}
        color="#C9963E"
      />

      <Row
        label="Customer Universe"
        count={customerCount != null ? customerCount.toLocaleString() : undefined}
        active={layers.customerUniverse}
        onToggle={() => toggle('customerUniverse')}
        color="#7E57C2"
      />

      {/* Map dot legend — shows when Customer Universe layer is ON */}
      {layers.customerUniverse && (
        <>
          {/* Mini color legend */}
          <div style={{ paddingLeft: 14, paddingTop: 2, paddingBottom: 4, borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: 4 }}>
            <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Map Legend
            </div>
            {TIER_LEGEND.map(t => (
              <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '1px 0' }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: t.color,
                  display: 'inline-block',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 11, color: '#6B7280' }}>{t.label}</span>
              </div>
            ))}
          </div>

          {/* Tier filter sub-options */}
          <div style={{ paddingLeft: 14, paddingBottom: 4 }}>
            {tierOptions.map(t => (
              <button
                key={t.key || 'all'}
                onClick={() => setTier(t.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  width: '100%',
                  padding: '2px 4px',
                  background: layers.customerTier === t.key ? '#F0F9FF' : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#6B7280' }}>{t.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <Row
        label="Routes"
        count={routeCount != null ? routeCount.toLocaleString() : undefined}
        active={layers.routes}
        onToggle={() => toggle('routes')}
        color="#1565C0"
      />
    </div>
  );
}
