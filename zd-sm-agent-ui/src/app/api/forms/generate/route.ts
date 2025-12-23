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
      .select('id, user_id, content_group_id, caption, image_url, reference_url, platform')
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

    // 6. GENERATE FORM ID & SLUGS
    const formId = uuidv4();
    const companySlug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // 7. CALL AI TO GENERATE FORM QUESTIONS
    const aiPrompt = `
You are a lead qualification form generator for a business in the ${companyIndustry} industry targeting ${targetAudience}.

Based on this social media post:
Caption: "${post.caption}"
${post.reference_url ? `Reference: ${post.reference_url}` : ''}

Create a lead qualification form with 5-7 questions that:
1. Capture contact info (name, email, phone)
2. Qualify budget/timeline
3. Understand pain points
4. Assess fit for the product/service

Return ONLY valid JSON in this exact format (no markdown, no backticks):
{
  "formName": "Short name (3-5 words)",
  "formTitle": "Full descriptive title for the form header",
  "questions": [
    {
      "id": "q1",
      "type": "text",
      "label": "What is your full name?",
      "placeholder": "John Doe",
      "category": "Contact",
      "required": true
    },
    {
      "id": "q2",
      "type": "email",
      "label": "Work email address",
      "placeholder": "john@company.com",
      "category": "Contact",
      "required": true
    }
  ]
}

Question types allowed: text, email, phone, select, textarea
Categories: Contact, General, Budget, Timeline, PainPoints
For "select" type, include "options" array.
`;

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          { role: 'user', content: aiPrompt }
        ]
      })
    });

    if (!aiResponse.ok) {
      console.error('[FormGen] AI request failed:', await aiResponse.text());
      return NextResponse.json(
        { error: 'Failed to generate form questions' },
        { status: 500 }
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.content[0].text;
    
    // Parse AI response (remove markdown if present)
    let formData;
    try {
      const cleanJson = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      formData = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('[FormGen] Failed to parse AI response:', aiContent);
      return NextResponse.json(
        { error: 'Invalid AI response format' },
        { status: 500 }
      );
    }

    // 8. GENERATE TITLE SLUG
    const titleSlug = formData.formTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    const formUrl = `/forms/${companySlug}/${formId}/${titleSlug}`;

    // 9. UPDATE POST(S) WITH FORM DATA
    const updateData = {
      form_id: formId,
      form_name: formData.formName,
      form_title: formData.formTitle,
      form_schema: { questions: formData.questions }
    };

    if (contentGroupId) {
      // Update all posts in the content group
      const { error: updateError } = await supabase
        .from('posts_v2')
        .update(updateData)
        .eq('content_group_id', contentGroupId);

      if (updateError) {
        console.error('[FormGen] Failed to update posts:', updateError);
        return NextResponse.json(
          { error: 'Failed to save form' },
          { status: 500 }
        );
      }
    } else {
      // Update single post
      const { error: updateError } = await supabase
        .from('posts_v2')
        .update(updateData)
        .eq('id', postId);

      if (updateError) {
        console.error('[FormGen] Failed to update post:', updateError);
        return NextResponse.json(
          { error: 'Failed to save form' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      formId,
      formName: formData.formName,
      formTitle: formData.formTitle,
      formUrl,
      message: 'Form created successfully'
    });

  } catch (err: any) {
    console.error('[FormGen] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}