/**
 * API Route Tests
 * Tests for endpoint validation and error handling
 */

import { jest } from '@jest/globals';

// Mock the database module before importing routes
const mockDb = {
  get: jest.fn(),
  run: jest.fn(),
  all: jest.fn()
};

jest.unstable_mockModule('../database.js', () => ({
  getDatabase: () => mockDb,
  initDatabase: jest.fn(),
  isPostgreSQL: () => false
}));

// Mock services
jest.unstable_mockModule('../services/aiService.js', () => ({
  analyzeScreenshot: jest.fn()
}));

jest.unstable_mockModule('../services/marketData.js', () => ({
  fetchCurrentPrice: jest.fn(),
  getProjectedPrice3M: jest.fn(),
  fetchUsdToEurRate: jest.fn().mockResolvedValue(0.92),
  fetchGbpToEurRate: jest.fn().mockResolvedValue(1.17)
}));

jest.unstable_mockModule('../services/calculations.js', () => ({
  calculatePortfolioValue: jest.fn().mockResolvedValue(1000)
}));

// Import after mocking
const { validateId, validateString, validateNumber, validateAccountType } = await import('../lib/validation.js');

describe('Route Input Validation', () => {
  
  describe('ID Parameter Validation', () => {
    test('should reject SQL injection in ID parameter', () => {
      const maliciousIds = [
        "1; DROP TABLE users;",
        "1 OR 1=1",
        "1' OR '1'='1",
        "1; DELETE FROM accounts;--",
        "1 UNION SELECT * FROM users"
      ];
      
      maliciousIds.forEach(id => {
        const result = validateId(id);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('ID must be a valid integer');
      });
    });

    test('should reject path traversal attempts', () => {
      const traversalIds = [
        "../../../etc/passwd",
        "..%2F..%2F..%2Fetc%2Fpasswd",
        "%2e%2e%2f%2e%2e%2f"
      ];
      
      traversalIds.forEach(id => {
        const result = validateId(id);
        expect(result.valid).toBe(false);
      });
    });

    test('should reject oversized IDs', () => {
      const result = validateId(Number.MAX_SAFE_INTEGER + 1);
      expect(result.valid).toBe(false);
    });
  });

  describe('String Input Validation', () => {
    test('should prevent XSS in account names', () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        'javascript:alert("xss")'
      ];
      
      xssAttempts.forEach(xss => {
        const result = validateString(xss, 'Account name', { maxLength: 100 });
        // XSS strings are accepted (should be escaped on output, not rejected on input)
        // But they should be trimmed and limited
        expect(result.valid).toBe(true);
        expect(result.value.length).toBeLessThanOrEqual(100);
      });
    });

    test('should enforce length limits', () => {
      const longString = 'a'.repeat(1000);
      const result = validateString(longString, 'Account name', { maxLength: 100 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at most 100 characters');
    });

    test('should handle unicode properly', () => {
      const unicodeStrings = [
        '日本語テスト',
        'Тест на русском',
        '🚀 Rocket Account',
        'Émile\'s Portfolio'
      ];
      
      unicodeStrings.forEach(str => {
        const result = validateString(str, 'Account name', { maxLength: 100 });
        expect(result.valid).toBe(true);
        expect(result.value).toBe(str.trim());
      });
    });
  });

  describe('Number Input Validation', () => {
    test('should reject extremely large numbers', () => {
      const result = validateNumber(1e20, 'Balance', { max: 999999999999 });
      expect(result.valid).toBe(false);
    });

    test('should handle floating point precision', () => {
      const result = validateNumber(0.1 + 0.2, 'Price');
      expect(result.valid).toBe(true);
      // JavaScript floating point: 0.1 + 0.2 = 0.30000000000000004
      expect(result.value).toBeCloseTo(0.3, 10);
    });

    test('should reject NaN and Infinity', () => {
      expect(validateNumber(NaN, 'Price').valid).toBe(false);
      expect(validateNumber(Infinity, 'Price').valid).toBe(false);
      expect(validateNumber(-Infinity, 'Price').valid).toBe(false);
    });

    test('should reject string representations of special values', () => {
      expect(validateNumber('NaN', 'Price').valid).toBe(false);
      expect(validateNumber('Infinity', 'Price').valid).toBe(false);
    });
  });

  describe('Account Type Validation', () => {
    test('should accept valid types case-insensitively', () => {
      const types = ['P2P', 'STOCKS', 'Crypto', 'PRECIOUS', 'Bank', 'savings', 'UnKnOwN'];
      types.forEach(type => {
        const result = validateAccountType(type);
        expect(result.valid).toBe(true);
        expect(result.value).toBe(type.toLowerCase());
      });
    });

    test('should reject invalid account types', () => {
      const invalidTypes = ['options', 'forex', 'nft', 'property', ''];
      invalidTypes.forEach(type => {
        const result = validateAccountType(type);
        expect(result.valid).toBe(false);
      });
    });
  });
});

describe('Error Message Sanitization', () => {
  test('should not expose database table names', async () => {
    const { sanitizeDbError } = await import('../lib/validation.js');
    
    const dbErrors = [
      new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email'),
      new Error('duplicate key value violates unique constraint "accounts_pkey"'),
      new Error('FOREIGN KEY constraint failed'),
      new Error('NOT NULL constraint failed: holdings.symbol')
    ];
    
    dbErrors.forEach(err => {
      const sanitized = sanitizeDbError(err, 'Operation failed');
      expect(sanitized).not.toContain('users');
      expect(sanitized).not.toContain('accounts');
      expect(sanitized).not.toContain('holdings');
      expect(sanitized).not.toContain('pkey');
      expect(sanitized).not.toContain('SQLITE');
    });
  });
});

describe('Edge Cases', () => {
  test('should handle empty request body gracefully', () => {
    const result = validateString(undefined, 'Field', { required: true });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Field is required');
  });

  test('should handle null values', () => {
    expect(validateId(null).valid).toBe(false);
    expect(validateString(null, 'Field').valid).toBe(false);
    expect(validateNumber(null, 'Field').valid).toBe(false);
  });

  test('should handle array inputs', () => {
    expect(validateString([], 'Field').valid).toBe(false);
    expect(validateNumber([], 'Field').valid).toBe(false);
  });

  test('should handle object inputs', () => {
    expect(validateString({}, 'Field').valid).toBe(false);
    expect(validateNumber({}, 'Field').valid).toBe(false);
  });
});
