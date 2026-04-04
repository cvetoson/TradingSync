/**
 * Validation utilities for input sanitization and validation
 */

/**
 * Validates and parses an ID parameter (must be a positive integer)
 * @param {string|number} id - The ID to validate
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validateId(id) {
  if (id === undefined || id === null || id === '') {
    return { valid: false, value: null, error: 'ID is required' };
  }
  
  // Convert to string for validation
  const idStr = String(id).trim();
  
  // Must be purely numeric (no letters, special chars, or spaces)
  if (!/^\d+$/.test(idStr)) {
    return { valid: false, value: null, error: 'ID must be a valid integer' };
  }
  
  const parsed = parseInt(idStr, 10);
  
  if (isNaN(parsed)) {
    return { valid: false, value: null, error: 'ID must be a valid integer' };
  }
  
  if (parsed <= 0) {
    return { valid: false, value: null, error: 'ID must be a positive integer' };
  }
  
  if (!Number.isSafeInteger(parsed)) {
    return { valid: false, value: null, error: 'ID is out of valid range' };
  }
  
  return { valid: true, value: parsed, error: null };
}

/**
 * Validates a string input with length constraints
 * @param {string} value - The string to validate
 * @param {string} fieldName - Name of the field for error messages
 * @param {Object} options - Validation options
 * @param {number} [options.minLength=1] - Minimum length
 * @param {number} [options.maxLength=255] - Maximum length
 * @param {boolean} [options.required=true] - Whether the field is required
 * @param {boolean} [options.trim=true] - Whether to trim whitespace
 * @returns {{ valid: boolean, value: string|null, error: string|null }}
 */
export function validateString(value, fieldName, options = {}) {
  const {
    minLength = 1,
    maxLength = 255,
    required = true,
    trim = true
  } = options;
  
  if (value === undefined || value === null) {
    if (required) {
      return { valid: false, value: null, error: `${fieldName} is required` };
    }
    return { valid: true, value: null, error: null };
  }
  
  if (typeof value !== 'string') {
    return { valid: false, value: null, error: `${fieldName} must be a string` };
  }
  
  let processed = trim ? value.trim() : value;
  
  if (required && processed.length === 0) {
    return { valid: false, value: null, error: `${fieldName} cannot be empty` };
  }
  
  if (processed.length > 0 && processed.length < minLength) {
    return { valid: false, value: null, error: `${fieldName} must be at least ${minLength} characters` };
  }
  
  if (processed.length > maxLength) {
    return { valid: false, value: null, error: `${fieldName} must be at most ${maxLength} characters` };
  }
  
  return { valid: true, value: processed, error: null };
}

/**
 * Validates a numeric input
 * @param {string|number} value - The value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @param {Object} options - Validation options
 * @param {number} [options.min] - Minimum value (inclusive)
 * @param {number} [options.max] - Maximum value (inclusive)
 * @param {boolean} [options.required=true] - Whether the field is required
 * @param {boolean} [options.allowNegative=false] - Whether to allow negative values
 * @param {boolean} [options.integer=false] - Whether value must be an integer
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validateNumber(value, fieldName, options = {}) {
  const {
    min,
    max,
    required = true,
    allowNegative = false,
    integer = false
  } = options;
  
  if (value === undefined || value === null || value === '') {
    if (required) {
      return { valid: false, value: null, error: `${fieldName} is required` };
    }
    return { valid: true, value: null, error: null };
  }
  
  // Reject non-primitive types (arrays, objects)
  if (typeof value === 'object') {
    return { valid: false, value: null, error: `${fieldName} must be a valid number` };
  }
  
  const parsed = Number(value);
  
  if (isNaN(parsed)) {
    return { valid: false, value: null, error: `${fieldName} must be a valid number` };
  }
  
  if (!Number.isFinite(parsed)) {
    return { valid: false, value: null, error: `${fieldName} must be a finite number` };
  }
  
  if (integer && !Number.isInteger(parsed)) {
    return { valid: false, value: null, error: `${fieldName} must be an integer` };
  }
  
  if (!allowNegative && parsed < 0) {
    return { valid: false, value: null, error: `${fieldName} cannot be negative` };
  }
  
  if (min !== undefined && parsed < min) {
    return { valid: false, value: null, error: `${fieldName} must be at least ${min}` };
  }
  
  if (max !== undefined && parsed > max) {
    return { valid: false, value: null, error: `${fieldName} must be at most ${max}` };
  }
  
  return { valid: true, value: parsed, error: null };
}

/**
 * Validates an email address
 * @param {string} email - The email to validate
 * @returns {{ valid: boolean, value: string|null, error: string|null }}
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, value: null, error: 'Email is required' };
  }
  
  const normalized = email.trim().toLowerCase();
  
  if (normalized.length === 0) {
    return { valid: false, value: null, error: 'Email is required' };
  }
  
  if (normalized.length > 254) {
    return { valid: false, value: null, error: 'Email is too long' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    return { valid: false, value: null, error: 'Invalid email format' };
  }
  
  const [localPart, domain] = normalized.split('@');
  if (localPart.length > 64) {
    return { valid: false, value: null, error: 'Email local part is too long' };
  }
  
  if (domain.length > 255) {
    return { valid: false, value: null, error: 'Email domain is too long' };
  }
  
  return { valid: true, value: normalized, error: null };
}

/**
 * Validates a password
 * @param {string} password - The password to validate
 * @param {Object} options - Validation options
 * @param {number} [options.minLength=8] - Minimum length
 * @param {number} [options.maxLength=128] - Maximum length
 * @returns {{ valid: boolean, value: string|null, error: string|null }}
 */
