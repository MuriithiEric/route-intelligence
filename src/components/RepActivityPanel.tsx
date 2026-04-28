import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Download, MapPin, ChevronDown, ChevronRight, Trophy, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useMapData } from '../hooks/useMapData';
import type { TTMSummary, DailyActivity, ShopVisitRow, RouteSummary, RepProfile } from '../types';
import { TIER_COLOURS, GROUP_COLOURS } from '../types';

interface RepActivityPanelProps {
  repName: string;
  repData: TTMSummary | null;
  onClose: () => void;
}

type DateFilter = 'all' | 'month' | 'week' | 'custom';
type ViewMode = 'shops' | 'days' | 'routes';

function TierDot({ tier }: { tier: string | null }) {
  const color = tier ? TIER_COLOURS[tier] || '#9E9E9E' : '#9E9E9E';
  return (
    <span
      title={tier || ''}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

const PAGE_SIZE = 100;

export default function RepActivityPanel({ repName, repData, onClose }: RepActivityPanelProps) {
  const { setFilters } = useAppContext();
  const { fetchRepDailyActivity, fetchRepShopVisits, fetchRepRoutes, fetchRepProfile, fetchAllRepShopVisitsForCSV } = useMapData();

  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [shopVisits, setShopVisits] = useState<ShopVisitRow[]>([]);
  const [repRoutes, setRepRoutes] = useState<RouteSummary[]>([]);
  const [repProfile, setRepProfile] = useState<RepProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('shops');
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [shopsDisplayLimit, setShopsDisplayLimit] = useState(PAGE_SIZE);
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);

  const groupColor = GROUP_COLOURS[repData?.role || ''] || '#6B7280';

  useEffect(() => {
    setLoading(true);
    setShopsDisplayLimit(PAGE_SIZE);
    Promise.all([
      fetchRepDailyActivity(repName),
      fetchRepShopVisits(repName),
      fetchRepRoutes(repName),
      fetchRepProfile(repName),
    ]).then(([daily, shops, routes, profile]) => {
      setDailyActivity(daily);
      setShopVisits(shops);
      setRepRoutes(routes);
      setRepProfile(profile);
      setLoading(false);
    }).catch(err => {
      console.error('RepActivityPanel load error:', err);
      setLoading(false);
    });
  }, [repName, fetchRepDailyActivity, fetchRepShopVisits, fetchRepRoutes, fetchRepProfile]);

  const filteredShops = useMemo(() => {
    if (dateFilter === 'all') return shopVisits;
    const now = new Date();
    const cutoff = dateFilter === 'week'
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : dateFilter === 'month'
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : null;
    if (!cutoff) return shopVisits;
    return shopVisits.filter(s => new Date(s.check_in) >= cutoff);
  }, [shopVisits, dateFilter]);

  useEffect(() => { setShopsDisplayLimit(PAGE_SIZE); }, [dateFilter]);

  // FIX 6b: always show true unique shop count from rep_profiles for all-time
  const uniqueShopCount = useMemo(() => {
    if (dateFilter === 'all') return repProfile?.unique_shops ?? repData?.unique_shops ?? null;
    return new Set(filteredShops.map(s => s.shop_id)).size;
  }, [dateFilter, repProfile, repData, filteredShops]);

  // FIX 3: sorted routes for most/least visited sections
  const sortedRoutes = useMemo(() =>
    [...repRoutes].sort((a, b) => b.visits - a.visits),
    [repRoutes]
  );
  const routeTotal = sortedRoutes.length;
  const topRoutes = sortedRoutes.slice(0, Math.min(3, routeTotal));
  const leastCount = routeTotal > 3 ? Math.min(3, routeTotal - 3) : 0;
  const leastRoutes = leastCount > 0 ? sortedRoutes.slice(routeTotal - leastCount) : [];
  const middleRoutes = routeTotal > 6 ? sortedRoutes.slice(3, routeTotal - 3) : [];
  const maxRouteVisits = sortedRoutes[0]?.visits || 1;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const triggerDownload = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // FIX 1: file names use _all suffix
  const fileBase = repName.replace(/\s+/g, '_');

  // FIX 1: shops CSV fetches ALL visits via paginated query (no row cap)
  const downloadShopsCSV = useCallback(async () => {
    setCsvLoading(true);
    try {
      const allShops = await fetchAllRepShopVisitsForCSV(repName);
      const source = dateFilter === 'all' ? allShops : allShops.filter(s => {
        const now = new Date();
        const cutoff = dateFilter === 'week'
          ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          : new Date(now.getFullYear(), now.getMonth(), 1);
        return new Date(s.check_in) >= cutoff;
      });
      const headers = ['Shop Name', 'Tier', 'Category', 'Region', 'Visit Date', 'Time', 'Duration (min)', 'Visit Count'];
      const rows = source.map(s => [
        `"${(s.shop_name || '').replace(/"/g, '""')}"`,
        s.tier || '',
        s.cat || '',
        s.region,
        formatDate(s.check_in),
        formatTime(s.check_in),
        s.duration || '',
        s.visit_count,
      ]);
      triggerDownload([headers.join(','), ...rows.map(r => r.join(','))].join('\n'), `${fileBase}_shops_all.csv`);
    } finally {
      setCsvLoading(false);
    }
  }, [repName, dateFilter, fetchAllRepShopVisitsForCSV, fileBase]);

  const downloadDaysCSV = useCallback(() => {
    const headers = ['Date', 'Day Start', 'Day End', 'Visits That Day', 'Shops That Day'];
    const rows = dailyActivity.map(d => [
      d.date,
      d.day_start || '',
      d.day_end || '',
      d.visits_that_day,
      d.shops_that_day,
    ]);
    triggerDownload([headers.join(','), ...rows.map(r => r.join(','))].join('\n'), `${fileBase}_days_all.csv`);
  }, [dailyActivity, fileBase]);

  const downloadRoutesCSV = useCallback(() => {
    const headers = ['Route Name', 'Visits', 'Shops', 'Primary Region'];
    const rows = sortedRoutes.map(r => [
      `"${(r.route_name || '').replace(/"/g, '""')}"`,
      r.visits,
      r.shops,
      r.primary_region,
    ]);
    triggerDownload([headers.join(','), ...rows.map(r => r.join(','))].join('\n'), `${fileBase}_routes_all.csv`);
  }, [sortedRoutes, fileBase]);

  const handleDownload = viewMode === 'days' ? downloadDaysCSV
    : viewMode === 'routes' ? downloadRoutesCSV
    : downloadShopsCSV;

  const RouteRow = ({ route, barColor }: { route: RouteSummary; barColor: string }) => (
    <div
      onClick={() => setFilters(prev => ({ ...prev, route: route.route_id }))}
      style={{
        padding: '7px 10px',
        borderBottom: '1px solid rgba(0,0,0,0.04)',
        cursor: 'pointer',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#1E3A5F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {route.route_name}
          </div>
          <div style={{ fontSize: 10, color: '#6B7280' }}>
            {route.visits.toLocaleString()} visits · {route.shops} shops · {route.primary_region}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 4 }}>
        <div style={{ height: 3, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(route.visits / maxRouteVisits) * 100}%`,
            background: barColor,
            borderRadius: 2,
            transition: 'width 0.3s',
          }} />
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="slide-in-right"
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 380,
        background: '#FFFFFF',
        borderLeft: '1px solid rgba(0,0,0,0.08)',
        zIndex: 901,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-6px 0 24px rgba(0,0,0,0.10)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
        <div style={{ height: 3, background: groupColor, borderRadius: 2, marginBottom: 10 }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1E3A5F' }}>{repData?.name ?? repName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              {repData?.role && (
                <span style={{
                  background: groupColor,
                  color: '#FFFFFF',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 4,
                }}>
                  {repData.role}
                </span>
              )}
              {(() => {
                const isActive = repData?.rep_status !== 'Inactive';
                return (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '2px 6px',
                    borderRadius: 10,
                    background: isActive ? '#DCFCE7' : '#F3F4F6',
                    color: isActive ? '#16A34A' : '#6B7280',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}>
                    <span style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: isActive ? '#16A34A' : '#9CA3AF',
                      display: 'inline-block',
                    }} />
                    {isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                );
              })()}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#6B7280' }}>
                <MapPin size={10} />
                {repData?.primary_region || '—'}
              </div>
              {repData?.last_active && (
                <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                  · Last active {new Date(repData.last_active).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
            <X size={16} color="#9CA3AF" />
          </button>
        </div>

        {repData?.rep_status === 'Inactive' && (
          <div style={{
            marginTop: 8,
            padding: '6px 10px',
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: 6,
            fontSize: 11,
            color: '#92400E',
            fontWeight: 500,
          }}>
            ⚠️ This rep is currently inactive
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 10 }}>
          {[
            { label: 'Visits', value: repData?.total_visits?.toLocaleString() ?? '—', tooltip: 'Total visits recorded' },
            { label: 'Shops', value: repData?.unique_shops?.toLocaleString() ?? '—', tooltip: 'Unique shops visited' },
            {
              label: 'Coverage',
              value: repData?.unique_shops != null
                ? `${((repData.unique_shops / 86148) * 100).toFixed(2)}%`
                : '—',
              tooltip: `${repData?.unique_shops?.toLocaleString() ?? '—'} of 86,148 active outlets visited`,
            },
            { label: 'V/Day', value: repData?.visits_per_day != null ? repData.visits_per_day.toFixed(1) : '—', tooltip: 'Average visits per field day' },
          ].map(stat => (
            <div key={stat.label} title={stat.tooltip} style={{
              background: '#F9FAFB',
              borderRadius: 6,
              padding: '6px 8px',
              textAlign: 'center',
              border: '1px solid rgba(0,0,0,0.05)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F' }}>{stat.value}</div>
              <div style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {repData && (
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <span style={{ fontSize: 10, color: '#6B7280' }}>
              <span style={{ fontWeight: 600, color: '#1E3A5F' }}>{repData.field_days}</span> field days
            </span>
            <span style={{ fontSize: 10, color: '#6B7280' }}>
              <span style={{ fontWeight: 600, color: '#1E3A5F' }}>{repData.avg_duration?.toFixed(1)}</span> min avg visit
            </span>
            <span style={{ fontSize: 10, color: '#6B7280' }}>
              <span style={{ fontWeight: 600, color: '#1E3A5F' }}>{repData.unique_routes}</span> routes
            </span>
          </div>
        )}
      </div>

      {/* Date filter chips */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', gap: 6, flexShrink: 0 }}>
        {(['all', 'month', 'week'] as DateFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            style={{
              padding: '3px 10px',
              borderRadius: 20,
              border: `1px solid ${dateFilter === f ? '#1E3A5F' : 'rgba(0,0,0,0.1)'}`,
              background: dateFilter === f ? '#1E3A5F' : 'transparent',
              color: dateFilter === f ? '#FFFFFF' : '#6B7280',
              fontSize: 10,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              textTransform: 'capitalize',
            }}
          >
            {f === 'all' ? 'All time' : f === 'month' ? 'This month' : 'This week'}
          </button>
        ))}
      </div>

      {/* View tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
        {(['shops', 'days', 'routes'] as ViewMode[]).map(v => (
          <button
            key={v}
            onClick={() => setViewMode(v)}
            style={{
              flex: 1,
              padding: '7px',
              background: viewMode === v ? '#F0F4FF' : 'transparent',
              border: 'none',
              borderBottom: `2px solid ${viewMode === v ? '#1E3A5F' : 'transparent'}`,
              color: viewMode === v ? '#1E3A5F' : '#9CA3AF',
              fontSize: 10,
              fontWeight: viewMode === v ? 700 : 400,
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {/* FIX 6b: always show TRUE unique shop count, not row count */}
            {v === 'shops' ? `Shops (${uniqueShopCount ?? '…'})` : v === 'days' ? `Days (${dailyActivity.length})` : `Routes (${repRoutes.length})`}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 16 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton" style={{ height: 32, marginBottom: 6, borderRadius: 4 }} />
            ))}
          </div>
        ) : viewMode === 'shops' ? (
          <>
            {/* FIX 6d: empty state */}
            {filteredShops.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>
                  No visits recorded{dateFilter === 'week' ? ' this week' : dateFilter === 'month' ? ' this month' : ''}
                </div>
                {dateFilter !== 'all' && (
                  <button
                    onClick={() => setDateFilter('all')}
                    style={{ fontSize: 11, color: '#1565C0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', textDecoration: 'underline' }}
                  >
                    View all time
                  </button>
                )}
              </div>
            ) : (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 40px 60px 60px 60px',
                  padding: '6px 10px',
                  background: '#F9FAFB',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                  position: 'sticky',
                  top: 0,
                }}>
                  {['Shop', 'Tier', 'Date', 'Min', '×'].map(h => (
                    <div key={h} style={{ fontSize: 9, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {h}
                    </div>
                  ))}
                </div>

                {filteredShops.slice(0, shopsDisplayLimit).map((shop, i) => (
                  <div
                    key={`${shop.shop_id}-${i}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 40px 60px 60px 60px',
                      padding: '5px 10px',
                      borderBottom: '1px solid rgba(0,0,0,0.04)',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ fontSize: 11, color: '#1E3A5F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {shop.shop_name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <TierDot tier={shop.tier} />
                    </div>
                    <div style={{ fontSize: 10, color: '#6B7280' }}>{formatDate(shop.check_in)}</div>
                    <div style={{ fontSize: 10, color: '#6B7280' }}>{shop.duration || '—'}</div>
                    <div style={{ fontSize: 10, color: '#C9963E', fontWeight: 600 }}>{shop.visit_count}×</div>
                  </div>
                ))}
                {shopsDisplayLimit < filteredShops.length && (
                  <button
                    onClick={() => setShopsDisplayLimit(n => n + PAGE_SIZE)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: '#F9FAFB',
                      border: 'none',
                      borderTop: '1px solid rgba(0,0,0,0.06)',
                      color: '#1565C0',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    Load more ({filteredShops.length - shopsDisplayLimit} remaining)
                  </button>
                )}
              </>
            )}
          </>
        ) : viewMode === 'days' ? (
          <>
            {/* FIX 6d: empty state for days */}
            {dailyActivity.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>No daily activity found</div>
              </div>
            ) : (
              dailyActivity.map(day => (
                <div key={day.date} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <button
                    onClick={() => {
                      const newSet = new Set(expandedDays);
                      if (newSet.has(day.date)) newSet.delete(day.date);
                      else newSet.add(day.date);
                      setExpandedDays(newSet);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    {expandedDays.has(day.date) ? <ChevronDown size={12} color="#9CA3AF" /> : <ChevronRight size={12} color="#9CA3AF" />}
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1E3A5F' }}>
                        {new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span style={{ fontSize: 11, color: '#6B7280' }}>
                        <span style={{ fontWeight: 600, color: '#1E3A5F' }}>{day.visits_that_day}</span> visits
                      </span>
                      <span style={{ fontSize: 11, color: '#6B7280' }}>
                        <span style={{ fontWeight: 600, color: '#1E3A5F' }}>{day.shops_that_day}</span> shops
                      </span>
                    </div>
                  </button>
                  {expandedDays.has(day.date) && (
                    <div style={{ padding: '0 10px 8px 30px' }}>
                      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#6B7280' }}>
                        <span>Start: <strong style={{ color: '#1E3A5F' }}>{day.day_start ? formatTime(day.date + 'T' + day.day_start) : '—'}</strong></span>
                        <span>End: <strong style={{ color: '#1E3A5F' }}>{day.day_end ? formatTime(day.date + 'T' + day.day_end) : '—'}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        ) : (
          /* FIX 3: Routes tab — Most / All / Least sections */
          <>
            {repRoutes.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🗺️</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>No routes found for this rep</div>
              </div>
            ) : (
              <>
                {/* Section 1: Most Visited Routes */}
                <div style={{ padding: '6px 10px 4px', background: '#FFFBEB', borderBottom: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Trophy size={12} color="#92400E" />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Most Visited Routes
                  </span>
                </div>
                {topRoutes.map(route => (
                  <RouteRow key={route.route_id} route={route} barColor="#C9963E" />
                ))}

                {/* Section 2: All Routes (collapsible) — only shown if there are middle routes */}
                {middleRoutes.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowAllRoutes(v => !v)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        background: '#F9FAFB',
                        border: 'none',
                        borderTop: '1px solid rgba(0,0,0,0.06)',
                        borderBottom: '1px solid rgba(0,0,0,0.06)',
                        color: '#1565C0',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>Show all {routeTotal} routes</span>
                      {showAllRoutes ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {showAllRoutes && middleRoutes.map(route => (
                      <RouteRow key={route.route_id} route={route} barColor="#1565C0" />
                    ))}
                  </>
                )}

                {/* Section 3: Least Visited Routes */}
                {leastRoutes.length > 0 && (
                  <>
                    <div style={{ padding: '6px 10px 4px', background: '#FFF7ED', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid #FED7AA', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <AlertTriangle size={12} color="#C2410C" />
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Least Visited Routes — Need Attention
                      </span>
                    </div>
                    {leastRoutes.map(route => (
                      <RouteRow key={route.route_id} route={route} barColor="#EF4444" />
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
        <button
          onClick={handleDownload}
          disabled={csvLoading}
          style={{
            width: '100%',
            padding: '7px',
            background: csvLoading ? '#F3F4F6' : '#EFF6FF',
            border: `1px solid ${csvLoading ? '#E5E7EB' : '#BFDBFE'}`,
            borderRadius: 6,
            color: csvLoading ? '#9CA3AF' : '#1565C0',
            fontSize: 11,
            fontWeight: 600,
            cursor: csvLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Download size={12} />
          {csvLoading ? 'Preparing CSV…' : 'Download CSV (All Records)'}
        </button>
      </div>
    </div>
  );
}
