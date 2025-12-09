// src/app/api/facebook/login/route.js
export async function GET(req) {
  const FB_APP_ID = process.env.FB_APP_ID;
  const BASE_URL = process.env.BASE_APP_URI; // e.g., https://smagent.zenithdigi.co.za

  // Pass user ID as state so callback knows which user to update
  const userId = req.nextUrl.searchParams.get('userId'); 
  if (!userId) return new Response('Missing user ID', { status: 400 });

  const REDIRECT_URI = `${BASE_URL}/api/facebook/callback`;

  const scope = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'instagram_basic',
    'instagram_content_publish',
    'business_management'
  ].join(',');

  const oauthUrl =
    `https://www.facebook.com/v20.0/dialog/oauth` +
    `?client_id=${FB_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${scope}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(userId)}`;

  return new Response(null, {
    status: 302,
    headers: { Location: oauthUrl }
  });
}
