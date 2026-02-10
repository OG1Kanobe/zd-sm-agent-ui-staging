import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/lib/auth-middleware';
import { generateWebhookToken } from '@/lib/jwt';
import { withSecurity, logAuditEvent } from '@/lib/security';
import { supabaseServer } from '@/lib/supabaseServerClient'; 
import { v4 as uuidv4 } from 'uuid';

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
        const { postId, contentGroupId } = body;

        if (!postId) {
          return NextResponse.json(
            { error: 'Missing postId' },
            { status: 400 }
          );
        }

        // 2. FETCH POST DATA
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

        // 3. VERIFY OWNERSHIP
        if (post.user_id !== userId) {
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
          .eq('client_id', userId)
          .single();

        const companyName = config?.company_name || 'Company';
        const companyIndustry = config?.company_industry || '';
        const targetAudience = config?.target_audience || '';
        const formId = uuidv4();
        const companySlug = companyName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        // 6. CHECK IF USER HAS GOOGLE CONNECTED
        const { data: socialProfile } = await supabaseServer
          .from('user_social_profiles')
          .select('google_connected, google_access_token, google_refresh_token, google_token_expires_at')
          .eq('client_id', userId)
          .single();

        if (!socialProfile?.google_connected) {
          return NextResponse.json(
            { error: 'Please connect Google Drive in Integrations before creating forms' },
            { status: 400 }
          );
        }

        // 7. GET VALID GOOGLE ACCESS TOKEN
        const { getGoogleAccessToken } = await import('@/lib/google-auth');
        const googleAccessToken = await getGoogleAccessToken(userId);

        if (!googleAccessToken) {
          return NextResponse.json(
            { error: 'Failed to get Google access token. Please reconnect Google in Integrations.' },
            { status: 401 }
          );
        }

        // 8. GENERATE JWT TOKEN FOR WEBHOOK AUTH
        const webhookToken = generateWebhookToken(userId);

        // 9. BUILD WEBHOOK PAYLOAD
        const webhookPayload = {
          action: 'generate-form',
          formId,
          companySlug,
          
          // Post info
          postId: post.id,
          contentGroupId: post.content_group_id,
          caption: post.caption,
          referenceUrl: post.reference_url,
          platform: post.platform,
          prompt: post.prompt_used,
          topic: post.topic,

          // Google Sheets
          googleAccessToken,
          
          // User/Company info
          userId,
          companyName,
          companyIndustry,
          targetAudience,
          
          // Timestamp
          executedAt: new Date().toISOString(),
        };

        console.log('[FormGen] Webhook payload:', JSON.stringify(webhookPayload, null, 2));

        // 10. TRIGGER WEBHOOK WITH JWT AUTH
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
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${webhookToken}`
          },
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

        // 11. CHECK IF N8N REJECTED DUE TO INVALID JWT
        if (responseData.validated === false) {
          console.error('[FormGen] JWT validation failed:', responseData.error);
          return NextResponse.json(
            { error: 'Unauthorized: Invalid authentication token' },
            { status: 401 }
          );
        }

        // 12. AUDIT LOG
        await logAuditEvent({
          user_id: userId,
          action: 'form_generated',
          resource_type: 'form',
          resource_id: formId,
          metadata: {
            postId,
            contentGroupId,
            platform: post.platform
          },
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
          user_agent: req.headers.get('user-agent') || undefined,
        });

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
    },
    {
      rateLimitKey: 'form_generation',
      rateLimitMax: 10, // 10 form generations per 15 minutes
      rateLimitWindowMs: 15 * 60 * 1000,
      skipOriginValidation: false,
      auditAction: 'form_generation_attempt'
    }
  );
}