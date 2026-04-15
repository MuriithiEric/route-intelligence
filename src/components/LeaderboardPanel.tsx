import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { TTMSummary, UserGroupRegion } from '../types';
import { GROUP_COLOURS } from '../types';

interface LeaderboardPanelProps {
  ttmSummary: TTMSummary[];
  userGroupRegions: UserGroupRegion[];
  isVisible: boolean;
  onToggle: () => void;
  filterBarBottom: number;
}

type Tab = 'visits' | 'shops' | 'coverage' | 'visits_day';

export default function LeaderboardPanel({
  ttmSummary,
  userGroupRegions,
  isVisible,
  onToggle,
  filterBarBottom,
}: LeaderboardPanelProps) {
  const { filters, setSelectedRep, selectedRep } = useAppContext();
  const [tab, setTab] = useState<Tab>('visits');

  const filteredReps = useMemo(() => {
    let reps = [...ttmSummary];
    if (filters.userGroup) {
      reps = reps.filter(r => r.role === filters.userGroup);
    }
    switch (tab) {
      case 'visits': return reps.sort((a, b) => b.total_visits - a.total_visits);
      case 'shops': return reps.sort((a, b) => b.unique_shops - a.unique_shops);
      case 'coverage': return reps.sort((a, b) => b.coverage_pct - a.coverage_pct);
      case 'visits_day': return reps.sort((a, b) => b.visits_per_day - a.visits_per_day);
    }
  }, [ttmSummary, filters.userGroup, tab]);

  const metricValue = (rep: TTMSummary) => {
    switch (tab) {
      case 'visits': return rep.total_visits.toLocaleString();
      case 'shops': return rep.unique_shops.toLocaleString();
      case 'coverage': return `${rep.coverage_pct?.toFixed(1)}%`;
      case 'visits_day': return `${rep.visits_per_day?.toFixed(1)}/d`;
    }
  };

  const maxValue = (rep: TTMSummary) => {
    const max = filteredReps[0];
    if (!max) return 0;
    switch (tab) {
      case 'visits': return max.total_visits;
      case 'shops': return max.unique_shops;
      case 'coverage': return max.coverage_pct;
      case 'visits_day': return max.visits_per_day;
    }
  };

  const repValue = (rep: TTMSummary) => {
    switch (tab) {
      case 'visits': return rep.total_visits;
      case 'shops': return rep.unique_shops;
      case 'coverage': return rep.coverage_pct;
      case 'visits_day': return rep.visits_per_day;
    }
  };

  // CCO Summary data
  const topPerformer = useMemo(() =>
    [...ttmSummary].sort((a, b) => b.total_visits - a.total_visits)[0],
    [ttmSummary]
  );

  const lowestRegion = useMemo(() =>
    [...userGroupRegions].sort((a, b) => a.coverage_pct - b.coverage_pct)[0],
    [userGroupRegions]
  );

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: 'absolute',
          right: 0,
          top: filterBarBottom,
          bottom: 0,
          width: 36,
          background: '#FFFFFF',
          border: 'none',
          borderLeft: '1px solid rgba(0,0,0,0.08)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 900,
          boxShadow: '-2px 0 8px rgba(0,0,0,0.06)',
        }}
        title="Show Leaderboard"
      >
        <ChevronLeft size={16} color="#6B7280" />
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 320,
        background: '#FFFFFF',
        borderLeft: '1px solid rgba(0,0,0,0.08)',
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        style={{
          position: 'absolute',
          left: -18,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 18,
          height: 48,
          background: '#FFFFFF',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRight: 'none',
          borderRadius: '6px 0 0 6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 901,
          boxShadow: '-2px 0 6px rgba(0,0,0,0.06)',
        }}
        title="Hide Leaderboard"
      >
        <ChevronRight size={12} color="#6B7280" />
      </button>

      {/* CCO Summary */}
      <div style={{ padding: 10, borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          CCO SUMMARY
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {/* Top performer */}
          <div style={{ background: '#FFF8E7', borderRadius: 8, padding: '7px 8px', border: '1px solid #FDE68A' }}>
            <div style={{ fontSize: 9, color: '#92400E', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Performer</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1E3A5F', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {topPerformer?.name || '—'}
            </div>
            <div style={{ fontSize: 10, color: '#6B7280' }}>{topPerformer?.total_visits?.toLocaleString()} visits</div>
          </div>

          {/* Lowest coverage region */}
          <div style={{ background: '#FFF1F0', borderRadius: 8, padding: '7px 8px', border: '1px solid #FCA5A5' }}>
            <div style={{ fontSize: 9, color: '#991B1B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Low Coverage</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1E3A5F', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lowestRegion?.region || '—'}
            </div>
            <div style={{ fontSize: 10, color: '#C0392B', fontWeight: 600 }}>{lowestRegion?.coverage_pct?.toFixed(1)}% coverage</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
        {([['visits', 'Visits'], ['shops', 'Shops'], ['coverage', 'Coverage'], ['visits_day', 'V/Day']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              padding: '7px 4px',
              background: tab === key ? '#F0F4FF' : 'transparent',
              border: 'none',
              borderBottom: `2px solid ${tab === key ? '#1E3A5F' : 'transparent'}`,
              color: tab === key ? '#1E3A5F' : '#9CA3AF',
              fontSize: 10,
              fontWeight: tab === key ? 700 : 400,
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Rep list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredReps.map((rep, i) => {
          const isTop = i === 0;
          const isSelected = selectedRep === rep.name;
          const color = GROUP_COLOURS[rep.role] || '#6B7280';
          const max = maxValue(filteredReps[0]);
          const pct = max > 0 ? (repValue(rep) / max) * 100 : 0;

          return (
            <div
              key={rep.id}
              onClick={() => setSelectedRep(isSelected ? null : rep.name)}
              style={{
                padding: '7px 10px',
                borderBottom: '1px solid rgba(0,0,0,0.04)',
                borderLeft: isTop ? '3px solid #C9963E' : isSelected ? `3px solid ${color}` : '3px solid transparent',
                background: isSelected ? `${color}0D` : isTop ? '#FFFBF0' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {/* Rank */}
                <span style={{ fontSize: 10, color: '#9CA3AF', width: 16, textAlign: 'right', flexShrink: 0 }}>
                  {i + 1}
                </span>

                {/* Avatar */}
                <div style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {rep.name?.charAt(0) || '?'}
                </div>

                {/* Name + role + region */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#1E3A5F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rep.name}
                  </div>
                  <div style={{ fontSize: 9, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color, fontWeight: 500 }}>{rep.role}</span>
                    {' · '}
                    {rep.primary_region}
                  </div>
                </div>

                {/* Metric */}
                <div style={{ fontSize: 11, fontWeight: 700, color: isTop ? '#C9963E' : '#1E3A5F', flexShrink: 0 }}>
                  {metricValue(rep)}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginLeft: 49, marginTop: 3 }}>
                <div style={{ height: 3, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: isTop ? '#C9963E' : color, borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
