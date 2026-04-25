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
  getValue: (r: TTMSummary) => string;
  // Returns 1 if a wins, -1 if b wins, 0 if tie or not comparable
  winner: (a: TTMSummary, b: TTMSummary) => 1 | -1 | 0;
}

function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null) return '—';
  return digits > 0 ? n.toFixed(digits) : n.toLocaleString();
}

const METRICS: MetricRow[] = [
  {
    label: 'Total Visits',
    getValue: r => fmt(r.total_visits),
    winner: (a, b) => a.total_visits > b.total_visits ? 1 : a.total_visits < b.total_visits ? -1 : 0,
  },
  {
    label: 'Unique Shops',
    getValue: r => fmt(r.unique_shops),
    winner: (a, b) => a.unique_shops > b.unique_shops ? 1 : a.unique_shops < b.unique_shops ? -1 : 0,
  },
  {
    label: 'Routes',
    getValue: r => fmt(r.unique_routes),
    winner: (a, b) => a.unique_routes > b.unique_routes ? 1 : a.unique_routes < b.unique_routes ? -1 : 0,
  },
  {
    label: 'Field Days',
    getValue: r => fmt(r.field_days),
    winner: (a, b) => a.field_days > b.field_days ? 1 : a.field_days < b.field_days ? -1 : 0,
  },
  {
    label: 'Visits / Day',
    getValue: r => fmt(r.visits_per_day, 1),
    winner: (a, b) => a.visits_per_day > b.visits_per_day ? 1 : a.visits_per_day < b.visits_per_day ? -1 : 0,
  },
  {
    label: 'Avg Visit (min)',
    getValue: r => fmt(r.avg_duration, 1),
    // Lower = more efficient = better
    winner: (a, b) => a.avg_duration < b.avg_duration ? 1 : a.avg_duration > b.avg_duration ? -1 : 0,
  },
  {
    label: 'Coverage %',
    getValue: r => `${fmt(r.coverage_pct, 2)}%`,
    winner: (a, b) => a.coverage_pct > b.coverage_pct ? 1 : a.coverage_pct < b.coverage_pct ? -1 : 0,
  },
  {
    label: 'Primary Region',
    getValue: r => r.primary_region || '—',
    winner: () => 0,
  },
  {
    label: 'Regions Covered',
    getValue: r => r.regions_covered || '—',
    winner: () => 0,
  },
  {
    label: 'Last Active',
    getValue: r => r.last_active
      ? new Date(r.last_active).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
      : '—',
    winner: (a, b) => {
      const da = new Date(a.last_active || 0).getTime();
      const db = new Date(b.last_active || 0).getTime();
      return da > db ? 1 : da < db ? -1 : 0;
    },
  },
];

function RepBadge({ rep, accentColor }: { rep: TTMSummary; accentColor: string }) {
  const groupColor = GROUP_COLOURS[rep.role] || '#6B7280';
  const isActive = rep.rep_status !== 'Inactive';
  return (
    <div style={{ padding: '10px 16px', borderBottom: `3px solid ${accentColor}`, background: accentColor === '#C9963E' ? '#FFFBF0' : '#EFF6FF', minHeight: 72 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {rep.name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
        <span style={{ background: groupColor, color: '#FFF', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3 }}>
          {rep.role}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          padding: '1px 5px', borderRadius: 8,
          background: isActive ? '#DCFCE7' : '#F3F4F6',
          color: isActive ? '#16A34A' : '#6B7280',
          fontSize: 8, fontWeight: 700,
        }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: isActive ? '#16A34A' : '#9CA3AF', display: 'inline-block' }} />
          {isActive ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, fontSize: 10, color: '#6B7280' }}>
        <MapPin size={9} />
        {rep.primary_region}
      </div>
    </div>
  );
}

