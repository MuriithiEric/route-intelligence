import React from 'react';
import { X, Download, MapPin } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { TTMSummary } from '../types';
import { GROUP_COLOURS } from '../types';

interface ComparePanelProps {
  ttmSummary: TTMSummary[];
}

interface MetricRow {
  label: string;
  getValue: (r: TTMSummary) => string | number;
  compare: (a: TTMSummary, b: TTMSummary) => 'a' | 'b' | 'tie';
}

function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null) return '—';
  if (digits > 0) return n.toFixed(digits);
  return n.toLocaleString();
}

const METRICS: MetricRow[] = [
  {
    label: 'Total Visits',
    getValue: r => fmt(r.total_visits),
    compare: (a, b) => a.total_visits > b.total_visits ? 'a' : b.total_visits > a.total_visits ? 'b' : 'tie',
  },
  {
    label: 'Unique Shops',
    getValue: r => fmt(r.unique_shops),
    compare: (a, b) => a.unique_shops > b.unique_shops ? 'a' : b.unique_shops > a.unique_shops ? 'b' : 'tie',
  },
  {
    label: 'Routes',
    getValue: r => fmt(r.unique_routes),
    compare: (a, b) => a.unique_routes > b.unique_routes ? 'a' : b.unique_routes > a.unique_routes ? 'b' : 'tie',
  },
  {
    label: 'Field Days',
    getValue: r => fmt(r.field_days),
    compare: (a, b) => a.field_days > b.field_days ? 'a' : b.field_days > a.field_days ? 'b' : 'tie',
  },
  {
    label: 'Visits / Day',
    getValue: r => fmt(r.visits_per_day, 1),
    compare: (a, b) => a.visits_per_day > b.visits_per_day ? 'a' : b.visits_per_day > a.visits_per_day ? 'b' : 'tie',
  },
  {
    label: 'Avg Visit (min)',
    getValue: r => fmt(r.avg_duration, 1),
    // Lower avg duration = more efficient = better
    compare: (a, b) => a.avg_duration < b.avg_duration ? 'a' : b.avg_duration < a.avg_duration ? 'b' : 'tie',
  },
  {
    label: 'Coverage %',
    getValue: r => `${fmt(r.coverage_pct, 2)}%`,
    compare: (a, b) => a.coverage_pct > b.coverage_pct ? 'a' : b.coverage_pct > a.coverage_pct ? 'b' : 'tie',
  },
  {
    label: 'Primary Region',
    getValue: r => r.primary_region || '—',
    compare: () => 'tie',
  },
  {
    label: 'Regions Covered',
    getValue: r => r.regions_covered || '—',
    compare: () => 'tie',
  },
  {
    label: 'Last Active',
    getValue: r => r.last_active
      ? new Date(r.last_active).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : '—',
    compare: (a, b) => {
      const da = new Date(a.last_active || 0).getTime();
      const db = new Date(b.last_active || 0).getTime();
      return da > db ? 'a' : db > da ? 'b' : 'tie';
    },
  },
];

