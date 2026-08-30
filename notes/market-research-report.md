# Trading Sync — Market Positioning Research

_Synthesized 2026-07-06 from a deep-research run (~44 sources; claims below carry their source site). Verification pass was partial (session limits), so treat specific numbers as well-sourced but not triple-checked._

---

## 1. Positioning recommendation

**Target segment (beachhead):** European multi-asset investors whose wealth is scattered across platforms that API aggregators can't reach — P2P lenders, local banks, gold dealers, cold wallets — and who currently self-serve with spreadsheets.

**Message:** *"Your whole wealth in one ring — no broker logins, no CSV exports. Screenshot it."*

**Why this positioning survives contact with the evidence:**

- The P2P gap is real and *painful*: Portfolio Performance (the leading free EU tracker) has **no P2P asset class** — its forum shows users begging for workarounds from Feb 2024 through late 2025 [forum.portfolio-performance.info]. P2P investors share hand-built Excel templates on community forums [p2pindependentforum.com].
- **BUT the niche is not empty:** **P2P Dash** (free!) already covers **71 P2P platforms incl. Iuvo, Bondora, Monefit**, with XIRR, cash-drag and tax reports, via CSV upload — 10M+ transactions imported [p2pdash.com]. **Implication: do not sell "P2P tracking" — sell "everything including P2P, in one place, without the CSV export dance."** P2P Dash is P2P-only and CSV-based; the multi-asset + screenshot-convenience combination remains unoccupied.
- **getquin already ships "AI Import" for stocks/ETFs** (admitted gap: crypto, and by extension P2P/gold) [Trustpilot, Apr 2026 reply]. Screenshot-AI alone is not unique for equities — the moat is *breadth of what it works on*.
- The **privacy angle is validated by real user behavior**: getquin reviewers explicitly refuse to link broker credentials and call manual entry "defeats the purpose" [Trustpilot]; Capitally successfully charges €80–250/yr on a no-aggregator privacy pitch [mycapitally.com]. getquin's public-by-default social profiles are a recurring complaint.
- The incumbents' weak spot is **reliability + support**: getquin sits at **3.7/5 on Trustpilot**, dominated by broken broker syncs (XTB, Trading 212, DEGIRO), for which getquin disclaims responsibility. Screenshot import cannot "desync" — worth saying out loud in marketing.

## 2. Competitive map (2025–2026)

| Competitor | Price | Coverage | Exploitable weakness |
|---|---|---|---|
| getquin (500k+ users, DACH) | €4.99/mo · €49.99/yr | brokers via aggregators; AI import for stocks | 3.7/5 Trustpilot; broken syncs; no tax reports; no CSV import; freemium-erosion backlash; privacy complaints |
| Parqet | ~€5/mo | DACH brokers | weak outside Germany |
| Delta by eToro | $53.88–107.88/yr | 10k brokers, crypto | free tier 10 assets; no P2P/deposits/gold; manual entry pain |
| Snowball Analytics | $79.99–249.99/yr | broadest alt-asset (loans, deposits, metals) — manual | English-only, steep learning curve, expensive |
| Kubera | $249/yr (no free) | 20k banks, crypto/DeFi, metals | price; US-centric valuations; no EU P2P; no dividend analytics |
| Sharesight | $7–23.25/mo | listed securities, strong tax (AU/NZ/UK/CA/US) | no alternatives/liabilities |
| Capitally | €80–250/yr | statement upload, E2E encryption | no auto-sync, no real-time data, pricey |
| P2P Dash | **free** | 71 P2P platforms, CSV, XIRR, tax | P2P-only; CSV friction |
| Portfolio Performance | free OSS | everything *except* P2P | desktop-only complexity; the P2P hole |

**The open square:** multi-asset (brokers + P2P + deposits + gold + wallets) · credential-free · low-friction import (screenshot beats CSV) · under €50/yr · localized beyond English/German.

## 3. Feature roadmap additions (effort × impact for a solo dev)

Priority order, driven by what paying users of competitors actually complain about:

1. **Dividend tracking + calendar** (med effort / high impact) — the axis on which getquin beats Delta and Snowball's flagship feature; expected by the category's payers.
2. **XIRR / true return for P2P & deposits** (low-med / high for the beachhead) — the metric P2P Dash leads with and spreadsheet-builders compute by hand (exposure weighting, IRR after defaults, income projections).
3. **CSV/statement import** (med / high) — complements screenshots for the long-tail: P2P veterans hold ~200k-record, 10-year datasets no one will screenshot. getquin *has no CSV import* — a gift.
4. **Benchmarks + net-worth history chart** (low / med) — vs S&P 500/MSCI World; standard payer expectation.
5. **Custom FX rates / multi-currency accuracy** (low / med) — a named getquin complaint (duplicate portfolios per currency).
6. **Simple capital-gains summary** (med / med) — full country tax reports (German Steuerreport, Polish PIT-38) are the #1 DACH willingness-to-pay driver but are heavy and legally sensitive; ship a generic gains/income summary first, country reports later.
7. **Fixed free/premium boundary, published** — getquin generates real resentment by re-paywalling formerly free features (Nov 2025–Jan 2026 pattern). Commit publicly to the boundary.
8. **Responsive support as a feature** — solo dev answering in hours beats getquin's multi-day silence; reviewers notice.

## 4. Pricing recommendation

