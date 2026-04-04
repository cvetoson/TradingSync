/**
 * Tests for validation utilities
 * These tests expose weak points in input validation
 */

import {
  validateId,
  validateString,
  validateNumber,
  validateEmail,
  validatePassword,
  validateAccountType,
  validateCurrency,
  validateSymbol,
  validateFileUpload,
  sanitizeDbError,
  validateBalance,
  validateInterestRate,
  validateQuantity,
  validatePrice
} from '../lib/validation.js';

describe('validateId', () => {
  test('should accept valid positive integer', () => {
    expect(validateId(1).valid).toBe(true);
    expect(validateId(1).value).toBe(1);
    expect(validateId('123').valid).toBe(true);
    expect(validateId('123').value).toBe(123);
  });

  test('should reject undefined/null/empty', () => {
    expect(validateId(undefined).valid).toBe(false);
    expect(validateId(null).valid).toBe(false);
    expect(validateId('').valid).toBe(false);
  });

  test('should reject non-numeric strings', () => {
    expect(validateId('abc').valid).toBe(false);
    expect(validateId('12abc').valid).toBe(false);
    expect(validateId('1.5').valid).toBe(false); // decimals not allowed for IDs
  });

  test('should reject negative numbers', () => {
    expect(validateId(-1).valid).toBe(false);
    expect(validateId('-5').valid).toBe(false);
  });

  test('should reject zero', () => {
    expect(validateId(0).valid).toBe(false);
    expect(validateId('0').valid).toBe(false);
  });

  test('should reject unsafe integers', () => {
    expect(validateId(Number.MAX_SAFE_INTEGER + 1).valid).toBe(false);
  });

  test('should reject special values', () => {
    expect(validateId(Infinity).valid).toBe(false);
    expect(validateId(NaN).valid).toBe(false);
    expect(validateId('Infinity').valid).toBe(false);
  });

  test('should reject SQL injection attempts', () => {
    expect(validateId("1; DROP TABLE users;").valid).toBe(false);
    expect(validateId("1 OR 1=1").valid).toBe(false);
  });
});

describe('validateString', () => {
  test('should accept valid strings', () => {
    expect(validateString('hello', 'Test').valid).toBe(true);
    expect(validateString('hello', 'Test').value).toBe('hello');
  });

  test('should trim whitespace by default', () => {
    expect(validateString('  hello  ', 'Test').value).toBe('hello');
  });

  test('should reject empty strings when required', () => {
    expect(validateString('', 'Test').valid).toBe(false);
    expect(validateString('   ', 'Test').valid).toBe(false);
  });

  test('should accept empty strings when not required', () => {
    expect(validateString('', 'Test', { required: false }).valid).toBe(true);
  });

  test('should enforce max length', () => {
    expect(validateString('a'.repeat(256), 'Test', { maxLength: 255 }).valid).toBe(false);
    expect(validateString('a'.repeat(255), 'Test', { maxLength: 255 }).valid).toBe(true);
  });

  test('should reject non-strings', () => {
    expect(validateString(123, 'Test').valid).toBe(false);
    expect(validateString({}, 'Test').valid).toBe(false);
    expect(validateString([], 'Test').valid).toBe(false);
  });

  test('should handle null and undefined', () => {
    expect(validateString(null, 'Test').valid).toBe(false);
    expect(validateString(undefined, 'Test').valid).toBe(false);
    expect(validateString(null, 'Test', { required: false }).valid).toBe(true);
  });
});

describe('validateNumber', () => {
  test('should accept valid numbers', () => {
    expect(validateNumber(100, 'Test').valid).toBe(true);
    expect(validateNumber('100', 'Test').value).toBe(100);
    expect(validateNumber(0.5, 'Test', { min: 0 }).valid).toBe(true);
  });

  test('should reject NaN', () => {
    expect(validateNumber('abc', 'Test').valid).toBe(false);
    expect(validateNumber(NaN, 'Test').valid).toBe(false);
  });

  test('should reject Infinity', () => {
    expect(validateNumber(Infinity, 'Test').valid).toBe(false);
    expect(validateNumber(-Infinity, 'Test').valid).toBe(false);
  });

  test('should enforce min/max', () => {
    expect(validateNumber(5, 'Test', { min: 10 }).valid).toBe(false);
    expect(validateNumber(15, 'Test', { max: 10 }).valid).toBe(false);
    expect(validateNumber(10, 'Test', { min: 0, max: 100 }).valid).toBe(true);
  });

  test('should handle negative numbers', () => {
    expect(validateNumber(-5, 'Test', { allowNegative: false }).valid).toBe(false);
    expect(validateNumber(-5, 'Test', { allowNegative: true }).valid).toBe(true);
  });

  test('should enforce integer requirement', () => {
    expect(validateNumber(1.5, 'Test', { integer: true }).valid).toBe(false);
    expect(validateNumber(2, 'Test', { integer: true }).valid).toBe(true);
  });
});

