import React, { useState, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Search, X, GitCompare } from 'lucide-react';
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
  const {
    filters, setSelectedRep, selectedRep, repStatusFilter, setRepStatusFilter,
    compareMode, setCompareMode, compareRep1, setCompareRep1, compareRep2, setCompareRep2,
  } = useAppContext();
  const [tab, setTab] = useState<Tab>('visits');
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

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

    // FIX 6e: filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      reps = reps.filter(r => r.name.toLowerCase().includes(q));
    }

    const sortFn = (a: TTMSummary, b: TTMSummary) => {
      switch (tab) {
        case 'visits': return b.total_visits - a.total_visits;
        case 'shops': return b.unique_shops - a.unique_shops;
        case 'coverage': return b.coverage_pct - a.coverage_pct;
        case 'visits_day': return b.visits_per_day - a.visits_per_day;
      }
    };

    if (repStatusFilter === 'all' && !searchQuery.trim()) {
      const active = reps.filter(r => r.rep_status !== 'Inactive').sort(sortFn);
      const inactive = reps.filter(r => r.rep_status === 'Inactive').sort(sortFn);
      return [...active, ...inactive];
    }

    return reps.sort(sortFn);
  }, [baseReps, repStatusFilter, tab, searchQuery]);

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

  const maxValue = filteredReps[0] ? repValue(filteredReps[0]) : 0;

  // FIX 7: handle compare mode rep click
  const handleRepClick = (rep: TTMSummary) => {
    if (compareMode) {
      if (compareRep1 === rep.raw_name) {
        setCompareRep1(null);
      } else if (compareRep2 === rep.raw_name) {
        setCompareRep2(null);
      } else if (!compareRep1) {
        setCompareRep1(rep.raw_name);
      } else if (!compareRep2) {
        setCompareRep2(rep.raw_name);
      } else {
        // Both slots filled: replace rep2
        setCompareRep2(rep.raw_name);
      }
    } else {
      const isSelected = selectedRep === rep.raw_name;
      setSelectedRep(isSelected ? null : rep.raw_name);
    }
  };

  const toggleCompareMode = () => {
    if (compareMode) {
      setCompareMode(false);
      setCompareRep1(null);
      setCompareRep2(null);
    } else {
      setCompareMode(true);
      setSelectedRep(null);
    }
  };

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#6B7280' }}>
              <span style={{ color: '#16A34A', fontWeight: 600 }}>{activeCount} Active</span>
              {' · '}
              <span style={{ color: '#9CA3AF', fontWeight: 600 }}>{inactiveCount} Inactive</span>
            </span>
            {/* FIX 7: Compare button */}
            <button
              onClick={toggleCompareMode}
              title={compareMode ? 'Exit compare mode' : 'Compare 2 reps side by side'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 7px',
                borderRadius: 6,
                border: `1px solid ${compareMode ? '#1565C0' : 'rgba(0,0,0,0.1)'}`,
                background: compareMode ? '#EFF6FF' : 'transparent',
                color: compareMode ? '#1565C0' : '#6B7280',
                fontSize: 10,
                fontWeight: compareMode ? 700 : 400,
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'all 0.15s',
              }}
            >
              <GitCompare size={10} />
              {compareMode ? 'Exit' : 'Compare'}
            </button>
          </div>
        </div>

        {/* Compare mode: two-step wizard */}
        {compareMode && (() => {
          const step = !compareRep1 ? 1 : !compareRep2 ? 2 : 3;
          const rep1Name = compareRep1 ? ttmSummary.find(r => r.raw_name === compareRep1)?.name : null;
          const rep2Name = compareRep2 ? ttmSummary.find(r => r.raw_name === compareRep2)?.name : null;
          return (
            <div style={{ marginBottom: 6 }}>
              {/* Step indicator row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                marginBottom: 5, paddingLeft: 2,
              }}>
                {[1, 2].map(n => (
                  <React.Fragment key={n}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700,
                      background: step > n ? '#16A34A' : step === n ? (n === 1 ? '#C9963E' : '#1565C0') : '#E5E7EB',
                      color: step >= n ? '#FFF' : '#9CA3AF',
                      flexShrink: 0,
                      transition: 'background 0.2s',
                    }}>
                      {step > n ? '✓' : n}
                    </div>
                    {n === 1 && (
                      <div style={{
                        flex: 1, height: 2, borderRadius: 1,
                        background: step > 1 ? '#16A34A' : '#E5E7EB',
                        transition: 'background 0.2s',
                      }} />
                    )}
                  </React.Fragment>
                ))}
                <span style={{ fontSize: 9, color: '#6B7280', marginLeft: 4, fontWeight: 500 }}>
                  {step === 1 ? 'Select Rep 1' : step === 2 ? 'Now select Rep 2' : 'Both selected — comparison open'}
                </span>
              </div>

              {/* Slot pills */}
              <div style={{ display: 'flex', gap: 5 }}>
                {/* Slot 1 */}
                <div style={{
                  flex: 1, padding: '5px 8px', borderRadius: 6,
                  border: `1.5px solid ${compareRep1 ? '#C9963E' : step === 1 ? '#C9963E' : 'rgba(0,0,0,0.08)'}`,
                  background: compareRep1 ? '#FFFBF0' : step === 1 ? '#FFFBF0' : '#F9FAFB',
                  opacity: step > 1 || compareRep1 ? 1 : 1,
                }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#C9963E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Rep 1</div>
                  <div style={{ fontSize: 10, fontWeight: compareRep1 ? 600 : 400, color: compareRep1 ? '#1E3A5F' : '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rep1Name || (step === 1 ? '← tap a rep' : '—')}
                  </div>
                </div>

                {/* Slot 2 */}
                <div style={{
                  flex: 1, padding: '5px 8px', borderRadius: 6,
                  border: `1.5px solid ${compareRep2 ? '#1565C0' : step === 2 ? '#1565C0' : 'rgba(0,0,0,0.08)'}`,
                  background: compareRep2 ? '#EFF6FF' : step === 2 ? '#EFF6FF' : '#F9FAFB',
                  opacity: step < 2 && !compareRep2 ? 0.5 : 1,
                  transition: 'opacity 0.2s',
                }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#1565C0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Rep 2</div>
                  <div style={{ fontSize: 10, fontWeight: compareRep2 ? 600 : 400, color: compareRep2 ? '#1E3A5F' : '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rep2Name || (step === 2 ? '← tap a rep' : '—')}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

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

      {/* FIX 6e: Search box */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={12} color="#9CA3AF" style={{ position: 'absolute', left: 8, pointerEvents: 'none' }} />
          <input
            ref={searchRef}
            id="leaderboard-search"
            type="text"
            placeholder="Search rep name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '5px 28px 5px 26px',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: 6,
              fontSize: 11,
              color: '#1E3A5F',
              background: '#F9FAFB',
              fontFamily: 'Inter, system-ui, sans-serif',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 6,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={10} color="#9CA3AF" />
            </button>
          )}
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
        {/* FIX 8g: no results message */}
        {filteredReps.length === 0 && searchQuery && (
          <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>🔍</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>
              No reps match &ldquo;{searchQuery}&rdquo;
            </div>
            <button
              onClick={() => setSearchQuery('')}
              style={{ fontSize: 11, color: '#1565C0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', textDecoration: 'underline' }}
            >
              Clear search
            </button>
          </div>
        )}

        {filteredReps.map((rep, i) => {
          const isInactive = rep.rep_status === 'Inactive';
          const isTop = i === 0 && !isInactive && !searchQuery;
          const isSelected = !compareMode && selectedRep === rep.raw_name;
          const isCompare1 = compareMode && compareRep1 === rep.raw_name;
          const isCompare2 = compareMode && compareRep2 === rep.raw_name;
          const color = GROUP_COLOURS[rep.role] || '#6B7280';
          const pct = maxValue > 0 ? (repValue(rep) / maxValue) * 100 : 0;

          let leftBorderColor = 'transparent';
          let bgColor = 'transparent';
          if (isTop) { leftBorderColor = '#C9963E'; bgColor = '#FFFBF0'; }
          if (isSelected) { leftBorderColor = color; bgColor = `${color}0D`; }
          if (isCompare1) { leftBorderColor = '#C9963E'; bgColor = '#FFFBF0'; }
          if (isCompare2) { leftBorderColor = '#1565C0'; bgColor = '#EFF6FF'; }

          return (
            <div
              key={rep.id}
              onClick={() => handleRepClick(rep)}
              style={{
                padding: '7px 10px',
                ...(isTop
                  ? {
                      border: '2px solid #C9963E',
                      borderRadius: 6,
                      margin: '4px 4px 2px',
                      boxShadow: '0 1px 6px rgba(201,150,62,0.25)',
                    }
                  : {
                      borderBottom: '1px solid rgba(0,0,0,0.04)',
                      borderLeft: `3px solid ${leftBorderColor}`,
                    }
                ),
                background: bgColor,
                cursor: 'pointer',
                transition: 'background 0.15s',
                opacity: isInactive && repStatusFilter === 'all' ? 0.4 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {/* Rank */}
                <span style={{ fontSize: 10, color: isTop ? '#C9963E' : '#9CA3AF', width: 16, textAlign: 'right', flexShrink: 0, fontWeight: isTop ? 700 : 400 }}>
                  {isTop ? '🏆' : i + 1}
                </span>

                {/* Avatar */}
                <div style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: isCompare1 ? '#C9963E' : isCompare2 ? '#1565C0' : isInactive ? '#9CA3AF' : color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: isCompare1 || isCompare2 ? 9 : 10,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {isCompare1 ? '①' : isCompare2 ? '②' : rep.name?.charAt(0) || '?'}
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
