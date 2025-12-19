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
      ig_publish,
      fb_publish,
      li_publish,
      tt_publish,
      userId 
    } = body;

    // Validate
    if (!ig_publish && !fb_publish && !li_publish && !tt_publish) {
      return NextResponse.json(
        { error: 'Must provide at least one post ID to publish' },
        { status: 400 }
      );
    }

    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // 3. COLLECT POST IDs
    const postIds = [ig_publish, fb_publish, li_publish, tt_publish].filter(Boolean) as string[];

    // 4. FETCH POST DATA
    const { data: posts, error: fetchError } = await supabase
      .from('posts_v2')
      .select('id, user_id, platform, source_type, image_url, video_url, video_thumbnail_url, caption')
      .in('id', postIds);

    if (fetchError || !posts || posts.length === 0) {
      console.error('[Publish] Failed to fetch posts:', fetchError);
      return NextResponse.json({ error: 'Posts not found' }, { status: 404 });
    }

    // Verify ownership
    const invalidPosts = posts.filter((p: any) => p.user_id !== user.id);
    if (invalidPosts.length > 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const primaryPost = posts[0];

    // 5. DETERMINE PLATFORMS
    const selectedPlatforms: string[] = [];
    if (ig_publish) selectedPlatforms.push('instagram');
    if (fb_publish) selectedPlatforms.push('facebook');
    if (li_publish) selectedPlatforms.push('linkedin');
    if (tt_publish) selectedPlatforms.push('tiktok');

    const originalPlatform = primaryPost.platform;
    const crosspostTo = selectedPlatforms.filter(p => p !== originalPlatform);

    // 6. FETCH SOCIAL TOKENS
    const { data: socialProfile, error: socialError } = await supabase
      .from('user_social_profiles')
      .select('*')
      .eq('client_id', user.id)
      .single();

    if (socialError || !socialProfile) {
      console.error('[Publish] Failed to fetch social tokens:', socialError);
      return NextResponse.json({ error: 'Failed to fetch social tokens' }, { status: 500 });
    }

    // 7. BUILD TOKENS OBJECT
    const tokens: any = {};
    
    if (selectedPlatforms.includes('facebook')) {
      tokens.facebook = {
        userId: socialProfile.facebook_user_id,
        accessToken: socialProfile.long_lived_access_token,
        pageId: socialProfile.page_id,
        pageToken: socialProfile.page_access_token,
      };
    }
    
    if (selectedPlatforms.includes('instagram')) {
      tokens.instagram = {
        businessId: socialProfile.instagram_business_id,
        username: socialProfile.instagram_username,
        userId: socialProfile.instagram_user_id,
        accessToken: socialProfile.instagram_access_token,
      };
    }
    
    if (selectedPlatforms.includes('linkedin')) {
      tokens.linkedin = {
        organizations: socialProfile.linkedin_organizations,
        accessToken: socialProfile.linkedin_access_token,
      };
    }
    
    if (selectedPlatforms.includes('tiktok')) {
      tokens.tiktok = {
        userId: socialProfile.tiktok_user_id,
        accessToken: socialProfile.tiktok_access_token,
        refreshToken: socialProfile.tiktok_refresh_token,
      };
    }

    // 8. FETCH LINKEDIN ORG
    const { data: configData } = await supabase
      .from('client_configs')
      .select('linkedin_organization_urn')
      .eq('client_id', user.id)
      .single();

    const linkedinOrgUrn = configData?.linkedin_organization_urn || null;

    // 9. BUILD WEBHOOK PAYLOAD
    const webhookPayload = {
      postId: primaryPost.id,
      contentType: primaryPost.source_type === 'video' ? 'video' : 'social_post',
      originalPlatform,
      crosspostTo,
      
      // Media
      imageUrl: primaryPost.image_url,
      videoUrl: primaryPost.video_url,
      videoThumbnail: primaryPost.video_thumbnail_url,
      caption: primaryPost.caption,
      
      // Auth
      userId: user.id,
      tokens,
      linkedin_organization_urn: linkedinOrgUrn,
      
      action: 'publish',
    };

    console.log('[Publish] Webhook payload:', {
      postId: webhookPayload.postId,
      contentType: webhookPayload.contentType,
      originalPlatform: webhookPayload.originalPlatform,
      crosspostTo: webhookPayload.crosspostTo,
      platformCount: selectedPlatforms.length,
    });

    // 10. TRIGGER WEBHOOK
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
      headers: { 'Content-Type': 'application/json' },
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

    return NextResponse.json({ 
      success: true,
      message: `Publishing to ${selectedPlatforms.length} platform(s)`,
      postIds,
      platforms: selectedPlatforms,
    });

  } catch (err: any) {
    console.error('[Publish] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}