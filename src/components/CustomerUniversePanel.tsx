import React, { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CustomerCategoryCounts, TTMSummary } from '../types';
import { TIER_COLOURS } from '../types';
import { useAppContext } from '../context/AppContext';

interface CustomerUniversePanelProps {
  customerCounts: CustomerCategoryCounts | null;
  ttmSummary: TTMSummary[];
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

const TIER_DEFS: Array<{ key: string; label: string }> = [
  { key: 'GENERAL TRADE', label: 'General Trade' },
  { key: 'MODERN TRADE',  label: 'Modern Trade' },
  { key: 'STOCKIST',      label: 'Stockist' },
  { key: 'DISTRIBUTOR',   label: 'Distributor' },
  { key: 'KEY ACCOUNT',   label: 'Key Account' },
  { key: 'HUB',           label: 'Hub' },
];

// Canonical display name for each known region.
// IMPORTANT: checks are ordered most-specific first to avoid mismatch.
// "Nairobi - Local" and similar sub-regions must hit the nairobi check before any rift check.
// Bare "RIFT" / "RIFT VALLEY" (no north/south qualifier) goes to Other — do NOT assume North Rift.
function normalizeRegion(raw: string): string {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return 'Other';
  if (s.includes('nairobi') || s === 'local' || s === 'nairobi local') return 'Nairobi';
  if (s.includes('north') && s.includes('rift')) return 'North Rift';
  if (s.includes('south') && s.includes('rift')) return 'South Rift';
  if (s.includes('central')) return 'Central';
  if (s.includes('lake') || s.includes('western')) return 'Lake';
  if (s.includes('coast')) return 'Coast';
  if (s.includes('nyanza')) return 'Nyanza';
  return 'Other';
}

// ── Module-level cache: persists while the page is open so re-opening is instant ──
// Bump CACHE_VER whenever normalization logic or fetched columns change.
const CACHE_VER = 'v6';
interface UniverseCache {
  ver?: string;
  customers?: Array<{ id: string; region: string; cat: string; tier: string }>;
  globalVisited?: Set<string>;
  groupVisited?: Map<string, Set<string>>; // group name → Set<shop_id>
}
const _cache: UniverseCache = {};

// Fetch all rows from a table column in parallel batches of `concurrency` pages.
async function fetchAllColumn<T>(
  table: string,
  column: string,
  filter?: { field: string; values: string[] },
  concurrency = 20
): Promise<T[]> {
  const PAGE = 1000;

  // Get total count first (HEAD request — returns no rows, just count)
  let countQuery = supabase.from(table).select(column, { count: 'exact', head: true });
  if (filter) countQuery = (countQuery as any).in(filter.field, filter.values);
  const { count } = await countQuery;
  if (!count || count === 0) return [];

  const pages = Math.ceil(count / PAGE);
  const all: T[] = [];

  for (let i = 0; i < pages; i += concurrency) {
    const batch = Array.from({ length: Math.min(concurrency, pages - i) }, (_, j) => {
      const from = (i + j) * PAGE;
      let q = supabase.from(table).select(column).range(from, from + PAGE - 1);
      if (filter) q = (q as any).in(filter.field, filter.values);
      return q;
    });
    const results = await Promise.all(batch);
    for (const r of results) {
      if (r.data) all.push(...(r.data as T[]));
    }
  }

  return all;
}

export default function CustomerUniversePanel({ customerCounts, ttmSummary, onClose }: CustomerUniversePanelProps) {
  const { filters } = useAppContext();
  const [activeTab, setActiveTab] = useState<'region' | 'tier'>('region');
  const [regionRows, setRegionRows] = useState<RegionRow[]>([]);
  const [tierRows, setTierRows] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Loading customer data…');

  // Rep raw_names for the selected group (for group-filtered visited counts)
  const groupRepNames = useMemo(() =>
    filters.userGroup
      ? ttmSummary.filter(r => r.role === filters.userGroup).map(r => r.raw_name)
      : null,
    [ttmSummary, filters.userGroup]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadingMsg('Loading customer data…');

    const run = async () => {
      try {
        // Bust cache if normalization logic was updated
        if (_cache.ver !== CACHE_VER) {
          _cache.customers = undefined;
          _cache.globalVisited = undefined;
          _cache.groupVisited = undefined;
          _cache.ver = CACHE_VER;
        }

        // ── Step 1: Fetch all customers (id, region, cat, tier) — cached globally ──
        // Some tiers (Modern Trade) may be stored in `tier`, others in `cat`.
        // Null/empty → 'GENERAL TRADE' (matches MapContainer's fallback logic).
        if (!_cache.customers) {
          setLoadingMsg('Fetching customer registry (79k outlets)…');
          const rows = await fetchAllColumn<{ id: string; region: string; cat: string; tier: string }>(
            'customers', 'id,region,cat,tier'
          );
          _cache.customers = rows;
        }
        const customers = _cache.customers!;
        if (cancelled) return;

        // ── Step 2: Fetch visited shop_ids from visit_frequency ──
        // The correct query: SELECT DISTINCT shop_id FROM visit_frequency [WHERE rep_name IN group]
        // This gives us exactly the set of customer IDs that map to "visited" in the JOIN:
        //   SELECT c.region, COUNT(DISTINCT c.id) as visited
        //   FROM customers c
        //   INNER JOIN (SELECT DISTINCT shop_id FROM visits) v ON c.id = v.shop_id
        //   GROUP BY c.region

        let visitedSet: Set<string>;

        if (groupRepNames) {
          // Group-filtered: only count shops visited by this group's reps
          const cacheKey = filters.userGroup!;
          if (!_cache.groupVisited?.has(cacheKey)) {
            setLoadingMsg(`Fetching visits for ${filters.userGroup}…`);
            const rows = await fetchAllColumn<{ shop_id: string }>(
              'visit_frequency', 'shop_id',
              { field: 'rep_name', values: groupRepNames }
            );
            if (!_cache.groupVisited) _cache.groupVisited = new Map();
            _cache.groupVisited.set(cacheKey, new Set(rows.map(r => r.shop_id)));
          }
          visitedSet = _cache.groupVisited!.get(filters.userGroup!)!;
        } else {
          // Global (no group filter): count shops visited by ANY rep
          if (!_cache.globalVisited) {
            setLoadingMsg('Counting visited outlets nationally…');
            const rows = await fetchAllColumn<{ shop_id: string }>(
              'visit_frequency', 'shop_id'
            );
            _cache.globalVisited = new Set(rows.map(r => r.shop_id));
          }
          visitedSet = _cache.globalVisited!;
        }

        if (cancelled) return;

        // ── Step 3: JOIN in JS — exactly equivalent to the SQL JOIN ──
        // SELECT c.region, COUNT(DISTINCT c.id) as visited
        // FROM customers c
        // INNER JOIN (SELECT DISTINCT shop_id FROM visit_frequency) v ON c.id = v.shop_id
        // GROUP BY c.region

        const totalByRegion: Record<string, number> = {};
        const visitedByRegion: Record<string, number> = {};
        const totalByTier: Record<string, number> = {};
        const visitedByTier: Record<string, number> = {};

        for (const { id, region, cat, tier } of customers) {
          const normRegion = normalizeRegion(region || '');
          // Use tier first (may store 'MODERN TRADE' etc.), fall back to cat, then GENERAL TRADE
          const normTier = ((tier && tier.trim()) || (cat && cat.trim()) || 'GENERAL TRADE').toUpperCase();

          // Region counts
          totalByRegion[normRegion] = (totalByRegion[normRegion] || 0) + 1;
          if (visitedSet.has(id)) {
            visitedByRegion[normRegion] = (visitedByRegion[normRegion] || 0) + 1;
          }

          // Tier counts
          if (normTier) {
            totalByTier[normTier] = (totalByTier[normTier] || 0) + 1;
            if (visitedSet.has(id)) {
              visitedByTier[normTier] = (visitedByTier[normTier] || 0) + 1;
            }
          }
        }

        // Build region rows (exclude "Other" unless significant)
        const regionResult: RegionRow[] = Object.entries(totalByRegion)
          .filter(([r, t]) => r !== 'Other' || t > 500)
          .map(([region, total]) => {
            const visited = visitedByRegion[region] || 0;
            return { region, total, visited, coverage: total > 0 ? (visited / total) * 100 : 0 };
          })
          .sort((a, b) => b.total - a.total);

        // Build tier rows
        const tierResult: TierRow[] = TIER_DEFS
          .map(({ key, label }) => {
            const total = totalByTier[key] || 0;
            const visited = visitedByTier[key] || 0;
            return {
              tier: label,
              tierKey: key,
              total,
              visited,
              unvisited: total - visited,
              coverage: total > 0 ? (visited / total) * 100 : 0,
            };
          })
          .filter(r => r.total > 0);

        if (!cancelled) {
          setRegionRows(regionResult);
          setTierRows(tierResult);
          setLoading(false);
        }
      } catch (err) {
        console.error('CustomerUniversePanel error:', err);
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [filters.userGroup, groupRepNames]);

  const totalOutlets = customerCounts?.total || 0;

  const coverageColor = (pct: number) =>
    pct < 10 ? '#C0392B' : pct < 40 ? '#E07B39' : '#22C55E';

  const CoverageBar = ({ pct, color }: { pct: number; color: string }) => (
    <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
      <div style={{
        height: '100%',
        width: `${Math.min(pct, 100)}%`,
        background: color,
        borderRadius: 2,
        transition: 'width 0.5s ease-out',
      }} />
    </div>
  );

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
          width: 500,
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
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1E3A5F' }}>Customer Universe</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                {totalOutlets.toLocaleString()} mapped outlets
                {filters.userGroup
                  ? <span style={{ marginLeft: 6, color: '#1565C0', fontWeight: 500 }}>· Filtered: {filters.userGroup}</span>
                  : <span style={{ marginLeft: 6, color: '#9CA3AF' }}>· National view</span>}
              </div>
              {!loading && (
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
                  Visited = COUNT(DISTINCT customer) with at least 1 visit
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {/* Refresh button to bust cache */}
              <button
                onClick={() => {
                  _cache.ver = undefined;
                  _cache.customers = undefined;
                  _cache.globalVisited = undefined;
                  _cache.groupVisited = undefined;
                  setLoading(true);
                }}
                title="Refresh data"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
              >
                <RefreshCw size={14} color="#9CA3AF" />
              </button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <X size={18} color="#9CA3AF" />
              </button>
            </div>
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
          {loading ? (
            <div style={{ padding: '24px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, color: '#6B7280', fontSize: 12 }}>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                {loadingMsg}
              </div>
              {[1,2,3,4,5,6,7].map(i => (
                <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8, borderRadius: 6 }} />
              ))}
            </div>
          ) : activeTab === 'region' ? (
            <div style={{ padding: '0 20px 16px' }}>
              {/* Column headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 80px 75px',
                gap: 8,
                padding: '10px 0 6px',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
                position: 'sticky',
                top: 0,
                background: '#FFFFFF',
                zIndex: 1,
              }}>
                {['Region', 'Total', 'Visited', 'Coverage'].map(h => (
                  <div key={h} style={{
                    fontSize: 9, fontWeight: 700, color: '#9CA3AF',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    textAlign: h === 'Region' ? 'left' : 'right',
                  }}>
                    {h}
                  </div>
                ))}
              </div>

              {regionRows.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
                  No regional data found
                </div>
              ) : regionRows.map(row => (
                <div key={row.region} style={{ padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 75px', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F' }}>{row.region}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'right' }}>
                      {row.total.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1E3A5F', textAlign: 'right' }}>
                      {row.visited.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: coverageColor(row.coverage), textAlign: 'right' }}>
                      {row.coverage.toFixed(1)}%
                    </div>
                  </div>
                  <CoverageBar pct={row.coverage} color={coverageColor(row.coverage)} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '0 20px 16px' }}>
              {/* Column headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 65px 65px 65px 68px',
                gap: 6,
                padding: '10px 0 6px',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
                position: 'sticky',
                top: 0,
                background: '#FFFFFF',
                zIndex: 1,
              }}>
                {['Tier', 'Total', 'Visited', 'Unvisited', 'Coverage'].map(h => (
                  <div key={h} style={{
                    fontSize: 9, fontWeight: 700, color: '#9CA3AF',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    textAlign: h === 'Tier' ? 'left' : 'right',
                  }}>
                    {h}
                  </div>
                ))}
              </div>

              {tierRows.map(row => {
                const color = TIER_COLOURS[row.tierKey] || '#9E9E9E';
                return (
                  <div key={row.tier} style={{ padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 65px 65px 65px 68px', gap: 6, alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1E3A5F' }}>{row.tier}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'right' }}>
                        {row.total.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1E3A5F', textAlign: 'right' }}>
                        {row.visited.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'right' }}>
                        {row.unvisited.toLocaleString()}
                      </div>
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

        <div style={{ padding: '8px 20px', borderTop: '1px solid rgba(0,0,0,0.08)', fontSize: 10, color: '#9CA3AF', flexShrink: 0 }}>
          Visited = COUNT(DISTINCT customer_id) via JOIN with visit_frequency.
          {loading ? '' : ' Data cached — click ↺ to refresh.'}
        </div>
      </div>
    </div>
  );
}
