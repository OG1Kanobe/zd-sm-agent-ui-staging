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
      sourcePostId,
      sourceImageUrl,
      duration
    } = body;

    // 3. VALIDATION
    if (!sourcePostId) {
      return NextResponse.json(
        { error: 'Missing sourcePostId' },
        { status: 400 }
      );
    }

    if (!sourceImageUrl) {
      return NextResponse.json(
        { error: 'Missing sourceImageUrl' },
        { status: 400 }
      );
    }

    // 4. FETCH SOURCE POST
    const { data: sourcePost, error: fetchError } = await supabase
      .from('posts_v2')
      .select('id, user_id, content_group_id, caption, topic,  category, tags, platform, orientation, animated_version_id,animate_prompt')
      .eq('id', sourcePostId)
      .single();

    if (fetchError || !sourcePost) {
      console.error('[AnimateImage] Source post not found:', fetchError);
      return NextResponse.json(
        { error: 'Source post not found' },
        { status: 404 }
      );
    }

    // 5. VERIFY OWNERSHIP
    if (sourcePost.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 6. CHECK IF ALREADY HAS ANIMATED VERSION
    if (sourcePost.animated_version_id) {
      return NextResponse.json(
        { error: 'This post already has an animated version' },
        { status: 409 }
      );
    }

    // 7. BUILD WEBHOOK PAYLOAD
    const webhookPayload = {
      action: 'animate-image',
      
      // IDs
      userId: user.id,
      sourcePostId: sourcePost.id,
      contentGroupId: sourcePost.content_group_id,
      
      // Source content
      sourceImageUrl,
      caption: sourcePost.caption,
      topic: sourcePost.topic,
      
      // Metadata (inherited from original)
      category: sourcePost.category,
      tags: sourcePost.tags,
      originalPlatform: sourcePost.platform,
      
      // Animation settings
      duration: duration || '5',
      orientation: sourcePost.orientation || '9:16',
      animationPrompt: sourcePost.animate_prompt || null,  // Future use
      
      // Timestamp
      executedAt: new Date().toISOString(),
    };

    console.log('[AnimateImage] Webhook payload:', JSON.stringify(webhookPayload, null, 2));

    // 8. TRIGGER WEBHOOK
    const webhookUrl = process.env.N8N_ANIMATE_IMAGE_WEBHOOK;
    if (!webhookUrl) {
      console.error('[AnimateImage] Webhook URL not configured');
      return NextResponse.json(
        { error: 'Animation service unavailable' },
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
      console.error('[AnimateImage] Webhook failed:', text);
      return NextResponse.json(
        { error: `Animation request failed: ${text}` },
        { status: 500 }
      );
    }

    const responseData = await response.json().catch(() => ({}));
    console.log('[AnimateImage] Webhook success:', responseData);

    return NextResponse.json({
      success: true,
      message: 'Image animation started',
      sourcePostId: sourcePost.id
    });

  } catch (err: any) {
    console.error('[AnimateImage] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}