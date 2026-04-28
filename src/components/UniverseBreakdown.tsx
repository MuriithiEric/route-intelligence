import React from 'react';
import { useAppContext, useLayers } from '../context/AppContext';
import type { Tier, CustomerCategoryCounts } from '../types';
import { TIER_COLOURS, DEFAULT_TIER_VISIBILITY } from '../types';

const TIER_DEFS: Array<{ key: Tier; label: string }> = [
  { key: 'DISTRIBUTOR',   label: 'BIDCO Dist.'   },
  { key: 'KEY ACCOUNT',   label: 'Key Accounts'  },
  { key: 'HUB',           label: 'Hubs'          },
  { key: 'STOCKIST',      label: 'Stockists'     },
  { key: 'MODERN TRADE',  label: 'Modern Trade'  },
  { key: 'GENERAL TRADE', label: 'General Trade' },
];

interface UniverseBreakdownProps {
  customerCounts: CustomerCategoryCounts | null;
}

export default function UniverseBreakdown({ customerCounts }: UniverseBreakdownProps) {
  const { filters, setFilters } = useAppContext();
  const { setLayers } = useLayers();

  const handleTierClick = (tier: Tier) => {
    const next = filters.activeTier === tier ? null : tier;
    setFilters(prev => ({ ...prev, activeTier: next }));
    setLayers(prev => {
      // Map Tier label → DB cat key used in tierVisibility
      const catKey = next === 'MODERN TRADE' ? 'SUPERMARKET' : next;
      // When a single tier is activated: check only that tier; else restore all
      const tierVisibility = next
        ? Object.fromEntries(Object.keys(DEFAULT_TIER_VISIBILITY).map(k => [k, k === catKey]))
        : { ...DEFAULT_TIER_VISIBILITY };
      return {
        ...prev,
        customerUniverse: next !== null,
        customerTier: next,
        tierVisibility,
      };
    });
  };

  return (
    <div
      style={{
        height: 36,
        background: '#FFFFFF',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        zIndex: 998,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 0,
        flexShrink: 0,
        overflowX: 'auto',
      }}
    >
      {/* True total from DB */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1E3A5F' }}>
          {customerCounts ? customerCounts.total.toLocaleString() : '—'}
        </span>
        <span style={{ fontSize: 11, color: '#6B7280' }}>total</span>
      </div>

      {TIER_DEFS.map(tier => {
        const isActive = filters.activeTier === tier.key;
        const color = TIER_COLOURS[tier.key];
        const count = customerCounts ? customerCounts[tier.key] : null;
        return (
          <React.Fragment key={tier.key}>
            <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.1)', flexShrink: 0 }} />
            <button
              onClick={() => handleTierClick(tier.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '0 10px',
                height: 36,
                background: isActive ? `${color}18` : 'transparent',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? color : '#1E3A5F' }}>
                {count !== null ? count.toLocaleString() : '—'}
              </span>
              <span style={{ fontSize: 10, color: '#6B7280' }}>{tier.label}</span>
            </button>
          </React.Fragment>
        );
      })}

      {/* DISTRIBUTOR - FEEDS: informational chip, not filterable */}
      {customerCounts && (customerCounts['DISTRIBUTOR - FEEDS'] ?? 0) > 0 && (
        <>
          <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.1)', flexShrink: 0 }} />
          <div
            title="Agricultural feeds distributors — separate from BIDCO FMCG distributors"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 10px',
              height: 36,
              flexShrink: 0,
              opacity: 0.7,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#E07B39',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1E3A5F' }}>
              {customerCounts['DISTRIBUTOR - FEEDS'].toLocaleString()}
            </span>
            <span style={{ fontSize: 10, color: '#6B7280' }}>Dist. Feeds</span>
          </div>
        </>
      )}
    </div>
  );
}
