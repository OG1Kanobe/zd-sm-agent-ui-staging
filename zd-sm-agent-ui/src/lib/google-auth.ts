import { supabaseServer } from '@/lib/supabaseServerClient';


/**
 * Get a valid Google access token for a user
 * Automatically refreshes if expired
 */
export async function getGoogleAccessToken(userId: string): Promise<string | null> {
  try {
    // Fetch user's Google tokens
    const { data: profile, error } = await supabaseServer
      .from('user_social_profiles')
      .select('google_access_token, google_refresh_token, google_token_expires_at')
      .eq('client_id', userId)
      .single();

    if (error || !profile) {
      console.error('[Google Auth] No profile found for user:', userId);
      return null;
    }

    if (!profile.google_refresh_token) {
      console.error('[Google Auth] No refresh token available');
      return null;
    }

    // Check if token is still valid (with 5 min buffer)
    const expiresAt = new Date(profile.google_token_expires_at);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes

    if (expiresAt.getTime() > now.getTime() + bufferTime) {
      // Token is still valid
      return profile.google_access_token;
    }

    // Token expired, refresh it
    console.log('[Google Auth] Access token expired, refreshing...');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: profile.google_refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('[Google Auth] Token refresh failed:', errorData);
      return null;
    }

    const tokens = await tokenResponse.json();
    const { access_token, expires_in } = tokens;

    // Calculate new expiry
    const newExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Update database with new token
    const { error: updateError } = await supabaseServer
      .from('user_social_profiles')
      .update({
        google_access_token: access_token,
        google_token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('client_id', userId);

    if (updateError) {
      console.error('[Google Auth] Failed to update token:', updateError);
      return null;
    }

    console.log('[Google Auth] Token refreshed successfully');
    return access_token;
  } catch (error: any) {
    console.error('[Google Auth] Error getting access token:', error);
    return null;
  }
}