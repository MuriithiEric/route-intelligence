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
  tierKey: string;
  total: number;
  visited: number;
  unvisited: number;
  coverage: number;
}

const TIER_DEFS: Array<{ key: keyof CustomerCategoryCounts; label: string }> = [
  { key: 'GENERAL TRADE', label: 'General Trade' },
  { key: 'MODERN TRADE',  label: 'Modern Trade' },
  { key: 'STOCKIST',      label: 'Stockist' },
  { key: 'DISTRIBUTOR',   label: 'Distributor' },
  { key: 'KEY ACCOUNT',   label: 'Key Account' },
  { key: 'HUB',           label: 'Hub' },
];

// Known regions matching DB values (partial match approach)
const KNOWN_REGIONS = [
  'Nairobi',
  'North Rift',
  'South Rift',
  'Central',
  'Lake',
  'Coast',
  'Nyanza',
];

// Normalize region label for display
function normalizeLabel(r: string): string {
  const lower = r.toLowerCase();
  if (lower.includes('nairobi')) return 'Nairobi';
  if (lower.includes('north rift') || lower.includes('north-rift')) return 'North Rift';
  if (lower.includes('south rift') || lower.includes('south-rift')) return 'South Rift';
  if (lower.includes('central')) return 'Central';
  if (lower.includes('lake')) return 'Lake';
  if (lower.includes('coast')) return 'Coast';
  if (lower.includes('nyanza')) return 'Nyanza';
  if (lower.includes('rift valley')) return 'North Rift';
  return r;
}

export default function CustomerUniversePanel({ customerCounts, userGroupRegions, onClose }: CustomerUniversePanelProps) {
  const { filters } = useAppContext();
  const [activeTab, setActiveTab] = useState<'region' | 'tier'>('region');
  const [regionRows, setRegionRows] = useState<RegionRow[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(true);

  useEffect(() => {
    setLoadingRegions(true);

    // Use COUNT queries per region — avoids fetching 79k rows just to group by region
    // Each query uses ilike so it handles variants like "Nairobi - Local", "NORTH RIFT", etc.
    const regionPatterns: Record<string, string> = {
      'Nairobi':    'nairobi',
      'North Rift': 'north%rift',
      'South Rift': 'south%rift',
      'Central':    'central',
      'Lake':       'lake',
      'Coast':      'coast',
      'Nyanza':     'nyanza',
    };

    Promise.all(
      Object.entries(regionPatterns).map(async ([label, pattern]) => {
        const { count } = await supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .ilike('region', `%${pattern}%`);
        return { label, total: count || 0 };
      })
    ).then(counts => {
      // Build visited counts from user_group_regions by normalising region names
      const filtered = filters.userGroup
        ? userGroupRegions.filter(r => r.category === filters.userGroup)
        : userGroupRegions;

      const visitedByNorm: Record<string, number> = {};
      for (const row of filtered) {
        const norm = normalizeLabel(row.region);
        visitedByNorm[norm] = (visitedByNorm[norm] || 0) + row.unique_shops;
      }

      const rows: RegionRow[] = counts
        .filter(c => c.total > 0)
        .map(({ label, total }) => {
          const visited = Math.min(visitedByNorm[label] || 0, total);
          return {
            region: label,
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

    const filtered = filters.userGroup
      ? userGroupRegions.filter(r => r.category === filters.userGroup)
      : userGroupRegions;

    const totalVisited = filtered.reduce((sum, r) => sum + r.unique_shops, 0);
    const totalCustomers = customerCounts.total || 1;
    const visitRatio = Math.min(totalVisited / totalCustomers, 1);

    return TIER_DEFS.map(({ key, label }) => {
      const total = key === 'total' ? 0 : (customerCounts[key] as number) || 0;
      const visited = Math.round(total * visitRatio);
      return {
        tier: label,
        tierKey: String(key),
        total,
        visited: Math.min(visited, total),
        unvisited: Math.max(total - visited, 0),
        coverage: total > 0 ? (visited / total) * 100 : 0,
      };
    }).filter(r => r.total > 0);
  }, [customerCounts, userGroupRegions, filters.userGroup]);

  const totalOutlets = customerCounts?.total || 0;

  const CoverageBar = ({ pct, color }: { pct: number; color: string }) => (
    <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease-out' }} />
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
        alignItems: 'stretch',
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
        <div style={{ padding: '16px 20px 0', borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1E3A5F' }}>Customer Universe</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                {totalOutlets.toLocaleString()} mapped outlets
                {filters.userGroup && <span style={{ marginLeft: 6, color: '#1565C0' }}>· {filters.userGroup}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X size={18} color="#9CA3AF" />
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {([['region', 'By Region'], ['tier', 'By Tier']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${activeTab === key ? '#1E3A5F' : 'transparent'}`,
                  color: activeTab === key ? '#1E3A5F' : '#9CA3AF',
                  fontSize: 12,
                  fontWeight: activeTab === key ? 700 : 400,
                  cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'color 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'region' ? (
            <div style={{ padding: '0 20px 16px' }}>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 80px 70px',
                gap: 8,
                padding: '10px 0 6px',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
                position: 'sticky',
                top: 0,
                background: '#FFFFFF',
              }}>
                {['Region', 'Total', 'Visited', 'Coverage'].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h !== 'Region' ? 'right' : 'left' }}>
                    {h}
                  </div>
                ))}
              </div>

              {loadingRegions ? (
                <div>
                  {[1,2,3,4,5,6,7].map(i => (
                    <div key={i} className="skeleton" style={{ height: 52, marginTop: 8, borderRadius: 6 }} />
                  ))}
                </div>
              ) : (
                regionRows.map(row => (
                  <div key={row.region} style={{ padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 70px', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F' }}>{row.region}</div>
                      <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'right' }}>{row.total.toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: '#1E3A5F', fontWeight: 600, textAlign: 'right' }}>{row.visited.toLocaleString()}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: coverageColor(row.coverage), textAlign: 'right' }}>
                        {row.coverage.toFixed(1)}%
                      </div>
                    </div>
                    <CoverageBar pct={row.coverage} color={coverageColor(row.coverage)} />
                  </div>
                ))
              )}

              {!loadingRegions && regionRows.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
                  No regional data available
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '0 20px 16px' }}>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 65px 65px 65px 65px',
                gap: 6,
                padding: '10px 0 6px',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
                position: 'sticky',
                top: 0,
                background: '#FFFFFF',
              }}>
                {['Tier', 'Total', 'Visited', 'Unvisited', 'Coverage'].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h !== 'Tier' ? 'right' : 'left' }}>
                    {h}
                  </div>
                ))}
              </div>

              {tierRows.map(row => {
                const color = TIER_COLOURS[row.tierKey] || '#9E9E9E';
                return (
                  <div key={row.tier} style={{ padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 65px 65px 65px 65px', gap: 6, alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1E3A5F' }}>{row.tier}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'right' }}>{row.total.toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: '#1E3A5F', fontWeight: 600, textAlign: 'right' }}>{row.visited.toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'right' }}>{row.unvisited.toLocaleString()}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: coverageColor(row.coverage), textAlign: 'right' }}>
                        {row.coverage.toFixed(1)}%
                      </div>
                    </div>
                    <div style={{ paddingLeft: 14 }}>
                      <CoverageBar pct={row.coverage} color={color} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(0,0,0,0.08)', fontSize: 10, color: '#9CA3AF', flexShrink: 0 }}>
          Region totals from live DB count queries. Visited counts aggregated from field group data.
        </div>
      </div>
    </div>
  );
}