- **€3.99/mo undercuts every paid competitor** (getquin €4.99, Parqet ~€5, Snowball $9.99, Sharesight ~$12, Delta $13.99). €29.99/yr sits at the market's modal yearly price (~$30/median $34.80) [RevenueCat 2026, 115k apps]. The pricing is sound — cheapness alone won't convert, but it removes the objection vs getquin.
- **Add a free trial of Premium, don't rely on pure freemium.** The single strongest finding: freemium converts a **median 2.1–2.6% of downloads** vs **10.7–12.1% for paywall-first** apps; opt-in trials convert ~18% of starts [RevenueCat 2025/2026]. Longer trials win: 17–32-day trials convert ~42–46% vs ~25% for ≤4-day [Adapty/RevenueCat]. **Recommendation: keep the free tier (2 accounts / 3 AI imports·mo) *and* offer a 14-day full-Premium trial at signup.**
- **Push yearly hard:** annual plans retain 44.1% at 12 months vs 17.0% for monthly [RevenueCat]. But ~30% of annual subs cancel within the first month → the first screenshot import must succeed flawlessly (onboarding = revenue).
- **Consider a lifetime tier (~€79–99)** — ~25% of subscription apps offer one; the P2P/spreadsheet crowd is subscription-averse, and P2P Dash's free anchor makes "pay once, own it" psychologically attractive to exactly your beachhead.
- Reality check for paid ads: median revenue per install at day 60 is ~$0.31–0.55 → CPI must stay near €0.30–0.50 to break even → **organic-first is not optional, it's the model.**

## 5. Language / country launch order

Mechanics that matter: every App Store territory indexes **English metadata as a secondary locale**, and the **US indexes Spanish (MX)** as extra keyword space [AppTweak]. There is **no Bulgarian App Store locale** — Bulgarian users are reached via English metadata (in-app Bulgarian still valuable).

1. **Launch: English (primary) + Spanish (ES/MX)** — English gives baseline reach in every EU storefront; Spanish doubles keyword inventory in the US and serves Spain/LatAm. Zero extra cost for a bilingual dev.
2. **Bulgarian in-app UI** early — tiny market, but zero competition, native-language trust, and your community access. (Store listing stays English.)
3. **German — enter deliberately, not first.** Largest willingness-to-pay and the tax-report demand, but getquin + Parqet are top-10 finance apps there; go in once dividends/CSV/gains-summary are shipped. Sensor Tower reality check: even getquin peaks around ~1.2k downloads/period on iOS Germany — niche scale everywhere.
4. **Polish / Romanian next** — getquin traction is growing in PL but its Polish broker coverage is manual-only; CEE is structurally underserved (the Himalaya case: targeting low-competition storefronts yielded +58% search downloads).
- Localization evidence: adding a local language ≈ **+128% downloads / +26% revenue** per country; localized listings ≈ +38% downloads; Headspace's localization-heavy ASO: +40% search installs in non-English markets. Icon A/B testing alone: +10% conversion.

## 6. Faceless video marketing — playbook & honest expectations

**Verdict: viable, with a known tax.** Face-led accounts grow ~2–3× faster than faceless ones [semnexus]; Cal AI (the flagship "screenshot-AI app grown on TikTok" case: ~700k downloads/mo, ~$1.1M MRR) mixed faceless screen-recordings *with* founder talking-heads and paid creators. Purely faceless successes exist (Daze — 100% screen-recording format), but expect slower compounding.

**The format that fits Trading Sync perfectly:** screen-recording demo — *"POV: you have 9 investment apps"* → screenshot → AI builds the ring → total appears. That's a 15-second, no-face, infinitely-remixable hook.

**Playbook:**
- **Cadence:** 4–6 posts/week; below 3/week the algorithm deprioritizes you. Batch-record one evening per week.
- **Formats (FinTok rewards these):** explainer/myth-busting ("your broker app lies about your net worth"), "what I wish I knew", before/after portfolio reveals, platform-coverage flexes ("it read my Bondora screenshot"). Saves + shares are the ranking signals; optimize the first 1.5 seconds; watch-through rate is king; CTA in-story ("built this in Trading Sync in 30s"), not in bio only.
- **Multi-account:** Cal AI ran 12+ accounts (1,000+ videos, 10.2M views). Solo-scale version: 2–3 accounts — English, Spanish, and a P2P-niche account.
- **Paid:** boost only proven winners with Spark Ads (€5–10/day) — they outperform standard in-feed ads by 15–30% on engagement. UGC creators in tech niches run $200–1,000/video — skip until revenue.
- **Timeline honesty:** organic TikTok shows install lift after **3–6 months**, not weeks. Budget-scale playbooks assume $40–150k/quarter — that's not you; compensate with the community channel:
- **P2P community seeding (your unfair advantage):** the Portfolio Performance forum thread of people asking for exactly this product, p2pindependentforum spreadsheet-sharers, P2P blogs (ExploreP2P, P2P Empire) and Facebook groups. Offer founding-member lifetime deals there at launch — these users evangelize and forgive rough edges.

## 7. Risks register

- **P2P Dash is free** — never compete on P2P alone; the bundle is the product.
- **getquin's AI import will expand** — move fast on the non-equity asset classes where they admit failure.
- **Winner-take-most climate:** subscription-app launches grew ~7× (2022→2026); top quartile grows 80% YoY while bottom quartile shrinks — differentiation and retention beat spray-and-pray.
- **Screenshot-accuracy = churn lever:** 30% of annual subs cancel in month one; the first import experience is the business.
