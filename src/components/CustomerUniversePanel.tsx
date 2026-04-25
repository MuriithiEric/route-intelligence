import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CustomerCategoryCounts, UserGroupRegion } from '../types';
import { TIER_COLOURS } from '../types';
import { useAppContext } from '../context/AppContext';

interface CustomerUniversePanelProps {
  customerCounts: CustomerCategoryCounts | null;
  userGroupRegions: UserGroupRegion[];
  onClose: () => void;
}

interface RegionRow {
  region: string;
  total: number;
  visited: number;
  coverage: number;
}

interface TierRow {
  tier: string;
  total: number;
  visited: number;
  unvisited: number;
  coverage: number;
}

// Canonical region display names
const REGION_DISPLAY: Record<string, string> = {
  'nairobi': 'Nairobi',
  'nairobi - local': 'Nairobi',
  'nairobi local': 'Nairobi',
  'north rift': 'North Rift',
  'north-rift': 'North Rift',
  'south rift': 'South Rift',
  'south-rift': 'South Rift',
  'central': 'Central',
  'lake': 'Lake',
  'coast': 'Coast',
  'nyanza': 'Nyanza',
  'rift valley': 'North Rift',
  'modern trade': 'Other',
};

function normalizeRegion(r: string): string {
  const key = r.toLowerCase().trim();
  return REGION_DISPLAY[key] || r;
}

const TIER_DEFS: Array<{ key: keyof CustomerCategoryCounts; label: string }> = [
  { key: 'GENERAL TRADE', label: 'General Trade' },
  { key: 'MODERN TRADE',  label: 'Modern Trade' },
  { key: 'STOCKIST',      label: 'Stockist' },
  { key: 'DISTRIBUTOR',   label: 'Distributor' },
  { key: 'KEY ACCOUNT',   label: 'Key Account' },
  { key: 'HUB',           label: 'Hub' },
];

