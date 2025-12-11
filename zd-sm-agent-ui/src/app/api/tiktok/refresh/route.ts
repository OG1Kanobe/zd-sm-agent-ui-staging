import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!clientKey || !clientSecret) {
      return NextResponse.json(
        { error: 'TikTok OAuth not configured' },
        { status: 500 }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Get refresh token from database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: profile, error: profileError } = await supabase
      .from('user_social_profiles')
      .select('tiktok_refresh_token')
      .eq('client_id', userId)
      .single();

    if (profileError || !profile?.tiktok_refresh_token) {
      console.error('[TikTok Refresh] No refresh token found');
      return NextResponse.json(
        { error: 'No refresh token found. Please reconnect TikTok.' },
        { status: 404 }
      );
    }

    console.log('[TikTok Refresh] Refreshing token for user:', userId);

    // Exchange refresh token for new access token
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: profile.tiktok_refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[TikTok Refresh] Token refresh failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to refresh token. Please reconnect TikTok.' },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    const responseData = tokenData.data || tokenData;

    const {
      access_token,
      expires_in,
      refresh_token: newRefreshToken,
      refresh_expires_in,
    } = responseData;

    if (!access_token) {
      console.error('[TikTok Refresh] No access token in response');
      return NextResponse.json(
        { error: 'Invalid refresh response' },
        { status: 500 }
      );
    }

    // Calculate new expiry times
    const expiresAt = new Date(Date.now() + expires_in * 1000);
    const refreshExpiresAt = refresh_expires_in
      ? new Date(Date.now() + refresh_expires_in * 1000)
      : null;

    // Update tokens in database
    const { error: updateError } = await supabase
      .from('user_social_profiles')
      .update({
        tiktok_access_token: access_token,
        tiktok_refresh_token: newRefreshToken || profile.tiktok_refresh_token,
        tiktok_token_expires_at: expiresAt.toISOString(),
        tiktok_refresh_token_expires_at: refreshExpiresAt?.toISOString() || null,
        tt_token_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', userId);

    if (updateError) {
      console.error('[TikTok Refresh] Database update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to save refreshed token' },
        { status: 500 }
      );
    }

    console.log('[TikTok Refresh] Token refreshed successfully');

    return NextResponse.json({
      success: true,
      expires_at: expiresAt.toISOString(),
    });

  } catch (error) {
    console.error('[TikTok Refresh] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}