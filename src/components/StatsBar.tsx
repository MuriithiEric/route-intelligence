import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Users, Store, Clock, Target, Globe } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { UserGroup, UserGroupRegion, RepProfile, TTMSummary, CustomerCategoryCounts } from '../types';

// Total active outlets across Kenya (including those without GPS coordinates)
// Used as the denominator for all coverage calculations — Fix 1B
const TOTAL_ACTIVE_OUTLETS = 86148;

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
    const totalOutlets = customerCounts?.total || 0;

    const computeWeightedAvg = (reps: typeof ttmSummary) => {
      const totalV = reps.reduce((s, r) => s + r.total_visits, 0);
      return totalV > 0 ? reps.reduce((s, r) => s + r.avg_duration * r.total_visits, 0) / totalV : 0;
    };

    // Coverage always uses 86,148 as denominator — Fix 1B
    const pct = (shops: number) => (shops / TOTAL_ACTIVE_OUTLETS) * 100;

    if (selectedRep) {
      const rep = ttmSummary.find(r => r.raw_name === selectedRep);
      const repShops = rep?.unique_shops || 0;
      return {
        customerUniverse: totalOutlets,
        shopsVisited: repShops,
        activeStaff: rep?.name || selectedRep,
        avgVisit: rep?.avg_duration || 0,
        nationalCoverage: pct(repShops),
        coverageLabel: 'INDIVIDUAL COVERAGE',
        coverageTooltip: `Percentage of all 86,148 active outlets this rep has visited`,
        coverageSubtitle: `${repShops.toLocaleString()} of ${TOTAL_ACTIVE_OUTLETS.toLocaleString()} outlets visited`,
        staffSubtitle: rep?.role || 'Selected rep',
      };
    }

    if (filters.region && filters.userGroup) {
      const regionData = userGroupRegions.find(
        r => r.category === filters.userGroup && r.region === filters.region
      );
      const groupReps = ttmSummary.filter(r => r.role === filters.userGroup);
      const shops = regionData?.unique_shops || 0;
      return {
        customerUniverse: totalOutlets,
        shopsVisited: shops,
        activeStaff: regionData?.unique_reps || 0,
        avgVisit: computeWeightedAvg(groupReps),
        nationalCoverage: pct(shops),
        coverageLabel: `${filters.userGroup} COVERAGE`,
        coverageTooltip: `Percentage of 86,148 active outlets visited by ${filters.userGroup} in ${filters.region}`,
        coverageSubtitle: `${shops.toLocaleString()} of ${TOTAL_ACTIVE_OUTLETS.toLocaleString()} outlets`,
        staffSubtitle: `${regionData?.unique_reps || 0} reps in ${filters.region}`,
      };
    }

    if (filters.userGroup) {
      const group = userGroups.find(g => g.category === filters.userGroup);
      const groupReps = ttmSummary.filter(r => r.role === filters.userGroup);
      const groupActiveReps = group?.active_rep_count || 0;
      const groupTotalReps = group?.active_users || 0;
      const groupInactiveReps = group?.inactive_rep_count || 0;
      let groupActiveStaff: number | string;
      if (repStatusFilter === 'active') {
        groupActiveStaff = groupActiveReps;
      } else if (repStatusFilter === 'inactive') {
        groupActiveStaff = groupInactiveReps;
      } else {
        groupActiveStaff = groupTotalReps > 0 ? `${groupActiveReps} Active / ${groupTotalReps} Total` : groupActiveReps;
      }
      const shops = group?.unique_shops || 0;
      return {
        customerUniverse: totalOutlets,
        shopsVisited: shops,
        activeStaff: groupActiveStaff,
        avgVisit: computeWeightedAvg(groupReps),
        nationalCoverage: pct(shops),
        coverageLabel: 'GROUP COVERAGE',
        coverageTooltip: `Percentage of 86,148 active outlets visited by ${filters.userGroup}`,
        coverageSubtitle: `${shops.toLocaleString()} of ${TOTAL_ACTIVE_OUTLETS.toLocaleString()} outlets`,
        staffSubtitle: `${groupActiveReps} active · ${groupInactiveReps} inactive`,
      };
    }

    // National — Fix 1A: COUNT(DISTINCT shop_id) FROM visits / 86,148
    const distinctShops = shopsVisited ?? 0;
    const nationalCoverage = pct(distinctShops);

    const totalActiveReps = userGroups.reduce((s, g) => s + (g.active_rep_count || 0), 0);
    const totalInactiveReps = userGroups.reduce((s, g) => s + (g.inactive_rep_count || 0), 0);
    const totalAllReps = userGroups.reduce((s, g) => s + (g.active_users || 0), 0);

    let activeStaff: number | string;
    if (repStatusFilter === 'active') {
      activeStaff = totalActiveReps;
    } else if (repStatusFilter === 'inactive') {
      activeStaff = totalInactiveReps;
    } else {
      activeStaff = `${totalActiveReps} Active / ${totalAllReps} Total`;
    }

    return {
      customerUniverse: totalOutlets,
      shopsVisited: distinctShops,
      activeStaff,
      avgVisit: computeWeightedAvg(ttmSummary),
      nationalCoverage,
      coverageLabel: 'NATIONAL COVERAGE',
      coverageTooltip: 'Percentage of all active outlets visited by at least one field rep',
      coverageSubtitle: shopsVisited != null
        ? `${distinctShops.toLocaleString()} of ${TOTAL_ACTIVE_OUTLETS.toLocaleString()} active outlets visited`
        : `of ${TOTAL_ACTIVE_OUTLETS.toLocaleString()} active outlets`,
      staffSubtitle: `${totalActiveReps} active · ${totalInactiveReps} inactive`,
    };
  }, [filters, selectedRep, userGroups, userGroupRegions, ttmSummary, repStatusFilter, customerCounts, shopsVisited]);

  const coverageColor = stats.nationalCoverage < 10
    ? '#C0392B'
    : stats.nationalCoverage < 25
    ? '#E07B39'
    : '#22C55E';

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
      subtitle: 'Active outlets with GPS coordinates',
      tooltip: 'Total active outlets with GPS coordinates in Kenya. Click to explore by region and tier.',
      clickable: true,
      onClick: () => setShowUniversePanel(true),
    },
    {
      bg: '#E8F5E9',
      icon: <Store size={16} color="#4CAF50" />,
      label: 'SHOPS VISITED',
      value: stats.shopsVisited,
      subtitle: 'Unique outlets visited',
      tooltip: 'COUNT(DISTINCT shop_id) FROM visits — unique outlets visited by at least one field rep',
    },
    {
      bg: '#E3F2FD',
      icon: <Users size={16} color="#2196F3" />,
      label: 'ACTIVE FIELD STAFF',
      value: stats.activeStaff,
      valueFontSize: typeof stats.activeStaff === 'string' && stats.activeStaff.includes('/') ? 11 : 15,
      subtitle: selectedRep ? (stats.staffSubtitle || '') : (stats.staffSubtitle || ''),
      tooltip: 'Total field reps / Active reps currently in the system',
    },
    {
      bg: '#F3E5F5',
      icon: <Clock size={16} color="#9C27B0" />,
      label: 'AVG VISIT',
      value: stats.avgVisit,
      suffix: ' min',
      subtitle: 'Average time per shop visit',
      tooltip: 'Average time spent per shop visit across all reps',
    },
    {
      bg: '#E8F5E9',
      icon: <Target size={16} color={coverageColor} />,
      label: coverageLabel,
      value: stats.nationalCoverage,
      suffix: '%',
      coverageValue: stats.nationalCoverage,
      subtitle: stats.coverageSubtitle,
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
                height: 54,
                width: 185,
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
                minWidth: card.subtitle ? 200 : 170,
                flexShrink: 0,
                minHeight: 46,
                cursor: card.clickable ? 'pointer' : 'default',
                transition: 'opacity 0.15s, box-shadow 0.15s',
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
                {card.subtitle && (
                  <div style={{ fontSize: 9, color: '#6B7280', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 185 }}>
                    {card.subtitle}
                  </div>
                )}
              </div>
            </div>
          ))}
    </div>
  );
}