export default function CustomerUniversePanel({ customerCounts, userGroupRegions, onClose }: CustomerUniversePanelProps) {
  const { filters } = useAppContext();
  const [activeTab, setActiveTab] = useState<'region' | 'tier'>('region');
  const [regionRows, setRegionRows] = useState<RegionRow[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(true);

  // Build region breakdown from userGroupRegions (aggregate visited across all categories per region)
  // and fetch actual customer totals per region
  useEffect(() => {
    setLoadingRegions(true);

    // Aggregate visited shops per normalised region from userGroupRegions
    const visitedByRegion: Record<string, number> = {};
    for (const row of userGroupRegions) {
      const norm = normalizeRegion(row.region);
      visitedByRegion[norm] = (visitedByRegion[norm] || 0) + row.unique_shops;
    }

    // Fetch customer counts per region from DB
    supabase
      .from('customers')
      .select('region')
      .then(({ data }) => {
        if (!data) { setLoadingRegions(false); return; }

        // Count totals per normalised region
        const totalByRegion: Record<string, number> = {};
        for (const row of data) {
          if (!row.region) continue;
          const norm = normalizeRegion(row.region);
          totalByRegion[norm] = (totalByRegion[norm] || 0) + 1;
        }

        // Merge and dedupe; apply group filter if set
        const filtered = filters.userGroup
          ? userGroupRegions.filter(r => r.category === filters.userGroup)
          : userGroupRegions;

        const visitedFiltered: Record<string, number> = {};
        for (const row of filtered) {
          const norm = normalizeRegion(row.region);
          visitedFiltered[norm] = (visitedFiltered[norm] || 0) + row.unique_shops;
        }

        const rows: RegionRow[] = Object.entries(totalByRegion)
          .filter(([region]) => region !== 'Other' || (totalByRegion['Other'] || 0) > 100)
          .map(([region, total]) => {
            const visited = Math.min(visitedFiltered[region] || 0, total);
            return {
              region,
              total,
              visited,
              coverage: total > 0 ? (visited / total) * 100 : 0,
            };
          })
          .sort((a, b) => b.total - a.total);

        setRegionRows(rows);
        setLoadingRegions(false);
      });
  }, [userGroupRegions, filters.userGroup]);

  // Build tier breakdown
  const tierRows = useMemo((): TierRow[] => {
    if (!customerCounts) return [];

    // Estimate visited per tier: sum unique_shops across all user group regions for context
    // Since we don't have per-tier visited data directly, estimate from visit proportion
    const totalVisited = userGroupRegions
      .filter(r => !filters.userGroup || r.category === filters.userGroup)
      .reduce((sum, r) => sum + r.unique_shops, 0);
    const totalCustomers = customerCounts.total || 1;
    const visitRatio = totalVisited / totalCustomers;

    return TIER_DEFS.map(({ key, label }) => {
      const total = key === 'total' ? 0 : (customerCounts[key] as number) || 0;
      const visited = Math.round(total * visitRatio);
      return {
        tier: label,
        total,
        visited: Math.min(visited, total),
        unvisited: Math.max(total - visited, 0),
        coverage: total > 0 ? (visited / total) * 100 : 0,
      };
    }).filter(r => r.total > 0);
  }, [customerCounts, userGroupRegions, filters.userGroup]);

  const totalOutlets = customerCounts?.total || 0;

  const CoverageBar = ({ pct, color }: { pct: number; color: string }) => (
    <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2, transition: 'width 0.5s' }} />
    </div>
  );

  const coverageColor = (pct: number) =>
    pct < 10 ? '#C0392B' : pct < 30 ? '#E07B39' : '#22C55E';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          pointerEvents: 'auto',
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Panel */}
      <div
        className="slide-in-right"
        style={{
          position: 'relative',
          width: 480,
          height: '100%',
          background: '#FFFFFF',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1E3A5F' }}>Customer Universe</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                {totalOutlets.toLocaleString()} mapped outlets
                {filters.userGroup && <span style={{ marginLeft: 6, color: '#1565C0' }}>· Filtered by {filters.userGroup}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X size={18} color="#9CA3AF" />
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginTop: 12, borderBottom: '2px solid #F3F4F6' }}>
            {([['region', 'By Region'], ['tier', 'By Tier']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  padding: '6px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${activeTab === key ? '#1E3A5F' : 'transparent'}`,
                  marginBottom: -2,
                  color: activeTab === key ? '#1E3A5F' : '#9CA3AF',
                  fontSize: 12,
                  fontWeight: activeTab === key ? 700 : 400,
                  cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {activeTab === 'region' ? (
            <>
              {loadingRegions ? (
                <div style={{ padding: 20 }}>
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, borderRadius: 6 }} />
                  ))}
                </div>
              ) : (
                <>
                  {/* Table header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px', gap: 8, padding: '4px 0 8px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    {['Region', 'Total', 'Visited', 'Coverage'].map(h => (
                      <div key={h} style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h !== 'Region' ? 'right' : 'left' }}>
                        {h}
                      </div>
                    ))}
                  </div>

                  {regionRows.map(row => (
                    <div key={row.region} style={{ padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px', gap: 8, alignItems: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1E3A5F' }}>{row.region}</div>
                        <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'right' }}>{row.total.toLocaleString()}</div>
                        <div style={{ fontSize: 12, color: '#1E3A5F', fontWeight: 500, textAlign: 'right' }}>{row.visited.toLocaleString()}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: coverageColor(row.coverage), textAlign: 'right' }}>
                          {row.coverage.toFixed(1)}%
                        </div>
                      </div>
                      <div style={{ paddingRight: 0 }}>
                        <CoverageBar pct={row.coverage} color={coverageColor(row.coverage)} />
                      </div>
                    </div>
                  ))}

                  {regionRows.length === 0 && (
                    <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
                      No region data available
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 65px 65px 65px 65px', gap: 6, padding: '4px 0 8px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                {['Tier', 'Total', 'Visited', 'Unvisited', 'Coverage'].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h !== 'Tier' ? 'right' : 'left' }}>
                    {h}
                  </div>
                ))}
              </div>

              {tierRows.map(row => {
                const tierKey = Object.entries({ 'General Trade': 'GENERAL TRADE', 'Modern Trade': 'MODERN TRADE', Stockist: 'STOCKIST', Distributor: 'DISTRIBUTOR', 'Key Account': 'KEY ACCOUNT', Hub: 'HUB' })[
                  ['General Trade', 'Modern Trade', 'Stockist', 'Distributor', 'Key Account', 'Hub'].indexOf(row.tier)
                ]?.[1] || 'GENERAL TRADE';
                const color = TIER_COLOURS[tierKey] || '#9E9E9E';

                return (
                  <div key={row.tier} style={{ padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 65px 65px 65px 65px', gap: 6, alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1E3A5F' }}>{row.tier}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'right' }}>{row.total.toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: '#1E3A5F', fontWeight: 500, textAlign: 'right' }}>{row.visited.toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'right' }}>{row.unvisited.toLocaleString()}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: coverageColor(row.coverage), textAlign: 'right' }}>
                        {row.coverage.toFixed(1)}%
                      </div>
                    </div>
                    <div style={{ paddingLeft: 14 }}>
                      <CoverageBar pct={row.coverage} color={color} />
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(0,0,0,0.08)', fontSize: 10, color: '#9CA3AF', flexShrink: 0 }}>
          * Region visited counts are aggregated across all field groups. Tier coverage is estimated.
        </div>
      </div>
    </div>
  );
}
