import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/google/callback
 * Handles Google OAuth callback
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This is the userId
    const error = searchParams.get('error');

    if (error) {
      console.error('[Google OAuth] Callback error:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'https://zd-sm-agent-ui-staging.vercel.app'}/integrations?error=oauth_denied`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'https://zd-sm-agent-ui-staging.vercel.app'}/integrations?error=missing_params`
      );
    }

    const userId = state;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('[Google OAuth] Token exchange failed:', errorData);
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    if (!refresh_token) {
      console.error('[Google OAuth] No refresh token received');
      throw new Error('No refresh token received');
    }

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const userInfo = await userInfoResponse.json();
    const { email, name, id: googleUserId } = userInfo;

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Check if user already has Google connected
    const { data: existingProfile } = await supabase
      .from('user_social_profiles')
      .select('id')
      .eq('client_id', userId)
      .single();

    if (existingProfile) {
      // Update existing profile
      const { error: updateError } = await supabase
        .from('user_social_profiles')
        .update({
          google_connected: true,
          google_user_id: googleUserId,
          google_email: email,
          google_name: name,
          google_access_token: access_token,
          google_refresh_token: refresh_token,
          google_token_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('client_id', userId);

      if (updateError) throw updateError;
    } else {
      // Create new profile
      const { error: insertError } = await supabase
        .from('user_social_profiles')
        .insert({
          client_id: userId,
          google_connected: true,
          google_user_id: googleUserId,
          google_email: email,
          google_name: name,
          google_access_token: access_token,
          google_refresh_token: refresh_token,
          google_token_expires_at: expiresAt.toISOString()
        });

      if (insertError) throw insertError;
    }

    console.log(`[Google OAuth] Successfully connected Google account for user ${userId}`);

    // Redirect back to integrations page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://zd-sm-agent-ui-staging.vercel.app'}/integrations?success=google_connected`
    );
  } catch (error: any) {
    console.error('[Google OAuth] Callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://zd-sm-agent-ui-staging.vercel.app'}/integrations?error=connection_failed`
    );
  }
}