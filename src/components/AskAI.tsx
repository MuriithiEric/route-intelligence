import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { TTMSummary, UserGroup, CustomerCategoryCounts } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_CHIPS = [
  'Which rep has lowest coverage?',
  'Who is the top performer?',
  'Which region needs attention?',
  'Show reps with under 50 shops visited',
];

interface AskAIProps {
  ttmSummary?: TTMSummary[];
  userGroups?: UserGroup[];
  customerCounts?: CustomerCategoryCounts | null;
}

function buildContext(
  filters: ReturnType<typeof useAppContext>['filters'],
  selectedRep: string | null,
  ttmSummary: TTMSummary[],
  userGroups: UserGroup[],
  customerCounts: CustomerCategoryCounts | null,
) {
  const lines: string[] = [];

  lines.push('You are a Kenya field operations analyst for BIDCO Route Intelligence. Answer questions using the real data below. Be concise and data-focused. When listing reps or rankings, use the actual numbers provided.');
  lines.push('');

  // Customer universe
  lines.push('## Customer Universe');
  if (customerCounts) {
    lines.push(`Total customers: ${customerCounts.total.toLocaleString()}`);
    lines.push(`Distributors: ${customerCounts.DISTRIBUTOR} | Key Accounts: ${customerCounts['KEY ACCOUNT']} | Hubs: ${customerCounts.HUB} | Stockists: ${customerCounts.STOCKIST} | Modern Trade: ${customerCounts['MODERN TRADE']} | General Trade: ${customerCounts['GENERAL TRADE']}`);
  }
  lines.push('');

  // User groups
  if (userGroups.length > 0) {
    lines.push('## User Groups');
    userGroups.forEach(g => {
      lines.push(`${g.category}: ${g.active_users} reps, ${g.total_visits.toLocaleString()} visits, ${g.unique_shops.toLocaleString()} shops, ${g.coverage_pct.toFixed(1)}% coverage`);
    });
    lines.push('');
  }

  // All rep performance
  if (ttmSummary.length > 0) {
    lines.push('## All Rep Performance (TTM)');
    const sorted = [...ttmSummary].sort((a, b) => b.total_visits - a.total_visits);
    sorted.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.name} (${r.role}, ${r.primary_region}): ${r.total_visits} visits, ${r.unique_shops} shops, ${r.unique_routes} routes, ${r.coverage_pct.toFixed(1)}% coverage, ${r.visits_per_day.toFixed(1)} v/day, ${r.field_days} field days, avg ${r.avg_duration.toFixed(0)} min/visit, last active ${r.last_active}`);
    });
    lines.push('');
  }

  // Current view context
  lines.push('## Current Dashboard State');
  if (selectedRep) {
    const rep = ttmSummary.find(r => r.raw_name === selectedRep);
    if (rep) {
      lines.push(`Selected rep: ${rep.name} (${rep.role}, ${rep.primary_region}) — ${rep.total_visits} visits, ${rep.unique_shops} shops, ${rep.coverage_pct.toFixed(1)}% coverage`);
    }
  } else if (filters.userGroup) {
    lines.push(`Filtered to user group: ${filters.userGroup}`);
  } else {
    lines.push('Viewing all field staff across Kenya.');
  }

  return lines.join('\n');
}

export default function AskAI({ ttmSummary = [], userGroups = [], customerCounts = null }: AskAIProps) {
  const { filters, selectedRep } = useAppContext();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [followUpChips, setFollowUpChips] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const contextMessage = buildContext(filters, selectedRep, ttmSummary, userGroups, customerCounts);

  const openingMessage = selectedRep
    ? `Viewing ${selectedRep}'s activity. Ask me about their route performance, shops visited, or coverage gaps.`
    : filters.userGroup
    ? `Filtered to ${filters.userGroup}. Ask me about their coverage, top performers, or route efficiency.`
    : 'Kenya Route Intelligence AI. Ask me about rep performance, coverage, or field operations.';

  const send = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setFollowUpChips([]);

    const history = [...messages, userMsg];

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: contextMessage,
          messages: history.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API error ${res.status}`);
      }

      const data = await res.json();
      const assistantText = data.content?.[0]?.text || 'No response.';
      setMessages(prev => [...prev, { role: 'assistant', content: assistantText }]);

      // Generate follow-up chips based on context
      setFollowUpChips([
        'Show me the top 5 reps',
        'Which region needs attention?',
        'Coverage trend this month?',
        'Suggest an action plan',
      ]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      const isOverloaded = errMsg.toLowerCase().includes('overload');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: isOverloaded
          ? 'The AI is temporarily busy — please try again in a moment.'
          : `Error: ${errMsg}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          data-tour="askai"
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 9999,
            background: '#1E3A5F',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 24,
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(30,58,95,0.3)',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(30,58,95,0.4)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(30,58,95,0.3)';
          }}
        >
          <Sparkles size={14} />
          Ask AI
        </button>
      )}

      {/* Modal */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)',
          }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            style={{
              width: 600,
              height: '70vh',
              background: '#FFFFFF',
              borderRadius: 16,
              boxShadow: '0 16px 64px rgba(0,0,0,0.16)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#1E3A5F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={14} color="#C9963E" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F' }}>Route Intelligence AI</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>Powered by Claude</div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={16} color="#9CA3AF" />
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Opening message */}
              {messages.length === 0 && (
                <div style={{ background: '#F0F4FF', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#1E3A5F', lineHeight: 1.5 }}>
                  {openingMessage}
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '80%',
                      background: msg.role === 'user' ? '#1E3A5F' : '#F9FAFB',
                      color: msg.role === 'user' ? '#FFFFFF' : '#1E3A5F',
                      borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      padding: '9px 12px',
                      fontSize: 13,
                      lineHeight: 1.5,
                      border: msg.role === 'assistant' ? '1px solid rgba(0,0,0,0.06)' : 'none',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '12px 12px 12px 2px', padding: '9px 14px', display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} className="skeleton" style={{ width: 6, height: 6, borderRadius: '50%', animationDelay: `${i * 0.2}s` }} />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick chips */}
            <div style={{ padding: '6px 16px', display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0 }}>
              {(followUpChips.length > 0 ? followUpChips : DEFAULT_CHIPS).map(chip => (
                <button
                  key={chip}
                  onClick={() => send(chip)}
                  style={{
                    padding: '4px 10px',
                    background: '#F0F4FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: 20,
                    color: '#1E3A5F',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Input */}
            <div style={{ padding: '8px 12px 12px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: 8, flexShrink: 0 }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder="Ask about routes, coverage, or performance..."
                style={{
                  flex: 1,
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  color: '#1E3A5F',
                }}
              />
              <button
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: loading || !input.trim() ? '#E5E7EB' : '#1E3A5F',
                  border: 'none',
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s',
                  flexShrink: 0,
                }}
              >
                <Send size={14} color={loading || !input.trim() ? '#9CA3AF' : '#FFFFFF'} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
