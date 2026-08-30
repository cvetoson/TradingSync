// Freemium entitlement rules (S11). Server-side only — the client renders what
// these decide, it never decides itself.

export const FREE_MAX_ACCOUNTS = Number(process.env.FREE_MAX_ACCOUNTS) || 2;
export const FREE_MAX_AI_IMPORTS_PER_MONTH = Number(process.env.FREE_MAX_AI_IMPORTS) || 3;

/** Calendar-month key for metering, e.g. "2026-08" (UTC). */
export function currentPeriod(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

/**
 * A user is premium when the flag is set and any expiry lies in the future.
 * premium_until NULL means non-expiring (manually granted / lifetime).
 */
export function isPremiumUser(user, now = new Date()) {
  if (!user || !Number(user.premium)) return false;
  if (user.premium_until == null) return true;
  const until = new Date(user.premium_until);
  return Number.isFinite(until.getTime()) && until > now;
}

/** Shape returned to the client for paywall/usage UI. */
export function entitlementPayload({ premium, premiumUntil, accountsUsed, aiImportsUsed, now = new Date() }) {
  return {
    premium,
    premiumUntil: premiumUntil ?? null,
    period: currentPeriod(now),
    limits: premium
      ? { accounts: null, aiImportsPerMonth: null }
      : { accounts: FREE_MAX_ACCOUNTS, aiImportsPerMonth: FREE_MAX_AI_IMPORTS_PER_MONTH },
    usage: { accounts: accountsUsed, aiImports: aiImportsUsed },
  };
}

/** Standard 402 body: the client shows the paywall on code === 'upgrade_required'. */
export function upgradeRequired(reason, detail) {
  return { error: detail, code: 'upgrade_required', reason };
}
