/**
 * Feature Flags System
 * 
 * Controls visibility of V1/V2/V3 features based on user IDs
 * Configured via Vercel environment variables
 * 
 * Environment Variables Required:
 * - ADMIN_USER_ID: Your user ID (full V3 access)
 * - V2_FEATURES_ENABLED_FOR: Comma-separated list of user IDs with V2 access
 * - V3_FEATURES_ENABLED_FOR: Comma-separated list of user IDs with V3 access
 */

/**
 * Check if user is admin (has full access to all features)
 */
export function isAdmin(userId: string | undefined): boolean {
  if (!userId) return false;
  return userId === process.env.ADMIN_USER_ID;
}

/**
 * Check if user has access to V2 features
 * V2 Features:
 * - Edit caption drawer
 * - Regenerate caption with AI
 * - Edit image drawer
 * - Convert image → social post
 * - Convert image → video
 * - Feedback collection
 * - Category/tag editing
 */
export function hasV2Features(userId: string | undefined): boolean {
  if (!userId) return false;
  
  // Admin always has V2 access
  if (isAdmin(userId)) return true;
  
  const enabledUsers = process.env.V2_FEATURES_ENABLED_FOR?.split(',').map(id => id.trim()) || [];
  return enabledUsers.includes(userId);
}

/**
 * Check if user has access to V3 features
 * V3 Features:
 * - Cost tracking stats (expandable with provider breakdown)
 * - Stacked card animation for grouped content
 * - Manual content grouping
 * - Advanced analytics
 * - Drag & drop features
 */
export function hasV3Features(userId: string | undefined): boolean {
  if (!userId) return false;
  
  // Admin always has V3 access
  if (isAdmin(userId)) return true;
  
  const enabledUsers = process.env.V3_FEATURES_ENABLED_FOR?.split(',').map(id => id.trim()) || [];
  return enabledUsers.includes(userId);
}

/**
 * Get all feature flags for a user at once
 * Useful for passing to client components
 */
export interface FeatureFlags {
  isAdmin: boolean;
  hasV2: boolean;
  hasV3: boolean;
}

export function getFeatureFlags(userId: string | undefined): FeatureFlags {
  return {
    isAdmin: isAdmin(userId),
    hasV2: hasV2Features(userId),
    hasV3: hasV3Features(userId),
  };
}

/**
 * Server-side function to get feature flags
 * Use this in Server Components or API routes
 */
export async function getServerFeatureFlags(userId: string | undefined): Promise<FeatureFlags> {
  return getFeatureFlags(userId);
}