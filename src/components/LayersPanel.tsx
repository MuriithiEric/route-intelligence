import React from 'react';
import { Layers } from 'lucide-react';
import { useLayers } from '../context/AppContext';
import type { LayerState, Tier } from '../types';

export default function LayersPanel() {
  const { layers, setLayers } = useLayers();

  const toggle = (key: keyof LayerState) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setTier = (tier: Tier | null) => {
    setLayers(prev => ({ ...prev, customerTier: tier, customerUniverse: true }));
  };

  const setRouteType = (type: 'primary' | 'secondary' | 'both') => {
    setLayers(prev => ({ ...prev, routeType: type }));
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
    { key: null, label: 'All tiers', color: '#6B7280' },
    { key: 'DISTRIBUTOR', label: 'Distributor', color: '#C0392B' },
    { key: 'KEY ACCOUNT', label: 'Key Account', color: '#7E57C2' },
    { key: 'HUB', label: 'Hub', color: '#C9963E' },
    { key: 'STOCKIST', label: 'Stockist', color: '#E07B39' },
    { key: 'MODERN TRADE', label: 'Modern Trade', color: '#0E8C7A' },
    { key: 'GENERAL TRADE', label: 'General Trade', color: '#9E9E9E' },
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
        count="95"
        active={layers.fieldStaff}
        onToggle={() => toggle('fieldStaff')}
        color="#C9963E"
      />

      <Row
        label="Customer Universe"
        count="79,638"
        active={layers.customerUniverse}
        onToggle={() => toggle('customerUniverse')}
        color="#7E57C2"
      />

      {/* Tier sub-options */}
      {layers.customerUniverse && (
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
      )}

      <Row
        label="Routes"
        count="539"
        active={layers.routes}
        onToggle={() => toggle('routes')}
        color="#1565C0"
      />

      {/* Route type sub-options */}
      {layers.routes && (
        <div style={{ paddingLeft: 14, paddingBottom: 4, display: 'flex', gap: 4 }}>
          {(['primary', 'secondary', 'both'] as const).map(type => (
            <button
              key={type}
              onClick={() => setRouteType(type)}
              style={{
                padding: '2px 6px',
                borderRadius: 4,
                border: `1px solid ${layers.routeType === type ? '#1565C0' : 'rgba(0,0,0,0.1)'}`,
                background: layers.routeType === type ? '#E3F2FD' : 'transparent',
                color: layers.routeType === type ? '#1565C0' : '#6B7280',
                fontSize: 10,
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
                textTransform: 'capitalize',
              }}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      <Row
        label="Density Heatmap"
        active={layers.heatmap}
        onToggle={() => toggle('heatmap')}
        color="#E07B39"
      />

      <Row
        label="County Boundaries"
        active={layers.countyBoundaries}
        onToggle={() => toggle('countyBoundaries')}
        color="#1E3A5F"
      />
    </div>
  );
}
