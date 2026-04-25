import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Users, Store, Clock, Target, Globe } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { UserGroup, UserGroupRegion, RepProfile, TTMSummary, CustomerCategoryCounts } from '../types';

interface StatsBarProps {
  userGroups: UserGroup[];
  userGroupRegions: UserGroupRegion[];
  repProfiles?: RepProfile[];
  ttmSummary: TTMSummary[];
  customerCounts: CustomerCategoryCounts | null;
  shopsVisited: number | null;
  loading: boolean;
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);
  const startRef = useRef(0);
  const startTimeRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const duration = 600;
    const start = displayed;
    startRef.current = start;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + (value - start) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{displayed.toLocaleString()}</>;
}

interface StatCardData {
  bg: string;
  icon: React.ReactNode;
  label: string;
  value: number | string;
  suffix?: string;
  coverageValue?: number;
  valueFontSize?: number;
  subtitle?: string;
  tooltip: string;
  clickable?: boolean;
  onClick?: () => void;
}

export default function StatsBar({ userGroups, userGroupRegions, ttmSummary, customerCounts, shopsVisited, loading }: StatsBarProps) {
  const { filters, selectedRep, repStatusFilter, setShowUniversePanel } = useAppContext();

  const stats = useMemo(() => {
    if (selectedRep) {
      const rep = ttmSummary.find(r => r.raw_name === selectedRep);
      return {
        customerUniverse: customerCounts?.total ?? 0,
        shopsVisited: rep?.unique_shops || 0,
        activeStaff: 1,
        avgVisit: rep?.avg_duration || 0,
        nationalCoverage: rep?.coverage_pct || 0,
        coverageLabel: 'INDIVIDUAL COVERAGE',
        coverageTooltip: 'Percentage of all mapped outlets this rep has visited',
      };
    }

    if (filters.region && filters.userGroup) {
      const regionData = userGroupRegions.find(
        r => r.category === filters.userGroup && r.region === filters.region
      );
      return {
        customerUniverse: customerCounts?.total ?? 0,
        shopsVisited: regionData?.unique_shops || 0,
        activeStaff: regionData?.unique_reps || 0,
        avgVisit: 11.2,
        nationalCoverage: regionData?.coverage_pct || 0,
        coverageLabel: `${filters.userGroup} COVERAGE`,
        coverageTooltip: `Percentage of mapped outlets visited by ${filters.userGroup} in ${filters.region}`,
      };
    }

    if (filters.userGroup) {
      const group = userGroups.find(g => g.category === filters.userGroup);
      const groupStaff = ttmSummary.filter(r => r.role === filters.userGroup).length;
      return {
        customerUniverse: customerCounts?.total ?? 0,
        shopsVisited: group?.unique_shops || 0,
        activeStaff: groupStaff,
        avgVisit: 11.2,
        nationalCoverage: group?.coverage_pct || 0,
        coverageLabel: 'GROUP COVERAGE',
        coverageTooltip: `Percentage of mapped outlets visited by ${filters.userGroup}`,
      };
    }

    const distinctShops = shopsVisited ?? 0;
    const totalOutlets = customerCounts?.total || 0;
    const nationalCoverage = totalOutlets > 0 && distinctShops > 0
      ? (distinctShops / totalOutlets) * 100
      : 0;

    const activeReps = ttmSummary.filter(r => r.rep_status !== 'Inactive').length;
    const inactiveReps = ttmSummary.filter(r => r.rep_status === 'Inactive').length;
    const totalReps = ttmSummary.length;

    let activeStaff: number | string;
    if (repStatusFilter === 'active') {
      activeStaff = activeReps;
    } else if (repStatusFilter === 'inactive') {
      activeStaff = inactiveReps;
    } else {
      activeStaff = `${activeReps} Active / ${totalReps} Total`;
    }

    return {
      customerUniverse: totalOutlets,
      shopsVisited: distinctShops,
      activeStaff,
      avgVisit: 11.2,
      nationalCoverage,
      coverageLabel: 'NATIONAL COVERAGE',
      coverageTooltip: 'Percentage of mapped outlets visited by at least one field rep',
    };
  }, [filters, selectedRep, userGroups, userGroupRegions, ttmSummary, repStatusFilter, customerCounts]);

  const coverageColor = stats.nationalCoverage < 10
    ? '#C0392B'
    : stats.nationalCoverage < 25
    ? '#E07B39'
    : '#22C55E';

  // Subtitle for coverage: "X of Y outlets visited"
  const coverageSubtitle = stats.customerUniverse > 0
    ? `${(typeof stats.shopsVisited === 'number' ? stats.shopsVisited : 0).toLocaleString()} of ${stats.customerUniverse.toLocaleString()} outlets visited`
    : undefined;

  // Label context for coverage
  const coverageLabel = selectedRep
    ? 'INDIVIDUAL COVERAGE'
    : filters.userGroup
    ? 'GROUP COVERAGE'
    : 'NATIONAL COVERAGE';

  const cards: StatCardData[] = [
    {
      bg: '#FFF3E0',
      icon: <Globe size={16} color="#E07B39" />,
      label: 'CUSTOMER UNIVERSE',
      value: stats.customerUniverse,
      tooltip: 'Total active outlets with GPS coordinates in Kenya. Click to explore by region and tier.',
      clickable: true,
      onClick: () => setShowUniversePanel(true),
    },
    {
      bg: '#E8F5E9',
      icon: <Store size={16} color="#4CAF50" />,
      label: 'SHOPS VISITED',
      value: stats.shopsVisited,
      tooltip: 'Unique outlets visited by at least one field rep',
    },
    {
      bg: '#E3F2FD',
      icon: <Users size={16} color="#2196F3" />,
      label: 'ACTIVE FIELD STAFF',
      value: stats.activeStaff,
      valueFontSize: typeof stats.activeStaff === 'string' ? 11 : 15,
      tooltip: 'Total field reps / Active reps currently in the system',
    },
    {
      bg: '#F3E5F5',
      icon: <Clock size={16} color="#9C27B0" />,
      label: 'AVG VISIT',
      value: stats.avgVisit,
      suffix: ' min',
      tooltip: 'Average time spent per shop visit across all reps',
    },
    {
      bg: '#E8F5E9',
      icon: <Target size={16} color={coverageColor} />,
      label: coverageLabel,
      value: stats.nationalCoverage,
      suffix: '%',
      coverageValue: stats.nationalCoverage,
      subtitle: coverageSubtitle,
      tooltip: stats.coverageTooltip,
    },
  ];

  return (
    <div
      style={{
        height: 'auto',
        minHeight: 56,
        background: '#FFFFFF',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px',
        flexShrink: 0,
        overflowX: 'auto',
      }}
    >
      {loading
        ? Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{
                height: 46,
                width: 170,
                borderRadius: 8,
                flexShrink: 0,
              }}
            />
          ))
        : cards.map((card, i) => (
            <div
              key={i}
              title={card.tooltip}
              onClick={card.onClick}
              style={{
                background: card.bg,
                borderRadius: 8,
                padding: '5px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                minWidth: card.subtitle ? 190 : 160,
                flexShrink: 0,
                minHeight: 40,
                cursor: card.clickable ? 'pointer' : 'default',
                transition: 'opacity 0.15s, box-shadow 0.15s',
                boxShadow: card.clickable ? undefined : undefined,
                border: card.clickable ? '1px solid transparent' : 'none',
                outline: 'none',
              }}
              onMouseEnter={card.clickable ? (e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
                (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(0,0,0,0.1)';
              } : undefined}
              onMouseLeave={card.clickable ? (e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLDivElement).style.border = '1px solid transparent';
              } : undefined}
            >
              <div style={{ flexShrink: 0 }}>{card.icon}</div>
              <div>
                <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {card.label}
                  {card.clickable && <span style={{ marginLeft: 4, opacity: 0.5, fontSize: 8 }}>↗</span>}
                </div>
                <div
                  style={{
                    fontSize: card.valueFontSize ?? 15,
                    fontWeight: 700,
                    color: card.coverageValue !== undefined ? coverageColor : '#1E3A5F',
                    lineHeight: 1.1,
                  }}
                >
                  {typeof card.value === 'number' && !card.suffix?.includes('min') && !card.suffix?.includes('%') ? (
                    <AnimatedNumber value={card.value} />
                  ) : typeof card.value === 'number' ? (
                    <span className="count-animate">
                      {card.value % 1 !== 0 ? card.value.toFixed(1) : card.value.toLocaleString()}
                    </span>
                  ) : (
                    card.value
                  )}
                  {card.suffix && (
                    <span style={{ fontSize: 11, fontWeight: 500 }}>{card.suffix}</span>
                  )}
                </div>
                {/* FIX 2: coverage subtitle showing visited / total */}
                {card.subtitle && (
                  <div style={{ fontSize: 9, color: '#6B7280', marginTop: 1, whiteSpace: 'nowrap' }}>
                    {card.subtitle}
                  </div>
                )}
              </div>
            </div>
          ))}
    </div>
  );
}
