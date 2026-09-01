# 8Sync — App Store Connect metadata (paste-ready)

Prepared 2026-09-01 while enrollment activation is pending. Everything here goes
into App Store Connect → My Apps → 8Sync → App Information / version page.

## Identity
- **Bundle ID:** com.zetoson.eightsync
- **App name (30 max):** `8Sync: Portfolio Tracker`
- **Subtitle (30 max):** `All assets. One net worth.`
- **Primary category:** Finance · Secondary: Productivity
- **Age rating:** 4+ (no restricted content; questionnaire = all "No")

## URLs
- Marketing: `https://8-sync.com`
- Support: `https://app.8-sync.com/support`
- Privacy policy: `https://app.8-sync.com/privacy`

## Keywords (100 chars max, no spaces after commas)
```
portfolio,tracker,net worth,stocks,etf,crypto,p2p,gold,broker,wealth,invest,dividends
```

## Promotional text (170 max, changeable without review)
```
Track every asset you own — brokers, P2P lending, crypto, gold and deposits — in one live net worth. A screenshot is enough. No broker logins.
```

## Description
```
Your portfolio is bigger than your broker. 8Sync brings every asset you own into one live net worth — stocks and ETFs, P2P lending, savings and deposits, crypto wallets, physical gold — even the platforms no aggregator can connect to.

HOW IT WORKS
Screenshot your broker, bank or wallet app. 8Sync's AI reads the balances and holdings and keeps the account up to date. No broker credentials, no API keys, no open-banking permissions: a screenshot reveals only what is already on your screen.

• Every asset class — one allocation ring instead of nine apps
• AI screenshot import — up to 5 scrolled views read as one account
• Live prices — stocks, ETFs, metals and crypto refresh automatically
• P2P & deposits — interest accrues daily from your real rates
• Multi-currency — EUR, USD, GBP, CHF, HKD handled natively
• Face ID lock — your numbers stay yours
• Private by design — delete your account and every row of data anytime

PREMIUM
The free tier includes 2 accounts and 3 AI imports per month. 8Sync Premium unlocks unlimited accounts, unlimited AI imports and the AI portfolio assistant, which explains your own portfolio in plain language — educational information grounded in your real numbers.

8Sync provides educational information only, not investment advice or personal recommendations (MiFID II). Market data may be delayed or estimated; always verify against your broker.

Terms: https://8-sync.com/terms · Privacy: https://app.8-sync.com/privacy
```

## App Review information (S21)
- **Demo account:** `appreview@8-sync.com` / `Review8Sync!2026`
  (Premium pre-enabled; seeded with a realistic portfolio: Trading 212, IBKR,
  Bondora, Monefit, Revolut Crypto, physical gold, fixed deposit.)
- **Review notes (paste):**
```
8Sync is a personal portfolio tracker. The demo account is pre-loaded with a sample portfolio and has Premium enabled so all features are reviewable.

To test AI screenshot import: open any account → Update Account → attach 1–5 screenshots of a brokerage position list (any broker screenshot works, including a screenshot of a demo portfolio). The AI extracts balances/holdings server-side via HTTPS.

The AI portfolio assistant (chat bubble, bottom right) answers questions about the signed-in user's own portfolio. It provides educational information only and refuses personal investment recommendations (MiFID II compliance); this is stated in-app and in the privacy policy.

Account deletion: Settings → Danger Zone → Delete account (password-gated, cascades all data).

No broker credentials are ever requested; the app consumes only user-provided screenshots.
```
- **Export compliance:** uses only standard HTTPS/ATS → `ITSAppUsesNonExemptEncryption = NO`
  (already set in Info.plist, so the question is pre-answered per build).
- **Sign-in required:** yes → demo credentials above.
- **App Privacy (nutrition label):** answers in `notes/app-store-data-safety.md`.

## Screenshots (S20)
- Required: 6.7" (1290×2796) — captured on iPhone 15 Pro Max simulator; one set
  is enough (smaller sizes scale down automatically since 2024 rules).
- Shot list: 1 dashboard/net-worth ring · 2 platforms & allocation · 3 account
  detail with holdings · 4 multi-screenshot AI import · 5 AI assistant ·
  6 sign-in/Face ID (privacy angle). Files land in `notes/app-store-screenshots/`.

## Subscriptions (create in ASC once active — S14)
- Group: `8Sync Premium`
- `premium_monthly` — €3.99/month
- `premium_yearly` — €29.99/year (+ intro offer: first year €19.99 or 1-week free trial)
- Names shown on paywall already; RevenueCat wiring is S15/S16.

## Post-activation same-day checklist
1. developer.apple.com shows active membership → create App ID + app in ASC
   (name 8Sync: Portfolio Tracker, bundle com.zetoson.eightsync, SKU 8sync-ios).
2. Paste everything above; upload screenshots.
3. Create subscription products (S14) + RevenueCat project.
4. Archive in Xcode with a real signing team → upload → TestFlight (S18).
5. Submit (S22) and enroll in the Small Business Program (15% commission).
