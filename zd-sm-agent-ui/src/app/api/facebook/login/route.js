// src/app/api/facebook/login/route.js
import { NextResponse } from 'next/server';

export async function GET(req) {
  const FB_APP_ID = process.env.FB_APP_ID;
  const BASE_URL = process.env.BASE_APP_URI;

  const userId = req.nextUrl.searchParams.get('userId'); 
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Missing user ID' }, { status: 400 });
  }

  const REDIRECT_URI = `${BASE_URL}/api/facebook/callback`;

  const scope = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'instagram_basic',
    'instagram_content_publish',
    'business_management'
  ].join(',');

  const authUrl =
    `https://www.facebook.com/v20.0/dialog/oauth` +
    `?client_id=${FB_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${scope}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(userId)}`;

  return NextResponse.json({ success: true, authUrl });
}
