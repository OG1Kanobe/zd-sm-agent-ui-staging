import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthenticatedClient } from '@/lib/auth-middleware';
import { v4 as uuidv4 } from 'uuid';

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
    const { postId, contentGroupId } = body;

    if (!postId) {
      return NextResponse.json(
        { error: 'Missing postId' },
        { status: 400 }
      );
    }

    // 3. FETCH POST DATA
    const { data: post, error: postError } = await supabase
  .from('posts_v2')
  .select('id, user_id, content_group_id, caption, image_url, reference_url, platform, prompt_used, topic')
  .eq('id', postId)
  .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (post.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 4. CHECK IF CONTENT GROUP ALREADY HAS A FORM
    if (contentGroupId) {
      const { data: existingForms } = await supabase
        .from('posts_v2')
        .select('form_id, form_name')
        .eq('content_group_id', contentGroupId)
        .not('form_id', 'is', null)
        .limit(1);

      if (existingForms && existingForms.length > 0) {
        return NextResponse.json(
          { 
            error: 'This content group already has a form',
            existingFormId: existingForms[0].form_id,
            existingFormName: existingForms[0].form_name
          },
          { status: 409 }
        );
      }
    }

    // 5. FETCH USER'S COMPANY INFO
    const { data: config } = await supabase
      .from('client_configs')
      .select('company_name, company_industry, target_audience')
      .eq('client_id', user.id)
      .single();

    const companyName = config?.company_name || 'Company';
    const companyIndustry = config?.company_industry || '';
    const targetAudience = config?.target_audience || '';
    const formId = uuidv4();
const companySlug = companyName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

    // 6. BUILD WEBHOOK PAYLOAD FOR n8n
    const webhookPayload = {
      action: 'generate-form',

      formId: formId,
  companySlug: companySlug,
      
      // Post info
      postId: post.id,
      contentGroupId: post.content_group_id,
      caption: post.caption,
      referenceUrl: post.reference_url,
      platform: post.platform,
      prompt: post.prompt_used,
  topic: post.topic,
      
      // User/Company info
      userId: user.id,
      companyName,
      companyIndustry,
      targetAudience,
      
      // Timestamp
      executedAt: new Date().toISOString(),
    };

    console.log('[FormGen] Webhook payload:', JSON.stringify(webhookPayload, null, 2));

    // 7. TRIGGER n8n WEBHOOK
    const webhookUrl = process.env.N8N_FORM_GENERATION_WEBHOOK;
    if (!webhookUrl) {
      console.error('[FormGen] Webhook URL not configured');
      return NextResponse.json(
        { error: 'Form generation service unavailable' },
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
      console.error('[FormGen] Webhook failed:', text);
      return NextResponse.json(
        { error: `Form generation failed: ${text}` },
        { status: 500 }
      );
    }

    const responseData = await response.json().catch(() => ({}));
    console.log('[FormGen] Webhook success:', responseData);

    return NextResponse.json({
      success: true,
      message: 'Form generation started',
      postId: post.id
    });

  } catch (err: any) {
    console.error('[FormGen] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}