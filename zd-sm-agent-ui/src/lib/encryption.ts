import crypto from 'crypto';

/**
 * Encryption utilities for API keys using AES-256-GCM
 * 
 * SECURITY NOTES:
 * - Uses AES-256-GCM for authenticated encryption
 * - Generates random IV for each encryption
 * - Stores IV with ciphertext for decryption
 * - Key derived from environment variable
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get encryption key from environment variable
 * Derives a proper 256-bit key using PBKDF2
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  
  if (!secret) {
    throw new Error('API_KEY_ENCRYPTION_SECRET environment variable is not set');
  }
  
  if (secret.length < 32) {
    throw new Error('API_KEY_ENCRYPTION_SECRET must be at least 32 characters');
  }
  
  // Use a fixed salt for key derivation (so same secret always produces same key)
  const fixedSalt = Buffer.from('supabase-api-keys-encryption-v1', 'utf-8');
  
  // Derive a 256-bit key using PBKDF2
  return crypto.pbkdf2Sync(secret, fixedSalt, 100000, 32, 'sha256');
}

/**
 * Encrypt a plaintext string (API key)
 * Returns base64-encoded string containing IV + auth tag + ciphertext
 */
export function encryptApiKey(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV + authTag + encrypted data
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]);
    
    return combined.toString('base64');
  } catch (error) {
    console.error('[Encryption] Encryption failed:', error);
    throw new Error('Failed to encrypt API key');
  }
}

/**
 * Decrypt an encrypted API key
 * Expects base64-encoded string containing IV + auth tag + ciphertext
 */
export function decryptApiKey(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract IV, auth tag, and encrypted data
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[Encryption] Decryption failed:', error);
    throw new Error('Failed to decrypt API key');
  }
}

/**
 * Get last 4 characters of API key for display
 */
export function getLastFourChars(apiKey: string): string {
  if (!apiKey || apiKey.length < 4) {
    return '****';
  }
  return apiKey.slice(-4);
}

/**
 * Validate API key format for different providers
 */
export function validateApiKeyFormat(provider: string, apiKey: string): boolean {
  const patterns: Record<string, RegExp> = {
    openai: /^sk-[a-zA-Z0-9]{48}$/,
    gemini: /^AIza[a-zA-Z0-9_-]{35}$/,
    perplexity: /^pplx-[a-zA-Z0-9]{32,}$/,
    anthropic: /^sk-ant-[a-zA-Z0-9-_]{95}$/,
  };
  
  const pattern = patterns[provider];
  if (!pattern) {
    console.warn(`[Encryption] No validation pattern for provider: ${provider}`);
    return true; // Allow if we don't have a pattern yet
  }
  
  return pattern.test(apiKey);
}

/**
 * Mask API key for safe logging
 * Shows first 4 and last 4 characters only
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) {
    return '****-****';
  }
  const first4 = apiKey.slice(0, 4);
  const last4 = apiKey.slice(-4);
  return `${first4}...${last4}`;
}