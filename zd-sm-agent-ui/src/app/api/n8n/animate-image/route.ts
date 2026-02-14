import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/lib/auth-middleware';
import { generateWebhookToken } from '@/lib/jwt';
import { withSecurity, logAuditEvent } from '@/lib/security';

export async function POST(req: NextRequest) {
  return withSecurity(
    req,
    async (userId) => {
      const supabase = createAuthenticatedClient(
        req.headers.get('authorization')?.replace('Bearer ', '') || ''
      );

      try {
        // 1. PARSE BODY
        const body = await req.json();
        const { 
          sourcePostId,
          sourceImageUrl,
          duration
        } = body;

        // 2. VALIDATION
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

        // 3. FETCH SOURCE POST
        const { data: sourcePost, error: fetchError } = await supabase
          .from('posts_v2')
          .select('id, user_id, content_group_id, caption, topic, category, tags, platform, orientation, animated_version_id, animate_prompt')
          .eq('id', sourcePostId)
          .single();

        if (fetchError || !sourcePost) {
          console.error('[AnimateImage] Source post not found:', fetchError);
          return NextResponse.json(
            { error: 'Source post not found' },
            { status: 404 }
          );
        }

        // 4. VERIFY OWNERSHIP
        if (sourcePost.user_id !== userId) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 403 }
          );
        }

        // 5. CHECK IF ALREADY HAS ANIMATED VERSION
        if (sourcePost.animated_version_id) {
          return NextResponse.json(
            { error: 'This post already has an animated version' },
            { status: 409 }
          );
        }

        // 6. GENERATE JWT TOKEN FOR WEBHOOK AUTH
        const webhookToken = generateWebhookToken(userId);

        // 7. BUILD WEBHOOK PAYLOAD
        const webhookPayload = {
          action: 'animate-image',
          
          // IDs
          userId,
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
          animationPrompt: sourcePost.animate_prompt || null,
          
          // Timestamp
          executedAt: new Date().toISOString(),
        };

        console.log('[AnimateImage] Webhook payload:', JSON.stringify(webhookPayload, null, 2));

        // 8. TRIGGER WEBHOOK WITH JWT AUTH
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
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${webhookToken}`
          },
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

        // 9. CHECK IF N8N REJECTED DUE TO INVALID JWT
        if (responseData.validated === false) {
          console.error('[AnimateImage] JWT validation failed:', responseData.error);
          return NextResponse.json(
            { error: 'Unauthorized: Invalid authentication token' },
            { status: 401 }
          );
        }

        // 10. AUDIT LOG
        await logAuditEvent({
          user_id: userId,
          action: 'image_animated',
          resource_type: 'social_post',
          resource_id: sourcePostId,
          metadata: {
            duration,
            platform: sourcePost.platform,
            orientation: sourcePost.orientation
          },
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
          user_agent: req.headers.get('user-agent') || undefined,
        });

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
    },
    {
      rateLimitKey: 'animate_image',
      rateLimitMax: 10, // 10 animations per 15 minutes
      rateLimitWindowMs: 15 * 60 * 1000,
      skipOriginValidation: false,
      auditAction: 'animate_image_attempt'
    }
  );
}