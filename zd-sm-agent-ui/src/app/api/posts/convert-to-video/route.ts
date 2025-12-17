import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthenticatedClient } from '@/lib/auth-middleware';

export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { user, token } = authResult;
  const supabase = createAuthenticatedClient(token);

  try {
    const { sourcePostId, prompt, style, purpose, orientation, duration } = await req.json();

    // Validate
    if (!sourcePostId || !prompt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch source post
    const { data: sourcePost, error: fetchError } = await supabase
      .from('posts_v2')
      .select('*')
      .eq('id', sourcePostId)
      .single();

    if (fetchError || !sourcePost) {
      return NextResponse.json({ error: 'Source post not found' }, { status: 404 });
    }

    // Verify ownership
    if (sourcePost.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Build n8n payload
    const webhookPayload = {
      action: 'convert-to-video',
      userId: user.id,
      sourcePostId,
      sourceImageUrl: sourcePost.image_url,
      prompt,
      style,
      purpose,
      orientation,
      duration,
    };

    // Trigger n8n
    // Replace lines 51-57 with:
const webhookUrl = process.env.N8N_VIDEO_CONVERSION_WEBHOOK;
if (!webhookUrl) {
  return NextResponse.json({ error: 'Webhook URL not configured' }, { status: 500 });
}

const response = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(webhookPayload),
});

    if (!response.ok) throw new Error('Video conversion failed');

    return NextResponse.json({ success: true, message: 'Video generation started' });
  } catch (error: any) {
    console.error('[ConvertToVideo] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}