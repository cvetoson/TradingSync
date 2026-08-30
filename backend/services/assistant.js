// Premium AI portfolio assistant ("Explain my portfolio").
// Educational information only — the system prompt hard-forbids personalized
// investment recommendations (MiFID II); the UI repeats the disclaimer.
import { getDatabase } from '../database.js';
import { getOpenAIClient } from './aiService.js';
import { currentPeriod } from '../lib/entitlement.js';

export const ASSISTANT_MAX_MSGS_PER_MONTH = Number(process.env.ASSISTANT_MAX_MSGS) || 300;
const MAX_HISTORY = 8;          // client may send at most this many prior turns
const MAX_QUESTION_CHARS = 1000;

const all = (db, sql, p) => new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r || []))));
const get = (db, sql, p) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
const run = (db, sql, p) => new Promise((res, rej) => db.run(sql, p, (e) => (e ? rej(e) : res())));

/** Compact, numbers-first snapshot of the user's portfolio for model context. */
export async function buildPortfolioContext(userId) {
  const db = getDatabase();
  const accounts = await all(db,
    `SELECT id, platform, account_name, account_type, balance, interest_rate
     FROM accounts WHERE user_id = ? ORDER BY balance DESC`, [userId]);
  const holdings = await all(db,
    `SELECT h.symbol, h.quantity, h.current_price, h.currency, h.cost_basis_eur, a.platform
     FROM holdings h JOIN accounts a ON a.id = h.account_id
     WHERE a.user_id = ? ORDER BY h.quantity * h.current_price DESC LIMIT 40`, [userId]);
  const total = accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const lines = [];
  lines.push(`Total portfolio (stored balances): ~€${total.toFixed(0)} across ${accounts.length} accounts.`);
  for (const a of accounts) {
    lines.push(`- ${a.platform} ${a.account_name} [${a.account_type}]: €${Number(a.balance || 0).toFixed(0)}${a.interest_rate ? `, accruing ${a.interest_rate}%/yr` : ''}`);
  }
  if (holdings.length) {
    lines.push('Largest holdings (symbol, ~value, platform):');
    for (const h of holdings.slice(0, 15)) {
      const v = (Number(h.quantity) || 0) * (Number(h.current_price) || 0);
      lines.push(`- ${h.symbol}: €${v.toFixed(0)}${h.cost_basis_eur ? ` (cost €${Number(h.cost_basis_eur).toFixed(0)})` : ''} @ ${h.platform}`);
    }
  }
  return lines.join('\n');
}

const SYSTEM_PROMPT = `You are the Trading Sync portfolio assistant. You help the user UNDERSTAND their own portfolio and general investing concepts.

Hard rules (regulatory - MiFID II):
- You provide educational information only. You are NOT a licensed financial advisor and you NEVER give personalized investment advice or recommendations.
- Never tell the user to buy, sell, hold, or time any specific security, and never suggest target allocations "for them". If asked ("should I buy X?"), explain relevant facts, risks and general frameworks, then remind them briefly that this is information, not advice, and that they may want a licensed advisor for personal recommendations.
- Do not predict prices or returns.

Style:
- Ground answers in the portfolio snapshot provided. Reference their actual numbers.
- Be concise (usually under 150 words), plain language, EUR amounts, no emoji.
- If asked something unrelated to investing or their portfolio, politely steer back.`;

export async function assistantChat(userId, messages) {
  const db = getDatabase();
  const period = currentPeriod();
  const usage = await get(db, 'SELECT assistant_msgs FROM usage_counters WHERE user_id = ? AND period = ?', [userId, period]);
  if ((Number(usage?.assistant_msgs) || 0) >= ASSISTANT_MAX_MSGS_PER_MONTH) {
    const err = new Error('Monthly assistant limit reached — resets next month');
    err.status = 429;
    throw err;
  }

  const history = (Array.isArray(messages) ? messages : [])
    .slice(-MAX_HISTORY)
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_QUESTION_CHARS) }));
  if (!history.length || history[history.length - 1].role !== 'user') {
    const err = new Error('Send at least one user message');
    err.status = 400;
    throw err;
  }

  const context = await buildPortfolioContext(userId);
  const client = getOpenAIClient();
  const model = process.env.OPENAI_ASSISTANT_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4-mini';
  const isReasoningFamily = /^(gpt-5|o\d)/i.test(model);
  const response = await client.chat.completions.create({
    model,
    ...(isReasoningFamily ? { max_completion_tokens: 1200 } : { max_tokens: 600, temperature: 0.4 }),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `Portfolio snapshot (EUR, may be minutes stale):\n${context}` },
      ...history,
    ],
  });
  const reply = response.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    const err = new Error('The assistant did not return a reply — try again');
    err.status = 502;
    throw err;
  }

  await run(db,
    `INSERT INTO usage_counters (user_id, period, ai_imports, assistant_msgs) VALUES (?, ?, 0, 1)
     ON CONFLICT(user_id, period) DO UPDATE SET assistant_msgs = usage_counters.assistant_msgs + 1`,
    [userId, period]);
  return reply;
}
