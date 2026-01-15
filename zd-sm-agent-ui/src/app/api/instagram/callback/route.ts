import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServerClient';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const userId = searchParams.get('state'); // client_id from state
    const error = searchParams.get('error');
    const errorReason = searchParams.get('error_reason');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('Instagram OAuth error:', {
        error,
        errorReason,
        errorDescription,
      });
      
      return new Response(
        `<script>
          if (window.opener) {
            window.opener.postMessage({ 
              success: false, 
              platform: 'ig',
              error: '${errorDescription || error}'
            }, window.location.origin);
            window.close();
          } else {
            document.body.innerText = 'Authorization failed: ${errorDescription || error}. You can close this tab.';
          }
        </script>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !userId) {
      return new Response('Missing code or userId', { status: 400 });
    }

    // Validate userId format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return new Response('Invalid user ID format', { status: 400 });
    }

    const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID;
    const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
    const BASE_URL = process.env.BASE_APP_URI;
    const REDIRECT_URI = `${BASE_URL}/api/instagram/callback`;

    if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET || !BASE_URL) {
      return new Response('Server configuration error', { status: 500 });
    }

    // Step 1: Exchange code for short-lived token
    const tokenUrl = new URL('https://api.instagram.com/oauth/access_token');
    
    const tokenParams = new URLSearchParams({
      client_id: INSTAGRAM_APP_ID,
      client_secret: INSTAGRAM_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code: code,
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Failed to get access token:', tokenData);
      return new Response('Failed to get access token', { status: 400 });
    }

    const shortLivedToken = tokenData.access_token;
    const instagramUserId = tokenData.user_id;

    // Step 2: Exchange for long-lived token (60 days)
    const longLivedUrl = new URL('https://graph.instagram.com/access_token');
    longLivedUrl.searchParams.set('grant_type', 'ig_exchange_token');
    longLivedUrl.searchParams.set('client_secret', INSTAGRAM_APP_SECRET);
    longLivedUrl.searchParams.set('access_token', shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl);
    const longLivedData = await longLivedRes.json();

    if (!longLivedRes.ok || !longLivedData.access_token) {
      console.error('Failed to get long-lived token:', longLivedData);
      return new Response('Failed to get long-lived token', { status: 400 });
    }

    const longLivedToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in; // Seconds until expiry (typically 5184000 = 60 days)

    // Calculate expiration date
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Step 3: Get Instagram account details
    const profileUrl = `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${longLivedToken}`;


    const profileRes = await fetch(profileUrl);
    const profileData = await profileRes.json();

    console.log('[Instagram] Profile response:', profileData); // DEBUG

if (!profileRes.ok || profileData.error) {
  console.error('Failed to get Instagram profile:', profileData);
  return new Response(
    `<script>
      if (window.opener) {
        window.opener.postMessage({ 
          success: false, 
          platform: 'ig',
          error: 'Failed to get profile: ${profileData.error?.message || "Unknown error"}'
        }, window.location.origin);
        window.close();
      } else {
        document.body.innerText = 'Failed to get Instagram profile. Error: ${profileData.error?.message || "Unknown error"}';
      }
    </script>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

    // Step 4: Save to database using service role
    const { error: dbError } = await supabaseServer
      .from('user_social_profiles')
      .upsert(
        {
          client_id: userId,
          instagram_connected: true,
          instagram_user_id: profileData.id,
          instagram_username: profileData.username,
          instagram_account_type: profileData.account_type, // BUSINESS, CREATOR, or PERSONAL
          instagram_access_token: longLivedToken,
          ig_token_expires_at: expiresAt,
        },
        { onConflict: 'client_id' }
      );

    if (dbError) {
      console.error('Supabase upsert error:', dbError, { userId });
      return new Response('Database error', { status: 500 });


    }

    // Step 5: Close popup and notify parent
    return new Response(
      `<script>
        if (window.opener) {
          window.opener.postMessage({ 
            success: true, 
            platform: 'ig',
            username: '${profileData.username}'
          }, window.location.origin);
          window.close();
        } else {
          document.body.innerText = 'Connected Instagram successfully (@${profileData.username}). You can close this tab.';
        }
      </script>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (err) {
    console.error('Instagram callback error:', err);
    return new Response('Internal server error', { status: 500 });
  }
}