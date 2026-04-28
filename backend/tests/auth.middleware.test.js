import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../database.js', () => ({
  getDatabase: vi.fn(() => ({})),
  initDatabase: vi.fn(),
  isPostgreSQL: vi.fn(() => false),
}));

vi.mock('../services/emailService.js', () => ({
  sendPasswordResetEmail: vi.fn(),
  sendEmail: vi.fn(),
  getLastEmailError: vi.fn(() => null),
}));

vi.mock('../lib/errorLog.js', () => ({
  logError: vi.fn(),
  getRecentErrors: vi.fn(() => []),
}));

import { requireAuth, optionalAuth } from '../routes/auth.js';

const TEST_SECRET = 'dev-secret-change-in-production';

function makeReqRes() {
  const req = { headers: {} };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('requireAuth', () => {
  it('returns 401 when no Authorization header is present', () => {
    const { req, res, next } = makeReqRes();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a non-Bearer Authorization header', () => {
    const { req, res, next } = makeReqRes();
    req.headers.authorization = 'Basic dXNlcjpwYXNz';
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid JWT token', () => {
    const { req, res, next } = makeReqRes();
    req.headers.authorization = 'Bearer not.a.valid.token';
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and sets req.userId for a valid token', () => {
    const token = jwt.sign({ userId: 42, email: 'test@example.com' }, TEST_SECRET, { expiresIn: '1h' });
    const { req, res, next } = makeReqRes();
    req.headers.authorization = `Bearer ${token}`;
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe(42);
    expect(req.userEmail).toBe('test@example.com');
  });

  it('returns 401 for an expired token', () => {
    const token = jwt.sign({ userId: 1, email: 'user@example.com' }, TEST_SECRET, { expiresIn: '-1s' });
    const { req, res, next } = makeReqRes();
    req.headers.authorization = `Bearer ${token}`;
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('optionalAuth', () => {
  it('calls next with req.userId = null when no token is present', () => {
    const { req, res, next } = makeReqRes();
    optionalAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBeNull();
  });

  it('sets req.userId for a valid token', () => {
    const token = jwt.sign({ userId: 7, email: 'opt@example.com' }, TEST_SECRET, { expiresIn: '1h' });
    const { req, res, next } = makeReqRes();
    req.headers.authorization = `Bearer ${token}`;
    optionalAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe(7);
  });

  it('calls next with req.userId = null for an invalid token', () => {
    const { req, res, next } = makeReqRes();
    req.headers.authorization = 'Bearer invalid.token.here';
    optionalAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBeNull();
  });
});
