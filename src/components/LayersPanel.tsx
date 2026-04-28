import React from 'react';
import { Layers } from 'lucide-react';
import { useLayers } from '../context/AppContext';
import type { CustomerCategoryCounts, LayerState } from '../types';
import { DEFAULT_TIER_VISIBILITY } from '../types';

interface TierDef {
  key: string;       // matches tierVisibility keys
  label: string;
  color: string;
  hollow?: boolean;  // show hollow ring (Dist. Feeds)
  getCount?: (c: CustomerCategoryCounts) => number;
}

const TIER_DEFS: TierDef[] = [
  { key: 'DISTRIBUTOR',       label: 'BIDCO Distributor',  color: '#C0392B',
    getCount: c => c.DISTRIBUTOR },
  { key: 'KEY ACCOUNT',       label: 'Key Account',        color: '#7E57C2',
    getCount: c => c['KEY ACCOUNT'] },
  { key: 'HUB',               label: 'Hub',                color: '#C9963E',
    getCount: c => c.HUB },
  { key: 'STOCKIST',          label: 'Stockist',           color: '#E07B39',
    getCount: c => c.STOCKIST },
  { key: 'SUPERMARKET',       label: 'Modern Trade',       color: '#0E8C7A',
    getCount: c => c['MODERN TRADE'] },
  { key: 'GENERAL TRADE',     label: 'General Trade',      color: '#9E9E9E',
    getCount: c => c['GENERAL TRADE'] },
  { key: 'DISTRIBUTOR - FEEDS', label: 'Dist. Feeds',      color: '#E88080', hollow: true,
    getCount: c => c['DISTRIBUTOR - FEEDS'] },
];

interface LayersPanelProps {
  fieldStaffCount?: number;
  customerCount?: number;
  routeCount?: number;
  customerCounts?: CustomerCategoryCounts | null;
}

export default function LayersPanel({
  fieldStaffCount,
  customerCount,
  routeCount,
  customerCounts,
}: LayersPanelProps) {
  const { layers, setLayers } = useLayers();

  const toggle = (key: keyof LayerState) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTierVisibility = (tierKey: string) => {
    setLayers(prev => ({
      ...prev,
      customerTier: null, // clear single-tier server filter when manually toggling
      tierVisibility: {
        ...prev.tierVisibility,
        [tierKey]: !(prev.tierVisibility[tierKey] ?? true),
      },
    }));
  };

  const allChecked = TIER_DEFS.every(t => layers.tierVisibility[t.key] !== false);

  const toggleAll = () => {
    const next = !allChecked;
    const visibility: Record<string, boolean> = {};
    TIER_DEFS.forEach(t => { visibility[t.key] = next; });
    setLayers(prev => ({
      ...prev,
      customerTier: null,
      tierVisibility: next ? { ...DEFAULT_TIER_VISIBILITY } : visibility,
    }));
  };

  const ToggleSwitch = ({
    active,
    onToggle,
  }: {
    active: boolean;
    onToggle: () => void;
  }) => (
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
  );

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color || (active ? '#1E3A5F' : '#D1D5DB'),
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 12, color: '#1E3A5F', fontWeight: 500 }}>{label}</span>
        {count && (
          <span style={{ fontSize: 10, color: '#9CA3AF', background: '#F3F4F6', padding: '1px 5px', borderRadius: 10 }}>
            {count}
          </span>
        )}
      </div>
      <ToggleSwitch active={active} onToggle={onToggle} />
    </div>
  );

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
        maxWidth: 265,
        fontFamily: 'Inter, system-ui, sans-serif',
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

      {/* Tier checkboxes — shown when Customer Universe is ON */}
      {layers.customerUniverse && (
        <div style={{ paddingLeft: 14, paddingBottom: 4 }}>
          {/* Select all / deselect all */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0 5px', borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: 4 }}>
            <input
              type="checkbox"
              id="tier-all"
              checked={allChecked}
              onChange={toggleAll}
              style={{ width: 12, height: 12, cursor: 'pointer', accentColor: '#1E3A5F', flexShrink: 0 }}
            />
            <label htmlFor="tier-all" style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              All tiers
            </label>
          </div>

          {TIER_DEFS.map(t => {
            const checked = layers.tierVisibility[t.key] !== false;
            const count = customerCounts ? t.getCount?.(customerCounts) : undefined;
            return (
              <div
                key={t.key}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}
              >
                <input
                  type="checkbox"
                  id={`tier-${t.key}`}
                  checked={checked}
                  onChange={() => toggleTierVisibility(t.key)}
                  style={{ width: 12, height: 12, cursor: 'pointer', accentColor: t.color, flexShrink: 0 }}
                />
                <label
                  htmlFor={`tier-${t.key}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', flex: 1 }}
                >
                  {t.hollow ? (
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${t.color}`, background: 'transparent',
                      display: 'inline-block',
                    }} />
                  ) : (
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: t.color, display: 'inline-block',
                    }} />
                  )}
                  <span style={{ fontSize: 11, color: checked ? '#1E3A5F' : '#9CA3AF' }}>{t.label}</span>
                  {count != null && (
                    <span style={{ fontSize: 9, color: '#9CA3AF', marginLeft: 'auto' }}>
                      {count.toLocaleString()}
                    </span>
                  )}
                </label>
              </div>
            );
          })}

          {/* Visited/unvisited legend */}
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6B7280', display: 'inline-block' }} />
              <span style={{ fontSize: 9, color: '#9CA3AF' }}>Visited</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px dashed #9CA3AF', display: 'inline-block' }} />
              <span style={{ fontSize: 9, color: '#9CA3AF' }}>Unvisited</span>
            </div>
          </div>
        </div>
      )}

      <Row
        label="Routes"
        count={routeCount != null ? routeCount.toLocaleString() : undefined}
        active={layers.routes}
        onToggle={() => toggle('routes')}
        color="#1565C0"
      />

      <Row
        label="Unvisited Outlets"
        active={layers.showUnvisited}
        onToggle={() => toggle('showUnvisited')}
        color="#EF4444"
      />
      {layers.showUnvisited && (
        <div style={{ paddingLeft: 14, paddingBottom: 2 }}>
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>Outlets never visited · zoom in to load</span>
        </div>
      )}
    </div>
  );
}
