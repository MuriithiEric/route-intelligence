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

function StatusPill({ status }: { status?: string }) {
  const isActive = status !== 'Inactive';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      padding: '1px 5px',
      borderRadius: 10,
      background: isActive ? '#DCFCE7' : '#F3F4F6',
      color: isActive ? '#16A34A' : '#6B7280',
      fontSize: 8,
      fontWeight: 700,
      letterSpacing: '0.04em',
      flexShrink: 0,
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
}

export default function LeaderboardPanel({
  ttmSummary,
  userGroupRegions,
  isVisible,
  onToggle,
  filterBarBottom,
}: LeaderboardPanelProps) {
  const { filters, setSelectedRep, selectedRep, repStatusFilter, setRepStatusFilter } = useAppContext();
  const [tab, setTab] = useState<Tab>('visits');

  const baseReps = useMemo(() => {
    let reps = [...ttmSummary];
    if (filters.userGroup) {
      reps = reps.filter(r => r.role === filters.userGroup);
    }
    return reps;
  }, [ttmSummary, filters.userGroup]);

  const activeCount = useMemo(() =>
    baseReps.filter(r => r.rep_status !== 'Inactive').length,
    [baseReps]
  );

  const inactiveCount = useMemo(() =>
    baseReps.filter(r => r.rep_status === 'Inactive').length,
    [baseReps]
  );

  const filteredReps = useMemo(() => {
    let reps = [...baseReps];
    if (repStatusFilter === 'active') {
      reps = reps.filter(r => r.rep_status !== 'Inactive');
    } else if (repStatusFilter === 'inactive') {
      reps = reps.filter(r => r.rep_status === 'Inactive');
    }

    const sortFn = (a: TTMSummary, b: TTMSummary) => {
      switch (tab) {
        case 'visits': return b.total_visits - a.total_visits;
        case 'shops': return b.unique_shops - a.unique_shops;
        case 'coverage': return b.coverage_pct - a.coverage_pct;
        case 'visits_day': return b.visits_per_day - a.visits_per_day;
      }
    };

    if (repStatusFilter === 'all') {
      const active = reps.filter(r => r.rep_status !== 'Inactive').sort(sortFn);
      const inactive = reps.filter(r => r.rep_status === 'Inactive').sort(sortFn);
      return [...active, ...inactive];
    }

    return reps.sort(sortFn);
  }, [baseReps, repStatusFilter, tab]);

  const metricValue = (rep: TTMSummary) => {
    switch (tab) {
      case 'visits': return rep.total_visits.toLocaleString();
      case 'shops': return rep.unique_shops.toLocaleString();
      case 'coverage': return `${rep.coverage_pct?.toFixed(1)}%`;
      case 'visits_day': return `${rep.visits_per_day?.toFixed(1)}/d`;
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

  const topActiveRep = filteredReps.find(r => r.rep_status !== 'Inactive') ?? filteredReps[0];

  const topPerformer = useMemo(() =>
    [...ttmSummary].sort((a, b) => b.total_visits - a.total_visits)[0],
    [ttmSummary]
  );

  const lowestRegion = useMemo(() =>
    [...userGroupRegions]
      .filter(r => r.coverage_pct > 0)
      .sort((a, b) => a.coverage_pct - b.coverage_pct)[0],
    [userGroupRegions]
  );

  const maxValue = filteredReps[0] ? repValue(filteredReps[0]) : 0;

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

      {/* Panel header + status filter */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            LEADERBOARD
          </span>
          <span style={{ fontSize: 10, color: '#6B7280' }}>
            <span style={{ color: '#16A34A', fontWeight: 600 }}>{activeCount} Active</span>
            {' · '}
            <span style={{ color: '#9CA3AF', fontWeight: 600 }}>{inactiveCount} Inactive</span>
          </span>
        </div>
        {/* Status filter toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'active', 'inactive'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setRepStatusFilter(opt)}
              style={{
                flex: 1,
                padding: '3px 0',
                borderRadius: 6,
                border: `1px solid ${repStatusFilter === opt ? '#1E3A5F' : 'rgba(0,0,0,0.08)'}`,
                background: repStatusFilter === opt ? '#1E3A5F' : 'transparent',
                color: repStatusFilter === opt ? '#FFFFFF' : '#6B7280',
                fontSize: 10,
                fontWeight: repStatusFilter === opt ? 700 : 400,
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
                textTransform: 'capitalize',
                transition: 'all 0.15s',
              }}
            >
              {opt === 'all' ? 'All' : opt === 'active' ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>
      </div>

      {/* CCO Summary */}
      <div style={{ padding: 10, borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          CCO SUMMARY
        </div>
        <div style={{ background: '#FFF8E7', borderRadius: 8, padding: '7px 8px', border: '1px solid #FDE68A' }}>
          <div style={{ fontSize: 9, color: '#92400E', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Performer</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1E3A5F', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {topPerformer?.name || '—'}
          </div>
          <div style={{ fontSize: 10, color: '#6B7280' }}>{topPerformer?.total_visits?.toLocaleString()} visits</div>
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
          const isInactive = rep.rep_status === 'Inactive';
          const isTop = i === 0 && !isInactive;
          const isSelected = selectedRep === rep.raw_name;
          const color = GROUP_COLOURS[rep.role] || '#6B7280';
          const pct = maxValue > 0 ? (repValue(rep) / maxValue) * 100 : 0;

          return (
            <div
              key={rep.id}
              onClick={() => setSelectedRep(isSelected ? null : rep.raw_name)}
              style={{
                padding: '7px 10px',
                borderBottom: '1px solid rgba(0,0,0,0.04)',
                borderLeft: isTop ? '3px solid #C9963E' : isSelected ? `3px solid ${color}` : '3px solid transparent',
                background: isSelected ? `${color}0D` : isTop ? '#FFFBF0' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.15s',
                opacity: isInactive && repStatusFilter === 'all' ? 0.4 : 1,
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
                  background: isInactive ? '#9CA3AF' : color,
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

                {/* Name + status + role + region */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#1E3A5F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                      {rep.name}
                    </span>
                    <StatusPill status={rep.rep_status} />
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
                  <div style={{ height: '100%', width: `${pct}%`, background: isTop ? '#C9963E' : (isInactive ? '#9CA3AF' : color), borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
