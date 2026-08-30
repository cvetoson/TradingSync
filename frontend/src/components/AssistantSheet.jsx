import { useEffect, useRef, useState } from 'react';
import { assistantChat } from '../services/api';
import useModalBehavior from '../hooks/useModalBehavior';

// Premium "Explain my portfolio" assistant. The 402 from the API opens the
// paywall via the global interceptor; this sheet just closes itself then.

const QUICK_PROMPTS = [
  'Explain my portfolio',
  'What are my biggest risks?',
  'How diversified am I?',
];

export default function AssistantSheet({ onClose }) {
  useModalBehavior(onClose);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    setError('');
    setInput('');
    const next = [...messages, { role: 'user', content: question }];
    setMessages(next);
    setBusy(true);
    try {
      const { reply } = await assistantChat(next);
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (err) {
      if (err.response?.status === 402) {
        onClose(); // the paywall is opening via the global interceptor
        return;
      }
      setError(err.response?.data?.error || 'The assistant is unavailable right now');
      setMessages(messages); // roll back the optimistic user turn
      setInput(question);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-stretch sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      {/* Phones: a true full-screen panel inside the safe areas (the floating 640px
          sheet overflowed the viewport and slid under the home indicator).
          sm+: the centered card. */}
      <div className="w-full h-full sm:h-[min(640px,90vh)] sm:max-w-md flex flex-col sm:rounded-xl sm:border shadow-2xl"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>

        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="btn-gold w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Portfolio assistant</p>
              <p className="text-[10px]" style={{ color: 'var(--text-4)' }}>Premium</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 -m-1 rounded-md text-dim hover:text-strong" title="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="pt-4">
              <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
                Ask anything about your own portfolio. It can see your accounts and holdings.
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button key={q} type="button" onClick={() => send(q)}
                    className="text-xs px-3 py-1.5 rounded-full border transition"
                    style={{ color: 'var(--accent)', borderColor: 'rgba(200,146,62,0.35)', background: 'rgba(200,146,62,0.06)' }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`max-w-[85%] text-sm rounded-xl px-3 py-2 whitespace-pre-wrap ${m.role === 'user' ? 'ml-auto' : ''}`}
              style={m.role === 'user'
                ? { background: 'rgba(200,146,62,0.14)', color: 'var(--text-1)' }
                : { background: 'var(--bg-inner)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              {m.content}
            </div>
          ))}
          {busy && <p className="text-xs" style={{ color: 'var(--text-4)' }}>Thinking…</p>}
          {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
          <div ref={endRef} />
        </div>

        <div className="px-4 pt-2 pb-3 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your portfolio…"
              className="flex-1 px-3 py-2.5 rounded-lg border text-sm field-dark"
              style={{ borderColor: 'var(--border)' }}
              maxLength={1000}
            />
            <button type="submit" disabled={busy || !input.trim()}
              className="btn-gold px-4 rounded-lg text-white text-sm font-semibold disabled:opacity-50">
              Send
            </button>
          </form>
          <p className="text-[10px] mt-2 leading-snug" style={{ color: 'var(--text-4)' }}>
            Educational information only. Not investment advice or a personal recommendation (MiFID II).
            Not a substitute for a licensed financial advisor.
          </p>
        </div>
      </div>
    </div>
  );
}
