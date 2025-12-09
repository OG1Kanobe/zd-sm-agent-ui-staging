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
      clientConfigId, 
      oneTimeUrl, 
      oneTimePrompt, 
      oneTimeArticle, 
      oneTimeFile 
    } = body;

    if (!clientConfigId) {
      return NextResponse.json(
        { error: 'Missing clientConfigId' }, 
        { status: 400 }
      );
    }

    // 3. FETCH CONFIG (RLS ensures user owns this)
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
        custom_prompt,
        rss_urls,
        linkedin_organization_urn
      `)
      .eq('id', clientConfigId)
      .single();

    if (configError || !config) {
      console.error('Client config lookup failed:', configError);
      return NextResponse.json(
        { error: 'Client config not found or access denied' }, 
        { status: 404 }
      );
    }

    const { data: userConfig } = await supabase
  .from('client_configs')
  .select('linkedin_organization_urn')
  .eq('client_id', user.id)
  .single();

    // 4. VERIFY OWNERSHIP (extra safety)
    if (config.client_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to use this config' },
        { status: 403 }
      );
    }

    const linkedinOrgUrn = config.linkedin_organization_urn || null; // ← Use 'config' not 'configData'


    // 5. BUILD WEBHOOK PAYLOAD
// 5. BUILD WEBHOOK PAYLOAD
const webhookPayload = {
  action: 'post-now',
  clientConfigId,
  clientId: config.client_id,
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
  rssUrls: config.rss_urls,
  prompt: body.prompt, // NEW - required
  referenceType: body.referenceType || 'none', // NEW
  referenceUrl: body.referenceUrl || null, // NEW
  referenceVideo: body.referenceVideo || null, // NEW
  referenceArticle: body.referenceArticle || null, // NEW
  oneTimeFile: body.oneTimeFile || null, // Keep existing
  generate_FB: body.generate_FB || false,
  generate_IG: body.generate_IG || false,
  generate_LI: body.generate_LI || false,
  organic: body.organic || false,
  paid: body.paid || false,
  linkedin_organization_urn: userConfig?.linkedin_organization_urn || null,
  executedAt: new Date().toISOString(),
};

    // 6. TRIGGER WEBHOOK
    const webhookUrl = process.env.N8N_ONE_TIME_WEBHOOK;
    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Webhook URL missing in environment' }, 
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
    console.error('Post Now API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}