export function validatePassword(password, options = {}) {
  const { minLength = 8, maxLength = 128 } = options;
  
  if (!password || typeof password !== 'string') {
    return { valid: false, value: null, error: 'Password is required' };
  }
  
  if (password.length < minLength) {
    return { valid: false, value: null, error: `Password must be at least ${minLength} characters` };
  }
  
  if (password.length > maxLength) {
    return { valid: false, value: null, error: `Password must be at most ${maxLength} characters` };
  }
  
  return { valid: true, value: password, error: null };
}

/**
 * Validates account type
 * @param {string} accountType - The account type to validate
 * @returns {{ valid: boolean, value: string|null, error: string|null }}
 */
export function validateAccountType(accountType) {
  const validTypes = ['p2p', 'stocks', 'crypto', 'precious', 'bank', 'savings', 'unknown'];
  
  if (!accountType || typeof accountType !== 'string') {
    return { valid: false, value: null, error: 'Account type is required' };
  }
  
  const normalized = accountType.trim().toLowerCase();
  
  if (!validTypes.includes(normalized)) {
    return { valid: false, value: null, error: `Account type must be one of: ${validTypes.join(', ')}` };
  }
  
  return { valid: true, value: normalized, error: null };
}

/**
 * Validates currency code
 * @param {string} currency - The currency code to validate
 * @param {boolean} required - Whether the field is required
 * @returns {{ valid: boolean, value: string|null, error: string|null }}
 */
export function validateCurrency(currency, required = false) {
  const validCurrencies = ['EUR', 'USD', 'GBP', 'CHF'];
  
  if (!currency || typeof currency !== 'string') {
    if (required) {
      return { valid: false, value: null, error: 'Currency is required' };
    }
    return { valid: true, value: 'EUR', error: null };
  }
  
  const normalized = currency.trim().toUpperCase();
  
  if (!validCurrencies.includes(normalized)) {
    return { valid: false, value: null, error: `Currency must be one of: ${validCurrencies.join(', ')}` };
  }
  
  return { valid: true, value: normalized, error: null };
}

/**
 * Validates a stock/crypto symbol
 * @param {string} symbol - The symbol to validate
 * @returns {{ valid: boolean, value: string|null, error: string|null }}
 */
export function validateSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    return { valid: false, value: null, error: 'Symbol is required' };
  }
  
  const normalized = symbol.trim().toUpperCase();
  
  if (normalized.length === 0) {
    return { valid: false, value: null, error: 'Symbol cannot be empty' };
  }
  
  if (normalized.length > 20) {
    return { valid: false, value: null, error: 'Symbol is too long (max 20 characters)' };
  }
  
  if (!/^[A-Z0-9._-]+$/.test(normalized)) {
    return { valid: false, value: null, error: 'Symbol contains invalid characters' };
  }
  
  return { valid: true, value: normalized, error: null };
}

/**
 * Validates file upload (mime type)
 * @param {Object} file - Multer file object
 * @param {string[]} allowedTypes - Array of allowed mime types
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateFileUpload(file, allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']) {
  if (!file) {
    return { valid: false, error: 'No file uploaded' };
  }
  
  if (!allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: `Invalid file type. Allowed types: ${allowedTypes.map(t => t.split('/')[1]).join(', ')}` };
  }
  
  return { valid: true, error: null };
}

/**
 * Sanitizes a database error message for client response
 * @param {Error} error - The error object
 * @param {string} fallbackMessage - Fallback message if sanitization is needed
 * @returns {string}
 */
export function sanitizeDbError(error, fallbackMessage = 'An error occurred') {
  if (!error) return fallbackMessage;
  
  const message = error.message || '';
  
  if (message.toLowerCase().includes('unique') || message.toLowerCase().includes('duplicate key')) {
    return 'A record with this value already exists';
  }
  
  if (message.toLowerCase().includes('foreign key') || message.toLowerCase().includes('constraint')) {
    return 'Cannot complete operation due to data dependencies';
  }
  
  if (message.toLowerCase().includes('not null')) {
    return 'Required data is missing';
  }
  
  return fallbackMessage;
}

/**
 * Validates balance value
 * @param {string|number} balance - The balance to validate
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validateBalance(balance) {
  return validateNumber(balance, 'Balance', {
    required: true,
    allowNegative: false,
    min: 0,
    max: 999999999999
  });
}

/**
 * Validates interest rate (percentage)
 * @param {string|number} rate - The interest rate to validate
 * @param {boolean} required - Whether the field is required
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validateInterestRate(rate, required = false) {
  if ((rate === undefined || rate === null || rate === '') && !required) {
    return { valid: true, value: null, error: null };
  }
  
  return validateNumber(rate, 'Interest rate', {
    required,
    allowNegative: false,
    min: 0,
    max: 100
  });
}

/**
 * Validates quantity (for holdings)
 * @param {string|number} quantity - The quantity to validate
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validateQuantity(quantity) {
  return validateNumber(quantity, 'Quantity', {
    required: true,
    allowNegative: false,
    min: 0.00000001,
    max: 999999999999
  });
}

/**
 * Validates price
 * @param {string|number} price - The price to validate
 * @param {boolean} required - Whether the field is required
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validatePrice(price, required = false) {
  if ((price === undefined || price === null || price === '') && !required) {
    return { valid: true, value: null, error: null };
  }
  
  return validateNumber(price, 'Price', {
    required,
    allowNegative: false,
    min: 0,
    max: 999999999
  });
}
