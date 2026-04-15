import React, { useState, useEffect, useMemo } from 'react';
import { X, Download, MapPin, ChevronDown, ChevronRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useMapData } from '../hooks/useMapData';
import type { TTMSummary, DailyActivity, ShopVisitRow, RouteSummary } from '../types';
import { TIER_COLOURS, GROUP_COLOURS } from '../types';

interface RepActivityPanelProps {
  repName: string;
  repData: TTMSummary | null;
  routeSummary: RouteSummary[];
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

export default function RepActivityPanel({ repName, repData, routeSummary, onClose }: RepActivityPanelProps) {
  const { setFilters } = useAppContext();
  const { fetchRepDailyActivity, fetchRepShopVisits } = useMapData();

  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [shopVisits, setShopVisits] = useState<ShopVisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('shops');
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // repData comes from ttm_summary — same source as leaderboard and map markers
  const groupColor = GROUP_COLOURS[repData?.role || ''] || '#6B7280';

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchRepDailyActivity(repName),
      fetchRepShopVisits(repName),
    ]).then(([daily, shops]) => {
      setDailyActivity(daily);
      setShopVisits(shops);
      setLoading(false);
    }).catch(err => {
      console.error('RepActivityPanel load error:', err);
      setLoading(false);
    });
  }, [repName, fetchRepDailyActivity, fetchRepShopVisits]);

  const repRoutes = useMemo(() =>
    routeSummary.filter(r => r.rep_name === repName),
    [routeSummary, repName]
  );

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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const downloadCSV = () => {
    const headers = ['Shop Name', 'Tier', 'Category', 'Region', 'Visit Date', 'Time', 'Duration (min)', 'Visit Count'];
    const rows = filteredShops.map(s => [
      `"${s.shop_name}"`,
      s.tier || '',
      s.cat || '',
      s.region,
      formatDate(s.check_in),
      formatTime(s.check_in),
      s.duration || '',
      s.visit_count,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${repName.replace(/\s+/g, '_')}_visits.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        {/* Color bar matching group */}
        <div style={{ height: 3, background: groupColor, borderRadius: 2, marginBottom: 10 }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1E3A5F' }}>{repName}</div>
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

        {/* Stats — sourced from ttm_summary, same as leaderboard */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 10 }}>
          {[
            { label: 'Visits', value: repData?.total_visits?.toLocaleString() ?? '—' },
            { label: 'Shops', value: repData?.unique_shops?.toLocaleString() ?? '—' },
            { label: 'Coverage', value: repData?.coverage_pct != null ? `${repData.coverage_pct.toFixed(1)}%` : '—' },
            { label: 'V/Day', value: repData?.visits_per_day != null ? repData.visits_per_day.toFixed(1) : '—' },
          ].map(stat => (
            <div key={stat.label} style={{
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

        {/* Secondary stats row */}
        {repData && (
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <span style={{ fontSize: 10, color: '#6B7280' }}>
              <span style={{ fontWeight: 600, color: '#1E3A5F' }}>{repData.field_days}</span> field days
            </span>
            <span style={{ fontSize: 10, color: '#6B7280' }}>
              <span style={{ fontWeight: 600, color: '#1E3A5F' }}>{repData.avg_duration?.toFixed(0)}</span> min avg visit
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
            {v === 'shops' ? `Shops (${filteredShops.length})` : v === 'days' ? `Days (${dailyActivity.length})` : `Routes (${repRoutes.length})`}
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
            {/* Table header */}
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

            {filteredShops.slice(0, 200).map((shop, i) => (
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
          </>
        ) : viewMode === 'days' ? (
          <>
            {dailyActivity.map(day => (
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
            ))}
          </>
        ) : (
          <>
            {repRoutes.map(route => (
              <div
                key={route.route_id}
                onClick={() => setFilters(prev => ({ ...prev, route: route.route_id }))}
                style={{
                  padding: '8px 10px',
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 3, height: 20, background: '#1565C0', borderRadius: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1E3A5F' }}>{route.route_name}</div>
                  <div style={{ fontSize: 10, color: '#6B7280' }}>{route.visits} visits · {route.shops} shops · {route.primary_region}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
        <button
          onClick={downloadCSV}
          style={{
            width: '100%',
            padding: '7px',
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: 6,
            color: '#1565C0',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Download size={12} />
          Download CSV
        </button>
      </div>
    </div>
  );
}
