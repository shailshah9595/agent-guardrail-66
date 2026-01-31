/**
 * Policy Hashing Utility
 * 
 * Computes SHA-256 hash of policy specification for immutability verification.
 * Used to ensure policies haven't been tampered with.
 */

/**
 * Compute SHA-256 hash of a string.
 * Works in browser environment using SubtleCrypto.
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute policy hash for immutability verification.
 * Normalizes JSON by sorting keys to ensure consistent hashing.
 */
export async function computePolicyHash(policySpec: Record<string, unknown>): Promise<string> {
  // Deep sort all keys for consistent hashing
  const sortedJson = JSON.stringify(sortObjectKeys(policySpec));
  return sha256(sortedJson);
}

/**
 * Recursively sort object keys for consistent JSON serialization.
 */
function sortObjectKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  
  if (obj !== null && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  
  return obj;
}
