# Trading Sync — iOS App & Monetization Plan

_Created 2026-07-06 · Working rhythm: one 20–30 min session per day, driven with Claude (+ Xcode MCP for the native parts)_

## The goal

Ship Trading Sync as an iOS app with a freemium subscription, then market it on TikTok.
Target: TestFlight beta in ~4 weeks of sessions, App Store submission in ~6.

## What we're selling (positioning)

**"The tracker for everything your other tracker can't connect to."**

Differentiation vs getquin / Parqet / Delta / CoinStats:

1. **AI screenshot import** — competitors need broker API connections or manual entry.
   We ingest *any* platform from a screenshot: P2P lenders (Iuvo, Bondora, Monefit),
   bank deposits (Postbank, BBVA), physical gold (TAVEX), cold wallets (Ledger),
   plus normal brokers. The long tail no aggregator connects to.
2. **True multi-asset net worth** — stocks/ETF + P2P + deposits + metals + crypto in
   one allocation ring. P2P and deposits are almost entirely unserved.
3. **Privacy angle** — no broker credentials, no open-banking permissions, no API keys.
   A screenshot reveals only what's on the screen. Strong TikTok hook.
4. **Underserved markets** — Bulgarian/Eastern-European platforms nobody else covers.

Honest gaps (don't market against them): no auto-sync (screenshots are manual by design),
no realtime broker feeds, solo-dev support.

## Pricing

| Tier | Price | Contents |
|---|---|---|
| Free | €0 | 2 accounts, 3 AI imports/month |
| Premium monthly | €3.99/mo | unlimited accounts + AI imports, live prices, reports |
| Premium yearly | €29.99/yr | same, ~37% cheaper |
| Launch intro offer | €1.99/mo first 3 months | Apple intro-offer mechanism |

Why not €3.99 one-time: every AI import costs OpenAI money forever; one-time pricing
loses money on heavy users. Apple cut: 15% (Small Business Program — enroll after
first submission). Web checkout via Stripe can come later (outside Apple's cut).

**Research-backed adjustments** (see notes/market-research-report.md):
- Add a **14-day full-Premium trial** at signup — freemium alone converts ~2%,
  trials convert ~18% of starts; longer trials convert best.
- Push the **yearly plan** (annual retains 44% at 12 months vs 17% monthly).
- Consider a **lifetime tier ~€79–99** for the subscription-averse P2P crowd.
- First screenshot import must be flawless: ~30% of annual subs cancel in month 1.
- Positioning: multi-asset bundle + screenshot convenience — NOT "P2P tracking"
  (P2P Dash covers 71 P2P platforms for free via CSV); getquin already has AI
  import for stocks — our moat is breadth (P2P/deposits/gold/wallets) + privacy.
- Launch languages: English + Spanish metadata (US indexes Spanish-MX keywords),
  Bulgarian in-app only (no BG storefront locale); German later, deliberately.
- Marketing: faceless screen-recording demos are viable (expect 3–6 months to
  traction, 4–6 posts/week minimum); seed P2P communities first — they're asking
  for exactly this in public forums.

## Costs to expect

- Apple Developer Program: **$99/year** (start enrollment on Day 1 — approval takes days)
- RevenueCat: free below $2.5k/mo tracked revenue
- OpenAI + Railway: current running costs
- TikTok paid boost: optional €5–10/day once a clip shows traction

---

## The daily sessions

Each item ≈ one 20–30 min session. Order matters; check them off as we go.
"(you)" = only you can do it; everything else we pair on in Claude Code.

### Week 1 — Foundations & first run in Xcode
- [ ] **S1 (you):** Enroll in Apple Developer Program (developer.apple.com, $99). Install/update Xcode from the App Store while it processes.
- [x] **S2:** Add Capacitor to `frontend/` (`@capacitor/core`, `ios` platform), point it at the Railway API, commit.
- [x] **S3:** (done via Claude Code iOS Simulator panel instead of XcodeBuildMCP) Set up the Xcode MCP server in Claude Code (XcodeBuildMCP) so Claude can build/run the simulator directly. First launch of Trading Sync in the iOS Simulator.
- [x] **S4:** (CapacitorHttp native networking + dark status bar shipped; login verified against Railway. Remaining papercut: platform-detail sheet clipped on phone width) Fix WebView papercuts: safe-area insets (notch), cookie/auth check against Railway, viewport behavior.
- [x] **S5:** App icon + splash screen from the gold brand mark (generate all sizes).

### Week 2 — Feel native + Apple-required features
- [x] **S6:** Native photo picker / camera for screenshot upload (Capacitor Camera plugin) — replaces the file input on iOS.
- [x] **S7:** Face ID / Touch ID app lock (Capacitor plugin) — optional toggle in Settings.
- [x] **S8:** **Account deletion** (Apple requirement): backend endpoint (delete user + accounts + history + holdings) — we pair on this carefully.
- [x] **S9:** Account deletion UI in Settings with confirmation; verify end-to-end.
- [x] **S10:** Privacy policy page (static, served by the app) + data-safety answers drafted. (/privacy live on prod + in-app; notes/app-store-data-safety.md drafts the App Privacy questionnaire)

### Week 3 — Freemium model in the backend
- [ ] **S11:** `premium` entitlement on users table + middleware (`requirePremium`), free-tier limits (2 accounts, 3 AI imports/month) enforced server-side.
- [ ] **S12:** Usage counters + friendly limit responses (`"upgrade to add more"`), tests.
- [ ] **S13:** Paywall screen UI (dark/gold, lists premium benefits) shown on limit hits.
- [ ] **S14:** RevenueCat account + App Store Connect products (monthly €3.99, yearly €29.99, intro offer) — (you, with step-by-step guidance).
- [ ] **S15:** RevenueCat SDK in the app; purchase + restore flows wired to the paywall.

### Week 4 — Purchases end-to-end + beta
- [ ] **S16:** RevenueCat webhook → backend sets/unsets `premium`; sandbox purchase test.
- [ ] **S17:** Full sandbox pass: buy, restore, cancel, expire; edge cases.
- [ ] **S18:** TestFlight: archive, upload, invite family testers (Elena, ttsvetkov.bg…).
- [ ] **S19:** Fix the first round of TestFlight feedback.
- [ ] **S20:** App Store screenshots (the dark/gold dashboard demos well) + description + keywords (ASO pass).

### Week 5 — Submission
- [ ] **S21:** App Review prep: demo account, review notes, export compliance answers.
- [ ] **S22 (you):** Submit for review. While waiting: enroll in Small Business Program (15% cut).
- [ ] **S23–24:** Address review feedback (finance apps often get one rejection — normal; budget two sessions).

### Week 6 — Launch & TikTok
- [ ] **S25:** Launch checklist: intro offer live, Railway env sanity, analytics for conversion.
- [ ] **S26 (you):** TikTok account + first clip: 15s "screenshot your broker → watch AI build your portfolio" hook.
- [ ] **S27:** Content batch: 3–5 clips (net-worth ring reveal, P2P platforms nobody tracks, privacy angle "no broker login").
- [ ] **S28:** Post cadence 3–5×/week; put €5–10/day behind whatever catches. Iterate.

## Standing notes

- Keep shipping web fixes in parallel — the iOS app is the same codebase.
- Blocked on Apple? Skip ahead to backend/paywall sessions; nothing below Week 3 needs Apple.
- Related: [[tradingsync-prod-deploy-requirements]] (Railway env vars), notes/domain-transfer-zetoson.md (needed for `RESEND_FROM` before public launch — reset emails must work for all users **before** the app goes live).
