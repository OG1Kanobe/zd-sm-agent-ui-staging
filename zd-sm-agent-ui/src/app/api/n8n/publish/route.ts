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
          postId,
          platforms,
        } = body;

        // 2. VALIDATION
        if (!postId || !platforms || platforms.length === 0) {
          return NextResponse.json(
            { error: 'Must provide postId and platforms array' },
            { status: 400 }
          );
        }

        // 3. FETCH POST DATA
        const { data: post, error: fetchError } = await supabase
          .from('posts_v2')
          .select('id, user_id, source_type, image_url, video_url, video_thumbnail_url, caption, ig_post_link, fb_post_link, li_post_link, tt_post_link')
          .eq('id', postId)
          .single();

        if (fetchError || !post) {
          console.error('[Publish] Failed to fetch post:', fetchError);
          return NextResponse.json(
            { error: 'Post not found' },
            { status: 404 }
          );
        }

        // 4. VERIFY OWNERSHIP
        if (post.user_id !== userId) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 403 }
          );
        }

        // 5. DETERMINE WHICH PLATFORMS NEED PUBLISHING
        const platformsToPublish = platforms.filter((platform: string) => {
          switch(platform) {
            case 'instagram': return !post.ig_post_link;
            case 'facebook': return !post.fb_post_link;
            case 'linkedin': return !post.li_post_link;
            case 'tiktok': return !post.tt_post_link;
            default: return false;
          }
        });

        if (platformsToPublish.length === 0) {
          return NextResponse.json(
            { error: 'All selected platforms already published' },
            { status: 400 }
          );
        }

        // 6. FETCH SOCIAL TOKENS
        const { data: socialProfile, error: socialError } = await supabase
          .from('user_social_profiles')
          .select('*')
          .eq('client_id', userId)
          .single();

        if (socialError || !socialProfile) {
          console.error('[Publish] Failed to fetch social tokens:', socialError);
          return NextResponse.json(
            { error: 'Failed to fetch social tokens' },
            { status: 500 }
          );
        }

        // 7. BUILD TOKENS OBJECT (only for selected platforms)
        const tokens: any = {};
        
        if (platformsToPublish.includes('facebook')) {
          tokens.facebook = {
            userId: socialProfile.facebook_user_id,
            accessToken: socialProfile.long_lived_access_token,
            pageId: socialProfile.page_id,
            pageToken: socialProfile.page_access_token,
            expiresAt: socialProfile.fb_token_expires_at,
          };
        }
        
        if (platformsToPublish.includes('instagram')) {
          tokens.instagram = {
            businessId: socialProfile.instagram_business_id,
            username: socialProfile.instagram_username,
            userId: socialProfile.instagram_user_id,
            accessToken: socialProfile.instagram_access_token,
            expiresAt: socialProfile.ig_token_expires_at, 
          };
        }
        
        if (platformsToPublish.includes('linkedin')) {
          tokens.linkedin = {
            organizations: socialProfile.linkedin_organizations,
            accessToken: socialProfile.linkedin_access_token,
            expiresAt: socialProfile.li_token_expires_at,
          };
        }
        
        if (platformsToPublish.includes('tiktok')) {
          tokens.tiktok = {
            userId: socialProfile.tiktok_user_id,
            accessToken: socialProfile.tiktok_access_token,
            refreshToken: socialProfile.tiktok_refresh_token,
            expiresAt: socialProfile.tt_token_expires_at,
          };
        }

        // 8. FETCH LINKEDIN ORG
        const { data: configData } = await supabase
          .from('client_configs')
          .select('linkedin_organization_urn')
          .eq('client_id', userId)
          .single();

        const linkedinOrgUrn = configData?.linkedin_organization_urn || null;

        // 9. GENERATE JWT TOKEN FOR WEBHOOK AUTH
        const webhookToken = generateWebhookToken(userId);

        // 10. BUILD WEBHOOK PAYLOAD
        const webhookPayload = {
          postId: post.id,
          contentType: post.source_type === 'video' ? 'video' : 'social_post',
          platforms: platformsToPublish,
          
          // Media
          imageUrl: post.image_url,
          videoUrl: post.video_url,
          videoThumbnail: post.video_thumbnail_url,
          caption: post.caption,
          
          // Auth
          userId,
          tokens,
          linkedin_organization_urn: linkedinOrgUrn,
          
          action: 'publish',
        };

        console.log('[Publish] Webhook payload:', {
          postId: webhookPayload.postId,
          contentType: webhookPayload.contentType,
          platforms: webhookPayload.platforms,
          platformCount: platformsToPublish.length,
        });

        // 11. TRIGGER WEBHOOK WITH JWT AUTH
        const webhookUrl = process.env.N8N_ON_DEMAND_WEBHOOK_URL;
        if (!webhookUrl) {
          console.error('[Publish] Webhook URL not configured');
          return NextResponse.json(
            { error: 'Webhook URL not configured' },
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
          console.error('[Publish] Webhook failed:', text);
          return NextResponse.json(
            { error: `Webhook failed: ${text}` },
            { status: 500 }
          );
        }

        const responseData = await response.json().catch(() => ({}));
        console.log('[Publish] Webhook success:', responseData);

        // 12. CHECK IF N8N REJECTED DUE TO INVALID JWT
        if (responseData.validated === false) {
          console.error('[Publish] JWT validation failed:', responseData.error);
          return NextResponse.json(
            { error: 'Unauthorized: Invalid authentication token' },
            { status: 401 }
          );
        }

        // 13. AUDIT LOG
        await logAuditEvent({
          user_id: userId,
          action: 'post_published',
          resource_type: 'social_post',
          resource_id: postId,
          metadata: {
            platforms: platformsToPublish,
            contentType: post.source_type
          },
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
          user_agent: req.headers.get('user-agent') || undefined,
        });

        return NextResponse.json({ 
          success: true,
          message: `Publishing to ${platformsToPublish.length} platform(s)`,
          postId,
          platforms: platformsToPublish,
        });

      } catch (err: any) {
        console.error('[Publish] Error:', err);
        return NextResponse.json(
          { error: err.message || 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimitKey: 'publish_post',
      rateLimitMax: 15, // 15 publishes per 15 minutes
      rateLimitWindowMs: 15 * 60 * 1000,
      skipOriginValidation: false,
      auditAction: 'publish_attempt'
    }
  );
}