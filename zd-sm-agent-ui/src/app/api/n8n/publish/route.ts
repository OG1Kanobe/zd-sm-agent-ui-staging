import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthenticatedClient } from '@/lib/auth-middleware';

export async function POST(req: NextRequest) {
  // 1. AUTHENTICATE
  const authResult = await authenticateRequest(req);
  if ('error' in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const { user, token } = authResult;
  const supabase = createAuthenticatedClient(token);

  try {
    // 2. PARSE BODY
    const body = await req.json();
    const { 
      ig_publish,      // post ID or null
      fb_publish,      // post ID or null
      li_publish,      // post ID or null (renamed from linkedin_publish)
      tt_publish,      // post ID or null
      userId 
    } = body;

    // Validate that at least one post ID is provided
    if (!ig_publish && !fb_publish && !li_publish && !tt_publish) {
      return NextResponse.json(
        { error: 'Must provide at least one post ID to publish' },
        { status: 400 }
      );
    }

    // Verify userId matches authenticated user
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // 3. COLLECT ALL POST IDs
    const postIds = [ig_publish, fb_publish, li_publish, tt_publish].filter(Boolean);

    // 4. VERIFY OWNERSHIP OF ALL POSTS (RLS + extra check)
    const { data: posts, error: fetchError } = await supabase
      .from('posts_v2') //latest change - changed to new posts table
      .select('id, user_id, platform')
      .in('id', postIds);

    if (fetchError || !posts || posts.length === 0) {
      console.error('[Publish API] Failed to fetch posts:', fetchError);
      return NextResponse.json(
        { error: 'Posts not found or access denied' },
        { status: 404 }
      );
    }

    // Verify all posts belong to this user
    const invalidPosts = posts.filter(p => p.user_id !== user.id);
    if (invalidPosts.length > 0) {
      return NextResponse.json(
        { error: 'You do not have permission to publish these posts' },
        { status: 403 }
      );
    }

    // 5. FETCH USER'S CLIENT CONFIG FOR LINKEDIN ORG
    const { data: configData } = await supabase
      .from('client_configs')
      .select('linkedin_organization_urn')
      .eq('client_id', user.id)
      .single();

    const linkedinOrgUrn = configData?.linkedin_organization_urn || null;

    // 6. BUILD WEBHOOK PAYLOAD (NEW FORMAT)
    const webhookPayload = {
      // Post IDs (not booleans)
      ig_publish: ig_publish || null,
      fb_publish: fb_publish || null,
      li_publish: li_publish || null,
      tt_publish: tt_publish || null,
      
      // User info
      userId: user.id,
      
      // LinkedIn org (for company page posting)
      linkedin_organization_urn: linkedinOrgUrn,
      
      // Action type
      action: 'publish',
    };

    console.log('[Publish API] Webhook payload:', {
      ...webhookPayload,
      postCount: postIds.length,
      platforms: posts.map(p => p.platform),
    });

    // 7. TRIGGER WEBHOOK
    const webhookUrl = process.env.N8N_ON_DEMAND_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('[Publish API] Webhook URL not configured');
      return NextResponse.json(
        { error: 'Webhook URL not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[Publish API] Webhook failed:', text);
      return NextResponse.json(
        { error: `Webhook failed: ${text}` },
        { status: 500 }
      );
    }

    const responseData = await response.json().catch(() => ({}));
    console.log('[Publish API] Webhook success:', responseData);

    return NextResponse.json({ 
      success: true,
      message: `Publishing ${postIds.length} post(s) to n8n`,
      postIds,
    });

  } catch (err: any) {
    console.error('[Publish API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}