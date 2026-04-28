import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';

const mockDb = {
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn(),
};

vi.mock('../database.js', () => ({
  getDatabase: () => mockDb,
  initDatabase: vi.fn(() => Promise.resolve()),
  isPostgreSQL: vi.fn(() => false),
}));

vi.mock('../services/emailService.js', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve({ sent: false, devLink: null })),
  sendEmail: vi.fn(),
  getLastEmailError: vi.fn(() => null),
}));

vi.mock('../lib/errorLog.js', () => ({
  logError: vi.fn(),
  getRecentErrors: vi.fn(() => []),
}));

import { register, login } from '../routes/auth.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.post('/api/auth/register', register);
  app.post('/api/auth/login', login);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/register', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(createApp())
      .post('/api/auth/register')
      .send({ password: 'password123', confirmPassword: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(createApp())
      .post('/api/auth/register')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it('returns 400 when passwords do not match', async () => {
    const res = await request(createApp())
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123', confirmPassword: 'different456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/do not match/i);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(createApp())
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password123', confirmPassword: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid email/i);
  });

  it('returns 400 for password shorter than 8 characters', async () => {
    const res = await request(createApp())
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'short', confirmPassword: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 characters/i);
  });

  it('returns 201 and a JWT token on successful registration', async () => {
    mockDb.run.mockImplementation(function (sql, params, callback) {
      callback.call({ lastID: 1, changes: 1 }, null);
    });

    const res = await request(createApp())
      .post('/api/auth/register')
      .send({ email: 'newuser@example.com', password: 'password123', confirmPassword: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('newuser@example.com');
  });

  it('returns 409 for duplicate email', async () => {
    mockDb.run.mockImplementation(function (sql, params, callback) {
      callback({ message: 'UNIQUE constraint failed: users.email' });
    });

    const res = await request(createApp())
      .post('/api/auth/register')
      .send({ email: 'existing@example.com', password: 'password123', confirmPassword: 'password123' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 400 when credentials are missing', async () => {
    const res = await request(createApp()).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 401 for unknown email', async () => {
    mockDb.get.mockImplementation((sql, params, callback) => {
      callback(null, undefined);
    });

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for wrong password', async () => {
    const hash = await bcrypt.hash('correctpassword', 10);
    mockDb.get.mockImplementation((sql, params, callback) => {
      callback(null, { id: 1, email: 'user@example.com', password_hash: hash, display_name: 'User', email_verified: 1 });
    });

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('returns 200 and a JWT token for valid credentials', async () => {
    const hash = await bcrypt.hash('correctpassword', 10);
    mockDb.get.mockImplementation((sql, params, callback) => {
      callback(null, { id: 1, email: 'user@example.com', password_hash: hash, display_name: 'User', email_verified: 1 });
    });

    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'correctpassword' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
  });
});