export default function ComparePanel({ ttmSummary }: ComparePanelProps) {
  const { compareRep1, compareRep2, setCompareMode, setCompareRep1, setCompareRep2, setSelectedRep } = useAppContext();

  const rep1 = ttmSummary.find(r => r.raw_name === compareRep1) ?? null;
  const rep2 = ttmSummary.find(r => r.raw_name === compareRep2) ?? null;

  if (!rep1 && !rep2) return null;

  const close = () => {
    setCompareMode(false);
    setCompareRep1(null);
    setCompareRep2(null);
  };

  const viewOnMap = (rep: TTMSummary) => {
    close();
    setSelectedRep(rep.raw_name);
  };

  const downloadCSV = () => {
    if (!rep1 && !rep2) return;
    const headers = ['Metric', rep1?.name || 'Rep 1', rep2?.name || 'Rep 2'];
    const rows = METRICS.map(m => [
      m.label,
      rep1 ? String(m.getValue(rep1)) : '—',
      rep2 ? String(m.getValue(rep2)) : '—',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compare_${(rep1?.name || '').replace(/\s+/g, '_')}_vs_${(rep2?.name || '').replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const RepHeader = ({ rep, label, accentColor }: { rep: TTMSummary | null; label: string; accentColor: string }) => (
    <div style={{ flex: 1, padding: '12px 14px', borderLeft: rep === (rep1 || null) ? 'none' : '1px solid rgba(0,0,0,0.08)' }}>
      {rep ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rep.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <span style={{
              background: GROUP_COLOURS[rep.role] || '#6B7280',
              color: '#FFF',
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: 3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 100,
            }}>{rep.role}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              padding: '1px 5px', borderRadius: 8,
              background: rep.rep_status !== 'Inactive' ? '#DCFCE7' : '#F3F4F6',
              color: rep.rep_status !== 'Inactive' ? '#16A34A' : '#6B7280',
              fontSize: 8, fontWeight: 700,
            }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: rep.rep_status !== 'Inactive' ? '#16A34A' : '#9CA3AF', display: 'inline-block' }} />
              {rep.rep_status !== 'Inactive' ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3, fontSize: 10, color: '#6B7280' }}>
            <MapPin size={9} />
            {rep.primary_region}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>
          {label} — not selected
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1500,
        background: '#FFFFFF',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
        borderTop: '2px solid #1E3A5F',
        height: '60vh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      {/* Panel header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1E3A5F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          COMPARE REPS
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={downloadCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 6,
              border: '1px solid #BFDBFE', background: '#EFF6FF',
              color: '#1565C0', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            <Download size={11} />
            Download Comparison CSV
          </button>
          <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={16} color="#9CA3AF" />
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Rep headers */}
        <div style={{ width: 140, borderRight: '1px solid rgba(0,0,0,0.08)', flexShrink: 0, paddingTop: 8 }} />

        {/* Rep 1 header */}
        <div style={{ flex: 1, borderRight: '1px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 14px', borderBottom: '2px solid #C9963E', background: '#FFFBF0' }}>
            {rep1 ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F' }}>{rep1.name}</div>
                <div style={{ fontSize: 10, color: '#6B7280' }}>{rep1.role} · {rep1.primary_region}</div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>Rep 1 — not selected</div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {METRICS.map((m, i) => {
              if (!rep1 || !rep2) return (
                <div key={m.label} style={{ padding: '7px 14px', borderBottom: '1px solid rgba(0,0,0,0.04)', fontSize: 12, color: '#9CA3AF' }}>
                  {rep1 ? String(m.getValue(rep1)) : '—'}
                </div>
              );
              const winner = m.compare(rep1, rep2);
              return (
                <div key={m.label} style={{
                  padding: '7px 14px',
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
                  background: winner === 'a' ? '#FFFBF0' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                }}>
                  <span style={{ fontSize: 12, fontWeight: winner === 'a' ? 700 : 400, color: '#1E3A5F' }}>
                    {String(m.getValue(rep1))}
                  </span>
                  {winner === 'a' && <span title="Winner" style={{ fontSize: 13 }}>🏆</span>}
                </div>
              );
            })}
          </div>
          {rep1 && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
              <button
                onClick={() => viewOnMap(rep1)}
                style={{
                  width: '100%', padding: '6px', borderRadius: 6,
                  border: '1px solid #FDE68A', background: '#FFFBEB',
                  color: '#92400E', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                View Rep 1 on Map
              </button>
            </div>
          )}
        </div>

        {/* Metric labels (center column) */}
        <div style={{ width: 140, borderRight: '1px solid rgba(0,0,0,0.08)', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.08)', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Metric
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {METRICS.map(m => (
              <div key={m.label} style={{
                padding: '7px 12px',
                borderBottom: '1px solid rgba(0,0,0,0.04)',
                fontSize: 11,
                fontWeight: 600,
                color: '#6B7280',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Rep 2 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 14px', borderBottom: '2px solid #1565C0', background: '#EFF6FF' }}>
            {rep2 ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F' }}>{rep2.name}</div>
                <div style={{ fontSize: 10, color: '#6B7280' }}>{rep2.role} · {rep2.primary_region}</div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>Rep 2 — not selected</div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {METRICS.map((m) => {
              if (!rep1 || !rep2) return (
                <div key={m.label} style={{ padding: '7px 14px', borderBottom: '1px solid rgba(0,0,0,0.04)', fontSize: 12, color: '#9CA3AF' }}>
                  {rep2 ? String(m.getValue(rep2)) : '—'}
                </div>
              );
              const winner = m.compare(rep1, rep2);
              return (
                <div key={m.label} style={{
                  padding: '7px 14px',
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
                  background: winner === 'b' ? '#EFF6FF' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                }}>
                  {winner === 'b' && <span title="Winner" style={{ fontSize: 13 }}>🏆</span>}
                  <span style={{ fontSize: 12, fontWeight: winner === 'b' ? 700 : 400, color: '#1E3A5F', marginLeft: 'auto' }}>
                    {String(m.getValue(rep2))}
                  </span>
                </div>
              );
            })}
          </div>
          {rep2 && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
              <button
                onClick={() => viewOnMap(rep2)}
                style={{
                  width: '100%', padding: '6px', borderRadius: 6,
                  border: '1px solid #BFDBFE', background: '#EFF6FF',
                  color: '#1565C0', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                View Rep 2 on Map
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
