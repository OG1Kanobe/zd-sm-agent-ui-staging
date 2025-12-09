// src/app/api/facebook/callback/route.js
import { supabaseServer } from '@/lib/supabaseServerClient';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const userId = searchParams.get('state'); // This is the user_id

    if (!code || !userId) {
      return new Response('Missing code or userId', { status: 400 });
    }

    // VALIDATE: Ensure userId is a valid UUID format (basic security check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return new Response('Invalid user ID format', { status: 400 });
    }

    const FB_APP_ID = process.env.FB_APP_ID;
    const FB_APP_SECRET = process.env.FB_APP_SECRET;
    const BASE_URL = process.env.BASE_APP_URI;
    const REDIRECT_URI = `${BASE_URL}/api/facebook/callback`;

    // Step 1: Get short-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token` +
        `?client_id=${FB_APP_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&client_secret=${FB_APP_SECRET}` +
        `&code=${code}`
    );
    const data = await tokenRes.json();
    if (!data.access_token) {
      return new Response('Failed to get access token', { status: 400 });
    }
    const shortLivedToken = data.access_token;

    // Step 2: Exchange for long-lived token
    const longRes = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token` +
        `?grant_type=fb_exchange_token` +
        `&client_id=${FB_APP_ID}` +
        `&client_secret=${FB_APP_SECRET}` +
        `&fb_exchange_token=${shortLivedToken}`
    );
    const longData = await longRes.json();
    const longLivedToken = longData.access_token;

    const expiresAt = longData.expires_in
      ? new Date(Date.now() + longData.expires_in * 1000).toISOString()
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    // Step 3: Fetch Facebook pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v20.0/me/accounts?access_token=${longLivedToken}`
    );
    const pagesData = await pagesRes.json();
    const firstPage = pagesData.data?.[0] || null;

    // Step 4: UPSERT (service role is OK here - this is OAuth callback)
    const { error: dbError } = await supabaseServer
      .from('user_social_profiles')
      .upsert(
        {
          client_id: userId,
          facebook_user_id: firstPage?.id || null,
          page_id: firstPage?.id || null,
          page_name: firstPage?.name || null,
          page_access_token: firstPage?.access_token || null,
          long_lived_access_token: longLivedToken,
          fb_token_expires_at: expiresAt,
          facebook_connected: true,
        },
        { onConflict: ['client_id'] }
      );

    if (dbError) {
      console.error('Supabase upsert error:', dbError, { userId });
      return new Response('Database error', { status: 500 });

    }

    // Step 5: Close popup
    return new Response(
      `<script>
        if (window.opener) {
          window.opener.postMessage({ success: true, platform: 'fb' }, window.location.origin);
          window.close();
        } else {
          document.body.innerText = 'Connected successfully. You can close this tab.';
        }
      </script>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (err) {
    console.error('Facebook callback error:', err);
    return new Response('Internal server error', { status: 500 });
  }
}