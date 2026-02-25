/** In-memory log of recent errors for /api/debug (no secrets, for AI troubleshooting) */
const MAX = 15;
const recent = [];

export function logError(path, message, status = 500) {
  recent.unshift({
    time: new Date().toISOString(),
    path,
    message: String(message || 'Unknown error').slice(0, 200),
    status,
  });
  if (recent.length > MAX) recent.pop();
}

export function getRecentErrors() {
  return [...recent];
}
