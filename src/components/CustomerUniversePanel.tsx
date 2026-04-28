import React, { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw, AlertTriangle, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CustomerCategoryCounts, TTMSummary } from '../types';
import { TIER_COLOURS } from '../types';
import { useAppContext } from '../context/AppContext';

// Region centroids for map fly-to — must match MapContainer's REGION_CENTROIDS
const REGION_CENTROIDS: Record<string, { lat: number; lng: number; zoom: number }> = {
  'Nairobi':    { lat: -1.286,  lng: 36.818, zoom: 11 },
  'North Rift': { lat:  0.519,  lng: 35.271, zoom: 9  },
  'South Rift': { lat: -0.905,  lng: 36.065, zoom: 9  },
  'Central':    { lat: -0.304,  lng: 36.886, zoom: 9  },
  'Lake':       { lat: -0.102,  lng: 34.754, zoom: 9  },
  'Coast':      { lat: -3.217,  lng: 40.117, zoom: 9  },
  'Nyanza':     { lat: -0.685,  lng: 34.750, zoom: 10 },
  'Other':      { lat:  0.024,  lng: 37.906, zoom: 7  },
};

// Total active outlets for coverage denominator — Fix 1B
const TOTAL_ACTIVE_OUTLETS = 86148;

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

interface DistributorRegionRow {
  region: string;
  total: number;
  visited: number;
  unvisited: number;
}

const TIER_DEFS: Array<{ key: string; label: string }> = [
  { key: 'GENERAL TRADE', label: 'General Trade' },
  { key: 'MODERN TRADE',  label: 'Modern Trade' },
  { key: 'STOCKIST',      label: 'Stockist' },
  { key: 'DISTRIBUTOR',   label: 'BIDCO Distributor' },
  { key: 'KEY ACCOUNT',   label: 'Key Account' },
  { key: 'HUB',           label: 'Hub' },
];

// Canonical display name for each known region.
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

// Normalize tier using cat field (canonical).
// Fix 1E: cat='DISTRIBUTOR' → BIDCO Distributor; cat='DISTRIBUTOR - FEEDS' → merged with General Trade
// cat='SUPERMARKET' → 'MODERN TRADE'
function normalizeTier(cat: string, tier: string): string {
  const catUpper = (cat || '').trim().toUpperCase();
  if (catUpper === 'DISTRIBUTOR') return 'DISTRIBUTOR';
  if (catUpper === 'DISTRIBUTOR - FEEDS') return 'GENERAL TRADE'; // not a BIDCO distributor
  if (catUpper === 'KEY ACCOUNT') return 'KEY ACCOUNT';
  if (catUpper === 'HUB') return 'HUB';
  if (catUpper === 'STOCKIST') return 'STOCKIST';
  if (catUpper === 'SUPERMARKET' || catUpper === 'MODERN TRADE') return 'MODERN TRADE';
  if (catUpper === 'GENERAL TRADE') return 'GENERAL TRADE';
  // Fall back to tier column if cat is empty/unknown
  const tierUpper = (tier || '').trim().toUpperCase();
  if (tierUpper === 'KEY ACCOUNT') return 'KEY ACCOUNT';
  if (tierUpper === 'HUB') return 'HUB';
  if (tierUpper === 'STOCKIST') return 'STOCKIST';
  if (tierUpper === 'MODERN TRADE') return 'MODERN TRADE';
  // Do NOT map tier='DISTRIBUTOR' here — would include DISTRIBUTOR-FEEDS incorrectly
  return 'GENERAL TRADE';
}

const CACHE_VER = 'v9';
interface UniverseCache {
  ver?: string;
  customers?: Array<{ id: string; region: string; cat: string; tier: string }>;
  globalVisited?: Set<string>;
  groupVisited?: Map<string, Set<string>>;
}
const _cache: UniverseCache = {};

