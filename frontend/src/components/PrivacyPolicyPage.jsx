import { Link } from 'react-router-dom';

// Public, unauthenticated page. App Store Connect requires a reachable privacy
// policy URL; this route is also linked from the login footer and Settings.
// Keep the content in sync with what the app actually does — no boilerplate
// claims about data we don't touch.

const EFFECTIVE_DATE = '30 August 2026';
const CONTACT_EMAIL = 'info@zetoson.com';

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text-1)' }}>{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="btn-gold w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="font-semibold" style={{ color: 'var(--text-1)' }}>Trading Sync</span>
        </div>

        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-1)' }}>Privacy Policy</h1>
        <p className="text-xs mb-8" style={{ color: 'var(--text-3)' }}>Effective {EFFECTIVE_DATE}</p>

        <Section title="Who we are">
          <p>
            Trading Sync is operated by Tsvetan Tsvetkov (ZETOSON), Spain. It is a personal
            portfolio tracker: you add your investment accounts by hand or by uploading
            screenshots of your broker, bank, P2P-lending or crypto apps, and Trading Sync
            consolidates them into one view.
          </p>
        </Section>

        <Section title="What we collect">
          <p><strong style={{ color: 'var(--text-1)' }}>Account data.</strong> Your email address, a hashed password (bcrypt — we never store or see the plain password), and an optional display name.</p>
          <p><strong style={{ color: 'var(--text-1)' }}>Portfolio data you enter.</strong> The platforms, balances, holdings, interest rates, deposits and notes you add. This can reveal your financial situation — it exists in the app only because you put it there, and it is visible only to your account.</p>
          <p><strong style={{ color: 'var(--text-1)' }}>Screenshots you upload.</strong> Images you choose to import are stored on our server and processed once by an AI model to extract balances and holdings (see “Processors” below).</p>
          <p><strong style={{ color: 'var(--text-1)' }}>A session cookie.</strong> One httpOnly authentication cookie keeps you signed in. We use no analytics, no advertising trackers, and no fingerprinting.</p>
        </Section>

        <Section title="What we do NOT collect">
          <p>
            No broker credentials, no bank logins, no API keys, no open-banking permissions.
            Trading Sync never connects to your broker — a screenshot reveals only what is on
            the screen, which is the point. We do not sell or share your data with advertisers,
            and there is no tracking across other apps or websites. Face ID / Touch ID, if you
            enable the app lock, is handled entirely by your device — biometric data never
            reaches our servers.
          </p>
        </Section>

        <Section title="Processors we rely on">
          <p><strong style={{ color: 'var(--text-1)' }}>OpenAI</strong> — uploaded screenshots are sent to OpenAI’s API once, to extract the numbers on them. They are not used to train models under OpenAI’s API terms.</p>
          <p><strong style={{ color: 'var(--text-1)' }}>Railway</strong> — hosts the application and its database (data encrypted in transit via HTTPS).</p>
          <p><strong style={{ color: 'var(--text-1)' }}>Resend</strong> — delivers transactional emails only (verification, password reset). No marketing email.</p>
          <p><strong style={{ color: 'var(--text-1)' }}>Market data providers</strong> (Stooq, CoinGecko, exchange-rate services) — receive only ticker symbols to fetch prices, never anything about you.</p>
        </Section>

        <Section title="AI portfolio assistant (Premium)">
          <p>
            If you use the assistant, your questions and a compact summary of your portfolio
            (account names, balances, largest holdings) are sent to OpenAI’s API to generate
            the answer, under the same API terms as screenshot processing (not used to train
            models). The assistant provides <strong style={{ color: 'var(--text-1)' }}>educational
            information only</strong>: it is not investment advice, not a personal recommendation
            within the meaning of MiFID II, and no output should be relied upon as a basis for
            investment decisions. Trading Sync is not a licensed investment adviser.
          </p>
        </Section>

        <Section title="Retention and deletion">
          <p>
            Your data is kept for as long as your account exists. You can delete your account
            at any time in <em>Settings → Danger Zone</em>: this permanently removes your login,
            every account, all holdings and history, and every uploaded screenshot file. There
            is no recovery. No copy is retained beyond standard short-lived infrastructure
            backups, which expire automatically.
          </p>
        </Section>

        <Section title="Your rights (GDPR)">
          <p>
            You may access, correct, export or erase your data. Everything you have entered is
            visible and editable in the app itself, and erasure is self-service (above). For
            anything else — including a portability export or a complaint — email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent)' }}>{CONTACT_EMAIL}</a>.
            You also have the right to lodge a complaint with your supervisory authority
            (in Spain, the AEPD).
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If this policy changes materially, the effective date above will change and the
            app will say so. Continued use after a change means you accept the updated policy.
          </p>
        </Section>

        <div className="mt-10 pt-6 text-sm" style={{ borderTop: '1px solid var(--border)' }}>
          <Link to="/" style={{ color: 'var(--accent)' }}>← Back to Trading Sync</Link>
        </div>
      </div>
    </div>
  );
}