export default function ComparePanel({ ttmSummary }: ComparePanelProps) {
  const { compareRep1, compareRep2, setCompareMode, setCompareRep1, setCompareRep2, setSelectedRep } = useAppContext();

  const rep1 = compareRep1 ? ttmSummary.find(r => r.raw_name === compareRep1) ?? null : null;
  const rep2 = compareRep2 ? ttmSummary.find(r => r.raw_name === compareRep2) ?? null : null;

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
    const headers = ['Metric', rep1?.name || 'Rep 1', rep2?.name || 'Rep 2'];
    const rows = METRICS.map(m => [
      m.label,
      rep1 ? m.getValue(rep1) : '—',
      rep2 ? m.getValue(rep2) : '—',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compare_${(rep1?.name || 'rep1').replace(/\s+/g, '_')}_vs_${(rep2?.name || 'rep2').replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Cell background for winner
  const winBg = (accentColor: string) => accentColor === '#C9963E' ? '#FFFBF0' : '#EFF6FF';

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
        borderTop: '3px solid #1E3A5F',
        height: '62vh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      {/* Header bar */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        background: '#F9FAFB',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#1E3A5F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Compare Reps
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={downloadCSV}
            disabled={!rep1 && !rep2}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 6,
              border: '1px solid #BFDBFE', background: '#EFF6FF',
              color: '#1565C0', fontSize: 10, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            <Download size={11} />
            Export CSV
          </button>
          <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={16} color="#9CA3AF" />
          </button>
        </div>
      </div>

      {/* Comparison table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {/* Metric header */}
              <th style={{
                width: 150, padding: '0', textAlign: 'left',
                verticalAlign: 'bottom', borderRight: '1px solid rgba(0,0,0,0.08)',
                position: 'sticky', top: 0, background: '#FFF', zIndex: 2,
              }}>
                <div style={{ padding: '8px 14px', fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                  Metric
                </div>
              </th>
              {/* Rep 1 */}
              <td style={{ padding: 0, borderRight: '1px solid rgba(0,0,0,0.08)', position: 'sticky', top: 0, background: '#FFF', zIndex: 2 }}>
                {rep1 ? <RepBadge rep={rep1} accentColor="#C9963E" /> : (
                  <div style={{ padding: '10px 16px', minHeight: 72, background: '#FFFBF0', borderBottom: '3px solid #C9963E', display: 'flex', alignItems: 'center', color: '#9CA3AF', fontSize: 11, fontStyle: 'italic' }}>
                    Select Rep 1 from leaderboard
                  </div>
                )}
              </td>
              {/* Rep 2 */}
              <td style={{ padding: 0, position: 'sticky', top: 0, background: '#FFF', zIndex: 2 }}>
                {rep2 ? <RepBadge rep={rep2} accentColor="#1565C0" /> : (
                  <div style={{ padding: '10px 16px', minHeight: 72, background: '#EFF6FF', borderBottom: '3px solid #1565C0', display: 'flex', alignItems: 'center', color: '#9CA3AF', fontSize: 11, fontStyle: 'italic' }}>
                    Select Rep 2 from leaderboard
                  </div>
                )}
              </td>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => {
              const w = rep1 && rep2 ? m.winner(rep1, rep2) : 0;
              // w = 1 means rep1 wins, w = -1 means rep2 wins
              return (
                <tr key={m.label} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <td style={{
                    padding: '9px 14px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#6B7280',
                    borderRight: '1px solid rgba(0,0,0,0.08)',
                    whiteSpace: 'nowrap',
                  }}>
                    {m.label}
                  </td>
                  {/* Rep 1 value */}
                  <td style={{
                    padding: '9px 16px',
                    background: w === 1 ? winBg('#C9963E') : 'transparent',
                    borderRight: '1px solid rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: w === 1 ? 700 : 400, color: '#1E3A5F' }}>
                        {rep1 ? m.getValue(rep1) : '—'}
                      </span>
                      {w === 1 && <span style={{ fontSize: 14, lineHeight: 1 }}>🏆</span>}
                    </div>
                  </td>
                  {/* Rep 2 value */}
                  <td style={{
                    padding: '9px 16px',
                    background: w === -1 ? winBg('#1565C0') : 'transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      {w === -1 && <span style={{ fontSize: 14, lineHeight: 1 }}>🏆</span>}
                      <span style={{ fontSize: 12, fontWeight: w === -1 ? 700 : 400, color: '#1E3A5F', marginLeft: 'auto' }}>
                        {rep2 ? m.getValue(rep2) : '—'}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Map buttons footer row */}
          <tfoot>
            <tr style={{ borderTop: '2px solid rgba(0,0,0,0.08)' }}>
              <td style={{ padding: '8px 14px', borderRight: '1px solid rgba(0,0,0,0.08)' }} />
              <td style={{ padding: '8px 16px', borderRight: '1px solid rgba(0,0,0,0.08)' }}>
                {rep1 && (
                  <button
                    onClick={() => viewOnMap(rep1)}
                    style={{
                      width: '100%', padding: '6px 0', borderRadius: 6,
                      border: '1px solid #FDE68A', background: '#FFFBEB',
                      color: '#92400E', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    View Rep 1 on Map
                  </button>
                )}
              </td>
              <td style={{ padding: '8px 16px' }}>
                {rep2 && (
                  <button
                    onClick={() => viewOnMap(rep2)}
                    style={{
                      width: '100%', padding: '6px 0', borderRadius: 6,
                      border: '1px solid #BFDBFE', background: '#EFF6FF',
                      color: '#1565C0', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    View Rep 2 on Map
                  </button>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