describe('validateEmail', () => {
  test('should accept valid emails', () => {
    expect(validateEmail('test@example.com').valid).toBe(true);
    expect(validateEmail('user.name+tag@domain.co.uk').valid).toBe(true);
  });

  test('should normalize to lowercase', () => {
    expect(validateEmail('Test@Example.COM').value).toBe('test@example.com');
  });

  test('should reject invalid formats', () => {
    expect(validateEmail('notanemail').valid).toBe(false);
    expect(validateEmail('missing@domain').valid).toBe(false);
    expect(validateEmail('@nodomain.com').valid).toBe(false);
    expect(validateEmail('noat.com').valid).toBe(false);
  });

  test('should reject too long emails', () => {
    const longEmail = 'a'.repeat(300) + '@example.com';
    expect(validateEmail(longEmail).valid).toBe(false);
  });

  test('should reject empty input', () => {
    expect(validateEmail('').valid).toBe(false);
    expect(validateEmail(null).valid).toBe(false);
  });
});

describe('validatePassword', () => {
  test('should accept valid passwords', () => {
    expect(validatePassword('password123').valid).toBe(true);
    expect(validatePassword('12345678').valid).toBe(true);
  });

  test('should reject short passwords', () => {
    expect(validatePassword('short').valid).toBe(false);
    expect(validatePassword('1234567').valid).toBe(false);
  });

  test('should reject too long passwords', () => {
    expect(validatePassword('a'.repeat(129)).valid).toBe(false);
  });

  test('should reject empty input', () => {
    expect(validatePassword('').valid).toBe(false);
    expect(validatePassword(null).valid).toBe(false);
  });
});

describe('validateAccountType', () => {
  test('should accept valid account types', () => {
    expect(validateAccountType('p2p').valid).toBe(true);
    expect(validateAccountType('stocks').valid).toBe(true);
    expect(validateAccountType('crypto').valid).toBe(true);
    expect(validateAccountType('precious').valid).toBe(true);
    expect(validateAccountType('bank').valid).toBe(true);
    expect(validateAccountType('savings').valid).toBe(true);
  });

  test('should normalize case', () => {
    expect(validateAccountType('P2P').value).toBe('p2p');
    expect(validateAccountType('STOCKS').value).toBe('stocks');
  });

  test('should reject invalid types', () => {
    expect(validateAccountType('invalid').valid).toBe(false);
    expect(validateAccountType('options').valid).toBe(false);
    expect(validateAccountType('').valid).toBe(false);
  });
});

describe('validateCurrency', () => {
  test('should accept valid currencies', () => {
    expect(validateCurrency('EUR').valid).toBe(true);
    expect(validateCurrency('USD').valid).toBe(true);
    expect(validateCurrency('GBP').valid).toBe(true);
  });

  test('should normalize case', () => {
    expect(validateCurrency('eur').value).toBe('EUR');
    expect(validateCurrency('usd').value).toBe('USD');
  });

  test('should default to EUR when not required and empty', () => {
    expect(validateCurrency('', false).value).toBe('EUR');
    expect(validateCurrency(null, false).value).toBe('EUR');
  });

  test('should reject invalid currencies', () => {
    expect(validateCurrency('JPY').valid).toBe(false);
    expect(validateCurrency('BTC').valid).toBe(false);
  });
});

describe('validateSymbol', () => {
  test('should accept valid symbols', () => {
    expect(validateSymbol('AAPL').valid).toBe(true);
    expect(validateSymbol('BTC-USD').valid).toBe(true);
    expect(validateSymbol('VUSA.L').valid).toBe(true);
  });

  test('should uppercase symbols', () => {
    expect(validateSymbol('aapl').value).toBe('AAPL');
  });

  test('should reject too long symbols', () => {
    expect(validateSymbol('A'.repeat(21)).valid).toBe(false);
  });

  test('should reject invalid characters', () => {
    expect(validateSymbol('AAP$L').valid).toBe(false);
    expect(validateSymbol('AA PL').valid).toBe(false);
    expect(validateSymbol('AAPL@').valid).toBe(false);
  });

  test('should reject empty input', () => {
    expect(validateSymbol('').valid).toBe(false);
    expect(validateSymbol('   ').valid).toBe(false);
  });
});

