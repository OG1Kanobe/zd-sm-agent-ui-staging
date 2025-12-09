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
    const { postId, fb_publish, ig_publish, linkedin_publish } = body;

    if (!postId) {
      return NextResponse.json(
        { error: 'Missing postId in request body' },
        { status: 400 }
      );
    }

    // 3. FETCH POST (RLS will ensure user owns this post)
    const { data: postData, error: fetchError } = await supabase
      .from('posts')
      .select('id, user_id, created_at')
      .eq('id', postId)
      .single();

    if (fetchError || !postData) {
      console.error('Failed to fetch post:', fetchError);
      return NextResponse.json(
        { error: 'Post not found or access denied' },
        { status: 404 }
      );
    }

    // 4. VERIFY OWNERSHIP (extra safety check)
    if (postData.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to publish this post' },
        { status: 403 }
      );
    }

    // 5. FETCH USER'S CLIENT CONFIG TO GET LINKEDIN ORG
    const { data: configData } = await supabase
      .from('client_configs')
      .select('linkedin_organization_urn')
      .eq('client_id', user.id)
      .single();

    const linkedinOrgUrn = configData?.linkedin_organization_urn || null;

    // 6. BUILD WEBHOOK PAYLOAD
    const webhookPayload = {
      client_id: postData.user_id,
      post_id: postData.id,
      created_at: postData.created_at,
      action: 'publish',
      fb_publish: !!fb_publish,
      ig_publish: !!ig_publish,
      linkedin_publish: !!linkedin_publish,
      linkedin_organization_urn: linkedinOrgUrn, // ← NOW IT EXISTS!
    };

    console.log('[Publish API] Webhook payload:', webhookPayload);

    // 7. TRIGGER WEBHOOK
    const webhookUrl = process.env.N8N_ON_DEMAND_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('Webhook URL not configured');
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
      console.error('Webhook failed:', text);
      return NextResponse.json(
        { error: `Webhook failed: ${text}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Publish API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}