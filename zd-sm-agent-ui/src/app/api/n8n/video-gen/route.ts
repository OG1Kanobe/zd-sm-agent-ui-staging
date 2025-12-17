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
    const { 
      clientConfigId,
      videoSource, // 'text' or 'image'
      prompt,
      style,
      purpose,
      referenceType,
      referenceUrl,
      referenceVideo,
      referenceImage,
      referenceArticle,
      sourceImage, // For image-to-video
      orientation,
      duration,
      category,
      tags
    } = body;

    // 3. VALIDATION
    if (!clientConfigId) {
      return NextResponse.json(
        { error: 'Missing clientConfigId' }, 
        { status: 400 }
      );
    }

    if (!videoSource || !['text', 'image'].includes(videoSource)) {
      return NextResponse.json(
        { error: 'Invalid video source. Must be "text" or "image"' }, 
        { status: 400 }
      );
    }

    if (!prompt || prompt.trim() === '') {
      return NextResponse.json(
        { error: 'Prompt/description is required' }, 
        { status: 400 }
      );
    }

    if (!orientation || !['16:9', '9:16', '1:1'].includes(orientation)) {
      return NextResponse.json(
        { error: 'Invalid orientation. Must be "16:9", "9:16", or "1:1"' }, 
        { status: 400 }
      );
    }

    if (!duration || !['5', '10', '15', '30'].includes(duration)) {
      return NextResponse.json(
        { error: 'Invalid duration. Must be "5", "10", "15", or "30"' }, 
        { status: 400 }
      );
    }

    // 4. FETCH CONFIG (RLS ensures user owns this)
    const { data: config, error: configError } = await supabase
      .from('client_configs')
      .select(`
        id,
        client_id,
        company_name,
        company_website,
        company_industry,
        company_description,
        logo_url,
        primary_color,
        secondary_color,
        accent_color,
        brand_tone,
        target_audience,
        visual_aesthetic,
        custom_prompt
      `)
      .eq('id', clientConfigId)
      .single();

    if (configError || !config) {
      console.error('[Video-Gen] Client config lookup failed:', configError);
      return NextResponse.json(
        { error: 'Client config not found or access denied' }, 
        { status: 404 }
      );
    }

    // 5. VERIFY OWNERSHIP
    if (config.client_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to use this config' },
        { status: 403 }
      );
    }

    // 6. GENERATE CONTENT GROUP ID (null for standalone videos)
    const contentGroupId = null; // Single video = no group

    // 7. BUILD WEBHOOK PAYLOAD
    const webhookPayload = {
      action: 'video-gen',
      contentGroupId,
      clientConfigId,
      clientId: config.client_id,
      
      // Company branding
      companyName: config.company_name,
      companyWebsite: config.company_website,
      companyDescription: config.company_description,
      companyIndustry: config.company_industry,
      logoUrl: config.logo_url,
      primaryColor: config.primary_color,
      secondaryColor: config.secondary_color,
      accentColor: config.accent_color,
      brandTone: config.brand_tone,
      targetAudience: config.target_audience,
      visualAesthetic: config.visual_aesthetic,
      customPrompt: config.custom_prompt,
      
      // Video generation parameters
      videoSource,
      prompt: prompt.trim(),
      style: style || 'realism',
      purpose: purpose || 'Social Media Ad',
      referenceType: videoSource === 'text' ? (referenceType || 'none') : 'none',
      referenceUrl: videoSource === 'text' ? (referenceUrl || null) : null,
      referenceVideo: videoSource === 'text' ? (referenceVideo || null) : null,
      referenceImage: videoSource === 'text' ? (referenceImage || null) : null,
      referenceArticle: videoSource === 'text' ? (referenceArticle || null) : null,
      
      // Image-to-video specific
      sourceImage: videoSource === 'image' ? sourceImage : null,
      motionDescription: videoSource === 'image' ? prompt.trim() : null,
      
      // Video settings
      orientation,
      duration,
      
      // Metadata
      category: category || 'none',
      tags: tags || [],
      sourceType: 'video',
      platform: 'none',
      
      // Timestamp
      executedAt: new Date().toISOString(),
    };

    console.log('[Video-Gen] Webhook payload:', JSON.stringify(webhookPayload, null, 2));

    // 8. TRIGGER WEBHOOK
    const webhookUrl = process.env.N8N_VIDEO_GEN_WEBHOOK;
    if (!webhookUrl) {
      console.error('[Video-Gen] Webhook URL missing in environment');
      return NextResponse.json(
        { error: 'Video generation service unavailable' }, 
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
      console.error('[Video-Gen] Webhook failed:', text);
      return NextResponse.json(
        { error: `Video generation failed: ${text}` }, 
        { status: 500 }
      );
    }

    const responseData = await response.json();
    console.log('[Video-Gen] Webhook success:', responseData);

    return NextResponse.json({ 
      success: true,
      message: 'Video generation started',
      contentGroupId: null
    });

  } catch (err) {
    console.error('[Video-Gen] API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}