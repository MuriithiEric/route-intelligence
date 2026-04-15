import React, { useMemo } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { UserGroup } from '../types';

interface FilterBarProps {
  userGroups: UserGroup[];
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

export default function FilterBar({ userGroups }: FilterBarProps) {
  const { filters, setFilters } = useAppContext();

  const groupOptions = useMemo(() =>
    userGroups.map(g => ({
      value: g.category,
      label: `${g.category} — ${g.active_users} reps · ${g.coverage_pct?.toFixed(2)}%`,
    })), [userGroups]);

  // Dynamic date bounds
  const today = new Date().toISOString().split('T')[0];
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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

      <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />

      {/* Date Range */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>From</span>
        <input
          type="date"
          value={filters.dateFrom}
          min={oneYearAgo}
          max={filters.dateTo || today}
          onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
          style={{
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 6,
            padding: '3px 6px',
            fontSize: 11,
            color: '#1E3A5F',
            fontFamily: 'Inter, system-ui, sans-serif',
            height: 30,
            outline: 'none',
            background: '#F9FAFB',
          }}
        />
        <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>To</span>
        <input
          type="date"
          value={filters.dateTo}
          min={filters.dateFrom || oneYearAgo}
          max={today}
          onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
          style={{
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 6,
            padding: '3px 6px',
            fontSize: 11,
            color: '#1E3A5F',
            fontFamily: 'Inter, system-ui, sans-serif',
            height: 30,
            outline: 'none',
            background: '#F9FAFB',
          }}
        />
      </div>

      {/* Clear */}
      {filters.userGroup && (
        <>
          <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />
          <button
            onClick={() => setFilters(prev => ({ ...prev, userGroup: null, fieldStaff: null, route: null }))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 6,
              border: '1px solid #FCA5A5',
              background: '#FEF2F2',
              color: '#DC2626',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              flexShrink: 0,
            }}
          >
            <X size={10} />
            Clear
          </button>
        </>
      )}
    </div>
  );
}
