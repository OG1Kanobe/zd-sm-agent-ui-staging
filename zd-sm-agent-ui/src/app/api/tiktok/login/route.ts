import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;

    if (!clientKey || !redirectUri) {
      console.error('[TikTok] Missing environment variables');
      return NextResponse.json(
        { error: 'TikTok OAuth not configured' },
        { status: 500 }
      );
    }

    // Generate random state for CSRF protection
    const state = `${userId}_${Math.random().toString(36).substring(7)}`;

    // TikTok OAuth scopes
    const scopes = [
      'user.info.basic',      // Get user profile info
      'video.publish',        // Publish videos
      'video.upload',         // Upload videos
    ].join(',');

    // Build TikTok OAuth URL
    const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    authUrl.searchParams.append('client_key', clientKey);
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', state);

    console.log('[TikTok Login] Generated auth URL for user:', userId);

    // Return the auth URL (frontend will open in popup)
    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString(),
    });

  } catch (error) {
    console.error('[TikTok Login] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate TikTok auth URL' },
      { status: 500 }
    );
  }
}