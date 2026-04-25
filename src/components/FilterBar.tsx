import React, { useMemo } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { UserGroup, TTMSummary } from '../types';

interface FilterBarProps {
  userGroups: UserGroup[];
  ttmSummary: TTMSummary[];
}

function Select({
  label,
  value,
  options,
  onChange,
  onClear,
  placeholder,
}: {
  label: string;
  value: string | null;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string | null) => void;
  onClear?: () => void;
  placeholder?: string;
}) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', position: 'absolute', top: -8, left: 0, display: 'none' }}>
        {label}
      </div>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value || null)}
        style={{
          appearance: 'none',
          background: value ? '#EFF6FF' : '#F9FAFB',
          border: `1px solid ${value ? '#BFDBFE' : 'rgba(0,0,0,0.1)'}`,
          borderRadius: 6,
          padding: '0 28px 0 10px',
          height: 30,
          fontSize: 12,
          fontWeight: value ? 600 : 400,
          color: value ? '#1E3A5F' : '#6B7280',
          cursor: 'pointer',
          minWidth: 140,
          fontFamily: 'Inter, system-ui, sans-serif',
          outline: 'none',
        }}
      >
        <option value="">{placeholder || label}</option>
        {options.map((opt, i) => (
          <option key={`${opt.value}-${i}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} style={{ position: 'absolute', right: 8, color: '#9CA3AF', pointerEvents: 'none' }} />
      {value && onClear && (
        <button
          onClick={e => { e.stopPropagation(); onClear(); }}
          style={{
            position: 'absolute',
            right: 20,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={10} color="#9CA3AF" />
        </button>
      )}
    </div>
  );
}

export default function FilterBar({ userGroups, ttmSummary }: FilterBarProps) {
  const { filters, setFilters, selectedRep, setSelectedRep, clearFilters } = useAppContext();

  const repCountByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const rep of ttmSummary) {
      counts[rep.role] = (counts[rep.role] || 0) + 1;
    }
    return counts;
  }, [ttmSummary]);

  const groupOptions = useMemo(() =>
    userGroups.map(g => {
      const activeCount = g.active_rep_count;
      const inactiveCount = g.inactive_rep_count;
      const hasCounts = activeCount !== undefined && inactiveCount !== undefined;
      const label = hasCounts
        ? `${g.category} — ${activeCount} active · ${inactiveCount} inactive`
        : `${g.category} — ${repCountByGroup[g.category] ?? g.active_users} reps · ${g.coverage_pct?.toFixed(2)}%`;
      return { value: g.category, label };
    }), [userGroups, repCountByGroup]);

  // FIX 8e: show "Clear all filters" when any filter is active
  const anyFilterActive = !!(filters.userGroup || selectedRep);

  return (
    <div
      style={{
        height: 48,
        background: '#FFFFFF',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        zIndex: 997,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        flexShrink: 0,
        overflowX: 'auto',
      }}
    >
      {/* User Group */}
      <Select
        label="User Group"
        value={filters.userGroup}
        options={groupOptions}
        placeholder="All User Groups"
        onChange={v => setFilters(prev => ({ ...prev, userGroup: v, fieldStaff: null, route: null }))}
        onClear={() => setFilters(prev => ({ ...prev, userGroup: null, fieldStaff: null, route: null }))}
      />

      {/* Active rep indicator */}
      {selectedRep && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          borderRadius: 6,
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          fontSize: 11,
          color: '#1565C0',
          fontWeight: 500,
          flexShrink: 0,
        }}>
          <span>Rep: {ttmSummary.find(r => r.raw_name === selectedRep)?.name || selectedRep}</span>
          <button
            onClick={() => setSelectedRep(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
          >
            <X size={10} color="#9CA3AF" />
          </button>
        </div>
      )}

      {/* FIX 8e: Clear all filters pill */}
      {anyFilterActive && (
        <>
          <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />
          <button
            onClick={clearFilters}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 10px',
              borderRadius: 20,
              border: '1px solid #FCA5A5',
              background: '#FEF2F2',
              color: '#DC2626',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            <X size={10} />
            Clear all filters
          </button>
        </>
      )}
    </div>
  );
}