describe('validateFileUpload', () => {
  test('should accept valid image files', () => {
    expect(validateFileUpload({ mimetype: 'image/png' }).valid).toBe(true);
    expect(validateFileUpload({ mimetype: 'image/jpeg' }).valid).toBe(true);
    expect(validateFileUpload({ mimetype: 'image/webp' }).valid).toBe(true);
  });

  test('should reject non-image files', () => {
    expect(validateFileUpload({ mimetype: 'application/pdf' }).valid).toBe(false);
    expect(validateFileUpload({ mimetype: 'text/html' }).valid).toBe(false);
    expect(validateFileUpload({ mimetype: 'application/javascript' }).valid).toBe(false);
  });

  test('should reject no file', () => {
    expect(validateFileUpload(null).valid).toBe(false);
    expect(validateFileUpload(undefined).valid).toBe(false);
  });
});

describe('sanitizeDbError', () => {
  test('should sanitize unique constraint errors', () => {
    const error = new Error('UNIQUE constraint failed');
    expect(sanitizeDbError(error)).toBe('A record with this value already exists');
  });

  test('should sanitize duplicate key errors', () => {
    const error = new Error('duplicate key value violates unique constraint');
    expect(sanitizeDbError(error)).toBe('A record with this value already exists');
  });

  test('should sanitize foreign key errors', () => {
    const error = new Error('FOREIGN KEY constraint failed');
    expect(sanitizeDbError(error)).toBe('Cannot complete operation due to data dependencies');
  });

  test('should return fallback for unknown errors', () => {
    const error = new Error('Some internal error with sensitive data');
    expect(sanitizeDbError(error, 'Operation failed')).toBe('Operation failed');
  });

  test('should handle null/undefined errors', () => {
    expect(sanitizeDbError(null, 'Default')).toBe('Default');
    expect(sanitizeDbError(undefined, 'Default')).toBe('Default');
  });
});

describe('validateBalance', () => {
  test('should accept valid balances', () => {
    expect(validateBalance(0).valid).toBe(true);
    expect(validateBalance(1000).valid).toBe(true);
    expect(validateBalance('1234.56').valid).toBe(true);
  });

  test('should reject negative balances', () => {
    expect(validateBalance(-100).valid).toBe(false);
  });

  test('should reject extremely large balances', () => {
    expect(validateBalance(9999999999999).valid).toBe(false);
  });
});

describe('validateInterestRate', () => {
  test('should accept valid interest rates', () => {
    expect(validateInterestRate(5).valid).toBe(true);
    expect(validateInterestRate(12.5).valid).toBe(true);
    expect(validateInterestRate(0).valid).toBe(true);
  });

  test('should reject rates over 100%', () => {
    expect(validateInterestRate(150).valid).toBe(false);
  });

  test('should reject negative rates', () => {
    expect(validateInterestRate(-5).valid).toBe(false);
  });

  test('should allow null when not required', () => {
    expect(validateInterestRate(null, false).valid).toBe(true);
    expect(validateInterestRate('', false).valid).toBe(true);
  });
});

describe('validateQuantity', () => {
  test('should accept valid quantities', () => {
    expect(validateQuantity(1).valid).toBe(true);
    expect(validateQuantity(0.5).valid).toBe(true);
    expect(validateQuantity('100').valid).toBe(true);
  });

  test('should reject zero', () => {
    expect(validateQuantity(0).valid).toBe(false);
  });

  test('should reject negative quantities', () => {
    expect(validateQuantity(-1).valid).toBe(false);
  });

  test('should accept very small quantities (crypto)', () => {
    expect(validateQuantity(0.00001).valid).toBe(true);
  });
});

describe('validatePrice', () => {
  test('should accept valid prices', () => {
    expect(validatePrice(100).valid).toBe(true);
    expect(validatePrice(0.01).valid).toBe(true);
    expect(validatePrice('50.25').valid).toBe(true);
  });

  test('should allow zero price', () => {
    expect(validatePrice(0).valid).toBe(true);
  });

  test('should reject negative prices', () => {
    expect(validatePrice(-10).valid).toBe(false);
  });

  test('should allow null when not required', () => {
    expect(validatePrice(null, false).valid).toBe(true);
    expect(validatePrice('', false).valid).toBe(true);
  });
});
