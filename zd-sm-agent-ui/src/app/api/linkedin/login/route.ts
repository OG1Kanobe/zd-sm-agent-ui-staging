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

  const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
  const BASE_URL = process.env.BASE_APP_URI;
  const REDIRECT_URI = `${BASE_URL}/api/linkedin/callback`;

  if (!LINKEDIN_CLIENT_ID || !BASE_URL) {
    return NextResponse.json(
      { error: 'Missing environment variables' },
      { status: 500 }
    );
  }

  // LinkedIn OAuth 2.0 Authorization URL with organization scopes
  const scopes = [
    'openid',
    'profile',
    'email',
    'w_member_social',        // Post to personal profile
    'w_organization_social',  // Post to organization pages
    'r_organization_social',  // Read organization data
    'rw_organization_admin',  // Manage organization (optional, for extra permissions)
  ].join(' ');

  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', LINKEDIN_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('state', userId);

 return NextResponse.json({ success: true, authUrl: authUrl.toString() });
}