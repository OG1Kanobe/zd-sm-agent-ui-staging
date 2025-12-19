import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { error: 'Missing userId parameter' },
      { status: 400 }
    );
  }

  const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID;
  const BASE_URL = process.env.BASE_APP_URI;
  const REDIRECT_URI = `${BASE_URL}/api/instagram/callback`;

  if (!INSTAGRAM_APP_ID || !BASE_URL) {
    return NextResponse.json(
      { error: 'Missing environment variables' },
      { status: 500 }
    );
  }

  // Instagram Business Login OAuth URL
  const scopes = [
    'instagram_business_basic',
    'instagram_business_content_publish',
    'instagram_business_manage_messages',
    'instagram_business_manage_comments',
  ].join(',');

  const authUrl = new URL('https://api.instagram.com/oauth/authorize');
  authUrl.searchParams.set('client_id', INSTAGRAM_APP_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', userId); // Pass userId as state

  return NextResponse.json({ success: true, authUrl: authUrl.toString() });
}