async function fetchAllColumn<T>(
  table: string,
  column: string,
  filter?: { field: string; values: string[] },
  concurrency = 20
): Promise<T[]> {
  const PAGE = 1000;
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
  const { filters, setLayers, setMapFlyTo, setShowUniversePanel } = useAppContext();
  const [activeTab, setActiveTab] = useState<'region' | 'tier'>('region');
  const [regionRows, setRegionRows] = useState<RegionRow[]>([]);
  const [tierRows, setTierRows] = useState<TierRow[]>([]);
  const [distRows, setDistRows] = useState<DistributorRegionRow[]>([]);
  const [distSummary, setDistSummary] = useState<{ total: number; visited: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Loading customer data…');
  const [showDistDetail, setShowDistDetail] = useState(false);

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
        if (_cache.ver !== CACHE_VER) {
          _cache.customers = undefined;
          _cache.globalVisited = undefined;
          _cache.groupVisited = undefined;
          _cache.ver = CACHE_VER;
        }

        if (!_cache.customers) {
          setLoadingMsg('Fetching customer registry…');
          const rows = await fetchAllColumn<{ id: string; region: string; cat: string; tier: string }>(
            'customers', 'id,region,cat,tier'
          );
          _cache.customers = rows;
        }
        const customers = _cache.customers!;
        if (cancelled) return;

        // Fix: visitedSet derived from visits table — matches COUNT(DISTINCT shop_id) FROM visits
        let visitedSet: Set<string>;

        if (groupRepNames) {
          const cacheKey = filters.userGroup!;
          if (!_cache.groupVisited?.has(cacheKey)) {
            setLoadingMsg(`Fetching visits for ${filters.userGroup}…`);
            const rows = await fetchAllColumn<{ shop_id: string }>(
              'visits', 'shop_id',
              { field: 'rep_name', values: groupRepNames }
            );
            if (!_cache.groupVisited) _cache.groupVisited = new Map();
            _cache.groupVisited.set(cacheKey, new Set(rows.map(r => r.shop_id)));
          }
          visitedSet = _cache.groupVisited!.get(filters.userGroup!)!;
        } else {
          if (!_cache.globalVisited) {
            setLoadingMsg('Counting visited outlets nationally…');
            const rows = await fetchAllColumn<{ shop_id: string }>('visits', 'shop_id');
            _cache.globalVisited = new Set(rows.map(r => r.shop_id));
          }
          visitedSet = _cache.globalVisited!;
        }

        if (cancelled) return;

        const totalByRegion: Record<string, number> = {};
        const visitedByRegion: Record<string, number> = {};
        const totalByTier: Record<string, number> = {};
        const visitedByTier: Record<string, number> = {};

        // Distributor intelligence (cat='DISTRIBUTOR' only — BIDCO distributors)
        const distByRegion: Record<string, { total: number; visited: number }> = {};
        let distTotal = 0;
        let distVisited = 0;

        for (const { id, region, cat, tier } of customers) {
          const normRegion = normalizeRegion(region || '');
          const normTier = normalizeTier(cat, tier);

          // Region counts
          totalByRegion[normRegion] = (totalByRegion[normRegion] || 0) + 1;
          if (visitedSet.has(id)) {
            visitedByRegion[normRegion] = (visitedByRegion[normRegion] || 0) + 1;
          }

          // Tier counts
          totalByTier[normTier] = (totalByTier[normTier] || 0) + 1;
          if (visitedSet.has(id)) {
            visitedByTier[normTier] = (visitedByTier[normTier] || 0) + 1;
          }

          // BIDCO distributor intelligence (cat='DISTRIBUTOR' only)
          const catUpper = (cat || '').trim().toUpperCase();
          if (catUpper === 'DISTRIBUTOR') {
            distTotal += 1;
            const r = normRegion;
            if (!distByRegion[r]) distByRegion[r] = { total: 0, visited: 0 };
            distByRegion[r].total += 1;
            if (visitedSet.has(id)) {
              distVisited += 1;
              distByRegion[r].visited += 1;
            }
          }
        }

        const regionResult: RegionRow[] = Object.entries(totalByRegion)
          .filter(([r, t]) => r !== 'Other' || t > 500)
          .map(([region, total]) => {
            const visited = visitedByRegion[region] || 0;
            return { region, total, visited, coverage: total > 0 ? (visited / total) * 100 : 0 };
          })
          .sort((a, b) => b.total - a.total);

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

        const distRegionRows: DistributorRegionRow[] = Object.entries(distByRegion)
          .map(([region, d]) => ({ region, total: d.total, visited: d.visited, unvisited: d.total - d.visited }))
          .sort((a, b) => b.unvisited - a.unvisited);

        if (!cancelled) {
          setRegionRows(regionResult);
          setTierRows(tierResult);
          setDistRows(distRegionRows);
          setDistSummary({ total: distTotal, visited: distVisited });
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
                {totalOutlets.toLocaleString()} outlets with GPS
                {filters.userGroup
                  ? <span style={{ marginLeft: 6, color: '#1565C0', fontWeight: 500 }}>· Filtered: {filters.userGroup}</span>
                  : <span style={{ marginLeft: 6, color: '#9CA3AF' }}>· {TOTAL_ACTIVE_OUTLETS.toLocaleString()} total active (inc. no GPS)</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
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
              ) : (
                <>
                  <div style={{ fontSize: 9, color: '#9CA3AF', padding: '6px 0 2px', fontStyle: 'italic' }}>
                    Click a region to fly the map there
                  </div>
                  {regionRows.map(row => {
                    const centroid = REGION_CENTROIDS[row.region];
                    return (
                      <div
                        key={row.region}
                        onClick={() => {
                          if (centroid) {
                            setMapFlyTo({ ...centroid, label: row.region });
                            setShowUniversePanel(false);
                          }
                        }}
                        style={{
                          padding: '10px 4px',
                          borderBottom: '1px solid rgba(0,0,0,0.04)',
                          cursor: centroid ? 'pointer' : 'default',
                          borderRadius: 4,
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => centroid && ((e.currentTarget as HTMLDivElement).style.background = '#F9FAFB')}
                        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
                        title={centroid ? `Fly map to ${row.region}` : undefined}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 75px', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F', display: 'flex', alignItems: 'center', gap: 5 }}>
                            {centroid && <MapPin size={11} color="#6B7280" />}
                            {row.region}
                          </div>
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
                    );
                  })}
                </>
              )}
            </div>
          ) : (
            <div style={{ padding: '0 20px 16px' }}>

              {/* BIDCO Distributor Intelligence Card */}
              {distSummary && (
                <div style={{
                  margin: '12px 0',
                  borderRadius: 8,
                  border: '1.5px solid #C0392B',
                  background: '#FFF5F5',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '8px 12px',
                    background: '#C0392B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      BIDCO Distributors
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>
                      {distSummary.total} total across Kenya
                    </span>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <div style={{ background: '#DCFCE7', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#166534' }}>
                          {distSummary.visited.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 10, color: '#16A34A', fontWeight: 600 }}>
                          visited ({distSummary.total > 0 ? ((distSummary.visited / distSummary.total) * 100).toFixed(0) : 0}%)
                        </div>
                      </div>
                      <div style={{ background: '#FEE2E2', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#991B1B' }}>
                          {(distSummary.total - distSummary.visited).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 10, color: '#C0392B', fontWeight: 600 }}>
                          never visited ({distSummary.total > 0 ? (((distSummary.total - distSummary.visited) / distSummary.total) * 100).toFixed(0) : 0}%)
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{
                        height: '100%',
                        width: `${distSummary.total > 0 ? (distSummary.visited / distSummary.total) * 100 : 0}%`,
                        background: '#22C55E',
                        borderRadius: 3,
                        transition: 'width 0.6s ease-out',
                      }} />
                    </div>
                    <button
                      onClick={() => setShowDistDetail(v => !v)}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        fontSize: 11,
                        color: '#C0392B',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        padding: '4px 0 0',
                      }}
                    >
                      {showDistDetail ? 'Hide' : 'Show'} breakdown by region
                      <span style={{ fontSize: 10 }}>{showDistDetail ? '▲' : '▼'}</span>
                    </button>
                    {showDistDetail && distRows.length > 0 && (
                      <div style={{ marginTop: 8, borderTop: '1px solid rgba(192,57,43,0.2)', paddingTop: 8 }}>
                        <div style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 6, fontStyle: 'italic' }}>
                          Click a region to fly the map there and show distributors
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 50px 60px', gap: 6, marginBottom: 4 }}>
                          {['Region', 'Total', 'Visited', 'Missing'].map(h => (
                            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: h === 'Region' ? 'left' : 'right' }}>
                              {h}
                            </div>
                          ))}
                        </div>
                        {distRows.map(row => {
                          const centroid = REGION_CENTROIDS[row.region];
                          return (
                            <div
                              key={row.region}
                              onClick={() => {
                                if (centroid) {
                                  // Activate distributor tier filter on map
                                  setLayers(prev => ({
                                    ...prev,
                                    customerUniverse: true,
                                    customerTier: 'DISTRIBUTOR',
                                  }));
                                  // Signal map to fly to this region
                                  setMapFlyTo({ ...centroid, label: `${row.region} Distributors` });
                                  // Close panel so map is fully visible
                                  setShowUniversePanel(false);
                                }
                              }}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 50px 50px 60px',
                                gap: 6,
                                padding: '5px 4px',
                                borderBottom: '1px solid rgba(0,0,0,0.04)',
                                alignItems: 'center',
                                cursor: centroid ? 'pointer' : 'default',
                                borderRadius: 4,
                                transition: 'background 0.12s',
                              }}
                              onMouseEnter={e => centroid && ((e.currentTarget as HTMLDivElement).style.background = 'rgba(192,57,43,0.06)')}
                              onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
                              title={centroid ? `Fly map to ${row.region} and show distributors` : undefined}
                            >
                              <div style={{ fontSize: 11, color: '#1E3A5F', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                {centroid && <MapPin size={10} color="#C0392B" />}
                                {row.region}
                              </div>
                              <div style={{ fontSize: 11, color: '#6B7280', textAlign: 'right' }}>{row.total}</div>
                              <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, textAlign: 'right' }}>{row.visited}</div>
                              <div style={{ fontSize: 11, color: '#C0392B', fontWeight: 600, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                                {row.unvisited > 0 && <AlertTriangle size={10} />}
                                {row.unvisited}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tier table */}
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
          Coverage = COUNT(DISTINCT shop_id) FROM visits / {TOTAL_ACTIVE_OUTLETS.toLocaleString()} active outlets.
          {loading ? '' : ' Click ↺ to refresh.'}
        </div>
      </div>
    </div>
  );
}
