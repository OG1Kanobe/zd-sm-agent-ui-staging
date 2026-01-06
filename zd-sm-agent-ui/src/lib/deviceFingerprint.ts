/**
 * Generate a semi-unique device fingerprint based on browser characteristics
 * Used for "Remember this device" functionality
 */

export function generateDeviceFingerprint(): string {
  if (typeof window === 'undefined') {
    return 'server-side-render';
  }

  const data = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages?.join(',') || '',
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    screenColorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack || 'unspecified',
  };

  // Convert to string and hash
  const fingerprint = JSON.stringify(data);
  return simpleHash(fingerprint);
}

/**
 * Simple hash function for fingerprint data
 * (Not cryptographically secure, just for device identification)
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36); // Convert to base36 string
}

/**
 * Get a human-readable device description
 */
export function getDeviceInfo(): {
  browser: string;
  os: string;
  device: string;
} {
  if (typeof window === 'undefined') {
    return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
  }

  const ua = navigator.userAgent;

  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  else if (ua.includes('Opera')) browser = 'Opera';

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS')) os = 'iOS';

  // Detect device type
  let device = 'Desktop';
  if (/Mobi|Android/i.test(ua)) device = 'Mobile';
  else if (/Tablet|iPad/i.test(ua)) device = 'Tablet';

  return { browser, os, device };
}

/**
 * Generate a device token (random UUID)
 * This is stored in localStorage and the database
 */
export function generateDeviceToken(): string {
  return crypto.randomUUID();
}