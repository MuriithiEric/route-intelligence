import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Settings, Sparkles } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_CHIPS = [
  'Which rep has lowest coverage?',
  'Show Coast opportunity',
  'Most productive rep this month?',
  'Distributors never visited?',
];

function buildContext(filters: ReturnType<typeof useAppContext>['filters'], selectedRep: string | null) {
  const parts: string[] = ['You are a Kenya field operations analyst for BIDCO.'];
  if (selectedRep) parts.push(`Currently viewing rep: ${selectedRep}.`);
  if (filters.userGroup) parts.push(`User group filter: ${filters.userGroup}.`);
  if (filters.region) parts.push(`Region filter: ${filters.region}.`);
  parts.push('Answer questions about route intelligence, rep performance, and coverage gaps. Be concise and data-focused.');
  return parts.join(' ');
}

export default function AskAI() {
  const { filters, selectedRep } = useAppContext();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') || '');
  const [showSettings, setShowSettings] = useState(false);
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

  const contextMessage = buildContext(filters, selectedRep);

  const openingMessage = selectedRep
    ? `Viewing ${selectedRep}'s activity. Ask me about their route performance, shops visited, or coverage gaps.`
    : filters.userGroup
    ? `Filtered to ${filters.userGroup}. Ask me about their coverage, top performers, or route efficiency.`
    : 'Kenya Route Intelligence AI. Ask me about rep performance, coverage, or field operations.';

  const send = async (text: string) => {
    if (!text.trim()) return;
    if (!apiKey) {
      setShowSettings(true);
      return;
    }

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setFollowUpChips([]);

    const history = [...messages, userMsg];

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
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
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${errMsg}. Please check your API key in Settings.`,
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
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                  title="API Settings"
                >
                  <Settings size={14} color="#9CA3AF" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                >
                  <X size={16} color="#9CA3AF" />
                </button>
              </div>
            </div>

            {/* Settings panel */}
            {showSettings && (
              <div style={{ padding: '10px 16px', background: '#F9FAFB', borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#1E3A5F', marginBottom: 6 }}>Anthropic API Key</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="sk-ant-..."
                    style={{
                      flex: 1,
                      border: '1px solid rgba(0,0,0,0.12)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 12,
                      fontFamily: 'monospace',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => {
                      localStorage.setItem('anthropic_api_key', apiKey);
                      setShowSettings(false);
                    }}
                    style={{
                      padding: '6px 12px',
                      background: '#1E3A5F',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    Save
                  </button>
                </div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
                  Your key is stored locally in your browser only.
                </div>
              </div>
            )}

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
