/**
 * Sensitive Field Redaction
 * 
 * Redacts sensitive fields from payloads before logging.
 * Must redact: passwords, tokens, API keys, SSNs, credit cards, etc.
 */

export const SENSITIVE_FIELDS = [
  'password',
  'passwd',
  'token',
  'apikey',
  'api_key',
  'apiKey',
  'authorization',
  'auth',
  'bearer',
  'ssn',
  'social_security',
  'socialSecurity',
  'credit_card',
  'creditCard',
  'card_number',
  'cardNumber',
  'cvv',
  'cvc',
  'secret',
  'private_key',
  'privateKey',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'session_token',
  'sessionToken',
  'jwt',
  'cookie',
  'x-api-key',
  'x-auth-token'
];

/**
 * Recursively redacts sensitive fields from an object.
 * Creates a deep copy - does not mutate the original.
 */
export function redactSensitiveFields(payload: Record<string, unknown>): Record<string, unknown> {
  const redacted = JSON.parse(JSON.stringify(payload)); // Deep clone
  
  function redactRecursive(obj: Record<string, unknown>, path: string = '') {
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      const currentPath = path ? `${path}.${key}` : key;
      
      // Check if key matches any sensitive field
      const isSensitive = SENSITIVE_FIELDS.some(field => 
        lowerKey === field.toLowerCase() || 
        lowerKey.includes(field.toLowerCase())
      );
      
      if (isSensitive) {
        obj[key] = '[REDACTED]';
      } else if (Array.isArray(obj[key])) {
        // Handle arrays
        const arr = obj[key] as unknown[];
        for (let i = 0; i < arr.length; i++) {
          if (typeof arr[i] === 'object' && arr[i] !== null) {
            redactRecursive(arr[i] as Record<string, unknown>, `${currentPath}[${i}]`);
          }
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        redactRecursive(obj[key] as Record<string, unknown>, currentPath);
      }
    }
  }
  
  redactRecursive(redacted);
  return redacted;
}

/**
 * Checks if a string looks like a credit card number.
 * Uses Luhn algorithm for basic validation.
 */
export function looksLikeCreditCard(value: string): boolean {
  // Remove spaces and dashes
  const cleaned = value.replace(/[\s-]/g, '');
  
  // Must be 13-19 digits
  if (!/^\d{13,19}$/.test(cleaned)) {
    return false;
  }
  
  // Luhn check
  let sum = 0;
  let isEven = false;
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

/**
 * Checks if a string looks like a US SSN.
 */
export function looksLikeSSN(value: string): boolean {
  // Format: XXX-XX-XXXX or XXXXXXXXX
  const cleaned = value.replace(/[\s-]/g, '');
  return /^\d{9}$/.test(cleaned);
}
