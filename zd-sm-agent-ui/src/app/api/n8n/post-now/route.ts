import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthenticatedClient } from '@/lib/auth-middleware';
import { generateWebhookToken } from '@/lib/jwt';
import { withSecurity, logAuditEvent } from '@/lib/security';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  return withSecurity(
    req,
    async (userId) => {
      const supabase = createAuthenticatedClient(req.headers.get('authorization')?.replace('Bearer ', '') || '');

      try {
        // 1. PARSE BODY
        const body = await req.json();
        const { 
          clientConfigId, 
          prompt,
          style,
          referenceType,
          referenceUrl,
          referenceVideo,
          referenceImage,
          referenceArticle,
          oneTimeFile,
          generate_FB,
          generate_IG,
          generate_LI,
          web_search,
          organic,
          paid,
          category,
          tags
        } = body;

        // 2. VALIDATION
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

        if (!generate_FB && !generate_IG && !generate_LI) {
          return NextResponse.json(
            { error: 'At least one platform must be selected' }, 
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
          console.error('[Post-Now] Client config lookup failed:', configError);
          return NextResponse.json(
            { error: 'Client config not found or access denied' }, 
            { status: 404 }
          );
        }

        const { data: userConfig } = await supabase
          .from('client_configs')
          .select('linkedin_organization_urn')
          .eq('client_id', userId)
          .single();

        // 4. VERIFY OWNERSHIP (extra safety)
        if (config.client_id !== userId) {
          return NextResponse.json(
            { error: 'You do not have permission to use this config' },
            { status: 403 }
          );
        }

        const linkedinOrgUrn = config.linkedin_organization_urn || null;

        // 5. GENERATE CONTENT GROUP ID
        const contentGroupId = uuidv4();
        console.log('[Post-Now] Generated contentGroupId:', contentGroupId);

        // 6. GENERATE JWT TOKEN FOR WEBHOOK AUTH
        const webhookToken = generateWebhookToken(userId);

        // 7. BUILD WEBHOOK PAYLOAD
        const webhookPayload = {
          action: 'post-now',
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
          rssUrls: config.rss_urls,
          
          // Generation parameters
          prompt: prompt.trim(),
          style: style || 'realism',
          referenceType: referenceType || 'none',
          referenceUrl: referenceUrl || null,
          referenceVideo: referenceVideo || null,
          referenceImage: referenceImage || null,
          referenceArticle: referenceArticle || null,
          oneTimeFile: oneTimeFile || null,
          
          // Platform selection
          generate_FB: generate_FB || false,
          generate_IG: generate_IG || false,
          generate_LI: generate_LI || false,
          
          // Content type
          organic: organic || false,
          paid: paid || false,
          contentType: organic ? 'organic' : 'paid',
          web_search: web_search || false,
          
          // Metadata
          category: category || 'none',
          tags: tags || [],
          sourceType: 'social_post',
          
          // LinkedIn org
          linkedin_organization_urn: userConfig?.linkedin_organization_urn || null,
          
          // Timestamp
          executedAt: new Date().toISOString(),
        };

        console.log('[Post-Now] Webhook payload:', JSON.stringify(webhookPayload, null, 2));

        // 8. TRIGGER WEBHOOK WITH JWT AUTH
        const webhookUrl = process.env.N8N_ONE_TIME_WEBHOOK;
        if (!webhookUrl) {
          console.error('[Post-Now] Webhook URL missing in environment');
          return NextResponse.json(
            { error: 'Webhook URL missing in environment' }, 
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
          console.error('[Post-Now] Webhook failed:', text);
          return NextResponse.json(
            { error: `Webhook failed: ${text}` }, 
            { status: 500 }
          );
        }

        const responseData = await response.json();
        console.log('[Post-Now] Webhook success:', responseData);

        // 9. CHECK IF N8N REJECTED DUE TO INVALID JWT
        if (responseData.validated === false) {
          console.error('[Post-Now] JWT validation failed:', responseData.error);
          return NextResponse.json(
            { error: 'Unauthorized: Invalid authentication token' },
            { status: 401 }
          );
        }

        // 10. AUDIT LOG SUCCESS
        await logAuditEvent({
          user_id: userId,
          action: 'post_generated',
          resource_type: 'social_post',
          resource_id: contentGroupId,
          metadata: {
            platforms: {
              facebook: generate_FB,
              instagram: generate_IG,
              linkedin: generate_LI
            },
            contentType: organic ? 'organic' : 'paid'
          },
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
          user_agent: req.headers.get('user-agent') || undefined,
        });

        return NextResponse.json({ 
          success: true,
          message: 'Social post generation started',
          contentGroupId
        });

      } catch (err) {
        console.error('[Post-Now] API error:', err);
        return NextResponse.json(
          { error: 'Internal server error' }, 
          { status: 500 }
        );
      }
    },
    {
      rateLimitKey: 'post_generation',
      rateLimitMax: 20, // 20 generations per 15 minutes
      rateLimitWindowMs: 15 * 60 * 1000,
      skipOriginValidation: false,
      auditAction: 'post_generation_attempt'
    }
  );
}