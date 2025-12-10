import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('[TikTok Callback] OAuth error:', error, errorDescription);
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
          <head><title>TikTok Login Failed</title></head>
          <body>
            <script>
              window.opener?.postMessage({ 
                success: false, 
                platform: 'tt',
                error: '${errorDescription || error}' 
              }, window.location.origin);
              window.close();
            </script>
            <p>Authentication failed. You can close this window.</p>
          </body>
        </html>
        `,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !state) {
      console.error('[TikTok Callback] Missing code or state');
      return NextResponse.json(
        { error: 'Missing authorization code or state' },
        { status: 400 }
      );
    }

    // Extract userId from state (format: userId_randomString)
    const userId = state.split('_')[0];
    if (!userId) {
      console.error('[TikTok Callback] Invalid state format');
      return NextResponse.json(
        { error: 'Invalid state parameter' },
        { status: 400 }
      );
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!clientKey || !clientSecret || !redirectUri) {
      console.error('[TikTok Callback] Missing OAuth credentials');
      return NextResponse.json(
        { error: 'TikTok OAuth not configured' },
        { status: 500 }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[TikTok Callback] Missing Supabase credentials');
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    console.log('[TikTok Callback] Exchanging code for token...');

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[TikTok Callback] Token exchange failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to exchange authorization code' },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('[TikTok Callback] Token received');

    const {
      access_token,
      expires_in,
      refresh_token,
      refresh_expires_in,
      open_id,
    } = tokenData;

    if (!access_token || !open_id) {
      console.error('[TikTok Callback] Missing access token or open_id');
      return NextResponse.json(
        { error: 'Invalid token response from TikTok' },
        { status: 500 }
      );
    }

    // Get user info from TikTok
    console.log('[TikTok Callback] Fetching user info...');
    const userInfoResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    });

    let tiktokUsername = null;
    let tiktokDisplayName = null;

    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      tiktokUsername = userInfo.data?.user?.username || null;
      tiktokDisplayName = userInfo.data?.user?.display_name || null;
      console.log('[TikTok Callback] User info retrieved:', tiktokUsername);
    } else {
      console.warn('[TikTok Callback] Failed to fetch user info');
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Save to Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[TikTok Callback] Saving to database...');

    // Check if profile exists
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
          tiktok_connected: true,
          tiktok_user_id: open_id,
          tiktok_username: tiktokUsername,
          tiktok_access_token: access_token,
          tiktok_token_expires_at: expiresAt.toISOString(),
          tt_token_expires_at: expiresAt.toISOString(), // For consistency with other platforms
          updated_at: new Date().toISOString(),
        })
        .eq('client_id', userId);

      if (updateError) {
        console.error('[TikTok Callback] Database update error:', updateError);
        return NextResponse.json(
          { error: 'Failed to save TikTok connection' },
          { status: 500 }
        );
      }
    } else {
      // Create new profile
      const { error: insertError } = await supabase
        .from('user_social_profiles')
        .insert({
          client_id: userId,
          tiktok_connected: true,
          tiktok_user_id: open_id,
          tiktok_username: tiktokUsername,
          tiktok_access_token: access_token,
          tiktok_token_expires_at: expiresAt.toISOString(),
          tt_token_expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error('[TikTok Callback] Database insert error:', insertError);
        return NextResponse.json(
          { error: 'Failed to save TikTok connection' },
          { status: 500 }
        );
      }
    }

    console.log('[TikTok Callback] Successfully connected TikTok for user:', userId);

    // Return HTML that closes popup and notifies parent window
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head><title>TikTok Connected</title></head>
        <body>
          <script>
            window.opener?.postMessage({ 
              success: true, 
              platform: 'tt'
            }, window.location.origin);
            window.close();
          </script>
          <p>TikTok connected successfully! You can close this window.</p>
        </body>
      </html>
      `,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('[TikTok Callback] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}