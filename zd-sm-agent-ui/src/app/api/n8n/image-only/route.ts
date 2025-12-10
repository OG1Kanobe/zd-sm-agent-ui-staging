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
      prompt,
      referenceType,
      referenceUrl,
      referenceVideo,
      referenceImage,
      referenceArticle,
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

    if (!prompt || prompt.trim() === '') {
      return NextResponse.json(
        { error: 'Prompt is required' }, 
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
      console.error('[Image-Only] Client config lookup failed:', configError);
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

    // 6. GENERATE CONTENT GROUP ID (null for standalone images)
    const contentGroupId = null; // Single image = no group

    // 7. BUILD WEBHOOK PAYLOAD
    const webhookPayload = {
      action: 'image-only',
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
      
      // Generation parameters
      prompt: prompt.trim(),
      referenceType: referenceType || 'none',
      referenceUrl: referenceUrl || null,
      referenceVideo: referenceVideo || null,
      referenceImage: referenceImage || null,
      referenceArticle: referenceArticle || null,
      
      // Metadata
      category: category || 'none',
      tags: tags || [],
      sourceType: 'standalone_image',
      platform: 'none',
      
      // Timestamp
      executedAt: new Date().toISOString(),
    };

    console.log('[Image-Only] Webhook payload:', JSON.stringify(webhookPayload, null, 2));

    // 8. TRIGGER WEBHOOK
    const webhookUrl = process.env.N8N_IMAGE_ONLY_WEBHOOK;
    if (!webhookUrl) {
      console.error('[Image-Only] Webhook URL missing in environment');
      return NextResponse.json(
        { error: 'Image generation service unavailable' }, 
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
      console.error('[Image-Only] Webhook failed:', text);
      return NextResponse.json(
        { error: `Image generation failed: ${text}` }, 
        { status: 500 }
      );
    }

    const responseData = await response.json();
    console.log('[Image-Only] Webhook success:', responseData);

    return NextResponse.json({ 
      success: true,
      message: 'Image generation started',
      contentGroupId: null
    });

  } catch (err) {
    console.error('[Image-Only] API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}