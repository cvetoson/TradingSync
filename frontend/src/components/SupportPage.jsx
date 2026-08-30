import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

// Public support page. Doubles as the App Store "support URL".
// Submissions are emailed to the operator (SUPPORT_EMAIL on the server).

export default function SupportPage() {
  const cached = (() => { try { return JSON.parse(localStorage.getItem('tradingsync_user') || 'null'); } catch { return null; } })();
  const [name, setName] = useState(cached?.displayName || '');
  const [email, setEmail] = useState(cached?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setState('sending');
    setError('');
    try {
      await axios.post('/api/support', { name, email, subject, message, website: '' });
      setState('sent');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send your message. Email support@8-sync.com instead.');
      setState('error');
    }
  };

  const field = 'w-full px-3 py-2.5 rounded-lg border text-sm';
  const fieldStyle = { background: 'var(--bg-inner)', borderColor: 'var(--border)', color: 'var(--text-1)' };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="btn-gold w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-white font-extrabold text-[17px] leading-none">8</span>
          </div>
          <span className="font-semibold" style={{ color: 'var(--text-1)' }}>8Sync</span>
        </div>

        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-1)' }}>Support</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-3)' }}>
          Questions, problems, ideas. We read everything and reply by email.
        </p>

        {state === 'sent' ? (
          <div className="rounded-lg border p-5" style={{ borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.06)' }}>
            <p className="text-sm font-semibold" style={{ color: '#10b981' }}>Message sent.</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>We will reply to {email} as soon as possible.</p>
            <Link to="/" className="inline-block mt-4 text-sm" style={{ color: 'var(--accent)' }}>← Back to 8Sync</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>Name (optional)</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={field} style={fieldStyle} maxLength={100} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} style={fieldStyle} maxLength={200} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>Subject (optional)</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={field} style={fieldStyle} maxLength={120} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>Message</label>
              <textarea required rows={6} value={message} onChange={(e) => setMessage(e.target.value)} className={field} style={fieldStyle} maxLength={5000}
                placeholder="What happened, what did you expect, which account or screen?" />
            </div>
            {/* honeypot: humans never see it, bots fill it */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" onChange={() => {}} />
            {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
            <button type="submit" disabled={state === 'sending'} className="btn-gold px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50">
              {state === 'sending' ? 'Sending…' : 'Send message'}
            </button>
          </form>
        )}

        <p className="text-xs mt-8" style={{ color: 'var(--text-4)' }}>
          Prefer email? Write to <a href="mailto:support@8-sync.com" style={{ color: 'var(--accent)' }}>support@8-sync.com</a>.
          {' '}<Link to="/privacy" style={{ color: 'var(--text-3)' }}>Privacy policy</Link>
        </p>
      </div>
    </div>
  );
}
