# App Store Connect — App Privacy ("nutrition label") answers

_Draft for the App Privacy section of App Store Connect. Fill these in exactly when
submitting (S21). Matches the live privacy policy at
https://tradingsync-production.up.railway.app/privacy — keep both in sync._

## Top-level questions

**Do you or your third-party partners collect data from this app?** → **Yes**

**Privacy policy URL** → `https://tradingsync-production.up.railway.app/privacy`
(swap for the custom domain once zetoson.com is wired up)

## Data types collected

| Apple category | Data | Collected? | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|---|---|
| Contact Info → Email Address | account email | Yes | Yes | No | App Functionality (login, password reset) |
| Financial Info → Other Financial Info | balances, holdings, deposits the user enters/uploads | Yes | Yes | No | App Functionality |
| User Content → Photos or Videos | uploaded screenshots | Yes | Yes | No | App Functionality (AI extraction) |
| User Content → Other User Content | account names, notes, tags | Yes | Yes | No | App Functionality |
| Identifiers | — | **No** | — | — | no device IDs, no user IDs shared with third parties |
| Location / Contacts / Health / Browsing / Search History / Diagnostics / Usage Data | — | **No** | — | — | no analytics SDK, no crash SDK, no ads |

**Tracking (ATT):** the app does **not** track users across apps/websites → no App
Tracking Transparency prompt needed.

## Notes that reviewers may ask about

- **Face ID**: used only to gate the app locally (`NSFaceIDUsageDescription` present);
  biometric data never leaves the device — it is not "collected".
- **Camera / Photo Library**: user-initiated screenshot import only; usage strings in
  Info.plist explain exactly this.
- **Third-party processors** (disclose if asked, all under App Functionality):
  OpenAI (screenshot extraction; API terms — no training on API data), Railway
  (hosting/DB), Resend (transactional email), Stooq/CoinGecko/FX APIs (tickers only,
  no personal data).
- **Account deletion**: required by 5.1.1(v) — implemented in-app (Settings → Danger
  Zone), deletes all server data including uploaded files. Mention this in Review Notes.
- Financial data is user-entered/screenshot-derived; the app never connects to
  brokers or banks and holds no credentials — worth stating in Review Notes since
  "finance app" usually triggers extra scrutiny.
