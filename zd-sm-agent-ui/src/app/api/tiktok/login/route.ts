import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Manual base64url encoding (in case Node version doesn't support .toString('base64url'))
function base64urlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Helper function to generate code verifier  
function generateCodeVerifier(): string {
  const buffer = crypto.randomBytes(32);
  // Try native base64url first, fallback to manual
  try {
    return buffer.toString('base64url');
  } catch {
    return base64urlEncode(buffer);
  }
}

// Helper function to generate code challenge from verifier
function generateCodeChallenge(verifier: string): string {
  // CRITICAL: Must encode as UTF-8 buffer before hashing
  const hash = crypto.createHash('sha256').update(verifier, 'utf8').digest();
  // Try native base64url first, fallback to manual
  try {
    return hash.toString('base64url');
  } catch {
    return base64urlEncode(hash);
  }
}

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

    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    console.log('[TikTok Login] PKCE values:', {
      codeVerifierFull: codeVerifier,
      codeVerifierLength: codeVerifier.length,
      codeChallengeFull: codeChallenge,
      codeChallengeLength: codeChallenge.length,
    });

    // Generate random state for CSRF protection (includes code_verifier for callback)
    const state = `${userId}||${codeVerifier}||${Math.random().toString(36).substring(7)}`;

    console.log('[TikTok Login] State:', {
      fullLength: state.length,
    });

    // TikTok OAuth scopes - try with just one scope for testing
    const scopes = 'user.info.basic';

    // Build TikTok OAuth URL with PKCE
    // Parameters in the exact order from TikTok docs
    const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    authUrl.searchParams.append('client_key', clientKey);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');

    console.log('[TikTok Login] Auth URL params:', {
      client_key: clientKey.substring(0, 10) + '...',
      response_type: 'code',
      scope: scopes,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    console.log('[TikTok Login] Generated auth URL with PKCE for user:', userId);

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