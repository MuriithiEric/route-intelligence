import React from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { Customer, VisitFrequency } from '../types';
import { TIER_COLOURS } from '../types';

interface ShopPopupProps {
  customer: Customer;
  visitFrequency?: VisitFrequency | null;
  repName?: string;
  onClose: () => void;
}

export default function ShopPopup({ customer, visitFrequency, onClose }: ShopPopupProps) {
  const tierColor = TIER_COLOURS[customer.tier] || '#9E9E9E';

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // FIX 6c: "Last visited: 20 Jan 2026 · 3× total visits" format
  const lastVisitedLine = visitFrequency
    ? `Last visited: ${formatDate(visitFrequency.last_visit)} · ${visitFrequency.visit_count}× total visits`
    : customer.last_visit
    ? `Last visited: ${formatDate(customer.last_visit)}`
    : null;

  return (
    <div
      style={{
        width: 280,
        background: '#FFFFFF',
        borderRadius: 12,
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1E3A5F', lineHeight: 1.2 }}>
              {customer.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span
                style={{
                  background: `${tierColor}18`,
                  color: tierColor,
                  border: `1px solid ${tierColor}40`,
                  borderRadius: 4,
                  padding: '1px 6px',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                {customer.tier}
              </span>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{customer.cat}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, marginTop: -2 }}
          >
            <X size={16} color="#9CA3AF" />
          </button>
        </div>
      </div>

      {/* Details */}
      <div style={{ padding: '10px 14px' }}>
        {[
          { label: 'Region', value: customer.region },
          { label: 'Territory', value: customer.territory || '—' },
          { label: 'Channel', value: customer.channel },
          { label: 'Last Sale', value: formatDate(customer.last_sale) },
        ].map(row => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '3px 0',
              fontSize: 12,
            }}
          >
            <span style={{ color: '#6B7280' }}>{row.label}:</span>
            <span style={{ color: '#1E3A5F', fontWeight: 500, textAlign: 'right', maxWidth: 160 }}>
              {row.value}
            </span>
          </div>
        ))}

        {/* FIX 6c: last visited + visit count */}
        {lastVisitedLine && (
          <div style={{
            marginTop: 6,
            padding: '5px 8px',
            background: '#F0F9FF',
            borderRadius: 6,
            fontSize: 11,
            color: '#1565C0',
            fontWeight: 500,
          }}>
            {lastVisitedLine}
          </div>
        )}

        {visitFrequency && (
          <>
            <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '8px 0' }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1E3A5F', marginBottom: 4 }}>Visit History</div>
            {[
              { label: 'Total visits by this rep', value: `${visitFrequency.visit_count}×` },
              { label: 'First visit', value: formatDate(visitFrequency.first_visit) },
            ].map(row => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '2px 0',
                  fontSize: 11,
                }}
              >
                <span style={{ color: '#6B7280' }}>{row.label}:</span>
                <span style={{ color: '#1E3A5F', fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Actions */}
      <div
        style={{
          padding: '8px 14px',
          borderTop: '1px solid rgba(0,0,0,0.08)',
          display: 'flex',
          gap: 8,
        }}
      >
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${customer.lat},${customer.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: 6,
            color: '#1565C0',
            fontSize: 11,
            fontWeight: 500,
            textDecoration: 'none',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <ExternalLink size={11} />
          Open in Maps
        </a>
        <button
          onClick={onClose}
          style={{
            padding: '5px 12px',
            background: '#F9FAFB',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 6,
            color: '#6B7280',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
