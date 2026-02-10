import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServerClient';
import { getGoogleAccessToken } from '@/lib/google-auth';
import { generateWebhookToken } from '@/lib/jwt';

// ─── RECAPTCHA VERIFICATION HELPER ───────────────────────────────────────────
async function verifyRecaptcha(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`
    });

    const data = await response.json();
    console.log('[Form Submit] reCAPTCHA score:', data.score);

    // v3 returns a score 0.0 - 1.0 (1.0 = human, 0.0 = bot)
    // 0.5 is Google's recommended threshold
    return data.success && data.score >= 0.5;

  } catch (err) {
    console.error('[Form Submit] reCAPTCHA verification error:', err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { formId, answers, recaptchaToken } = body;

    // 1. VALIDATE REQUIRED FIELDS
    if (!formId || !answers) {
      return NextResponse.json(
        { error: 'Missing formId or answers' },
        { status: 400 }
      );
    }

    // 2. VERIFY RECAPTCHA
    if (!recaptchaToken) {
      return NextResponse.json(
        { error: 'Missing reCAPTCHA token' },
        { status: 400 }
      );
    }

    const isHuman = await verifyRecaptcha(recaptchaToken);
    if (!isHuman) {
      console.warn('[Form Submit] reCAPTCHA failed - possible bot submission');
      return NextResponse.json(
        { error: 'reCAPTCHA verification failed. Please try again.' },
        { status: 403 }
      );
    }

    // 3. GET FORM DETAILS
    const { data: form, error: formError } = await supabaseServer
      .from('forms')
      .select('id, user_id, sheet_id, form_schema')
      .eq('id', formId)
      .single();

    if (formError || !form) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      );
    }

    if (!form.sheet_id) {
      return NextResponse.json(
        { error: 'No Google Sheet associated with this form' },
        { status: 500 }
      );
    }

    // 4. GET USER'S GOOGLE ACCESS TOKEN
    const accessToken = await getGoogleAccessToken(form.user_id);

    if (!accessToken) {
      console.error('[Form Submit] No valid Google token for user:', form.user_id);
      return NextResponse.json(
        { error: 'Unable to save submission. Please contact form owner.' },
        { status: 503 }
      );
    }

    // 5. BUILD ROW DATA
    const timestamp = new Date().toISOString();
    const rowData = [timestamp];

    const questions = form.form_schema.questions || [];
    questions.forEach((q: any) => {
      rowData.push(answers[q.id] || '');
    });

    // 6. APPEND TO GOOGLE SHEET
    const sheetResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${form.sheet_id}/values/Sheet1:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [rowData]
        })
      }
    );

    if (!sheetResponse.ok) {
      const errorData = await sheetResponse.json();
      console.error('[Form Submit] Google Sheets API error:', errorData);
      throw new Error('Failed to save to Google Sheets');
    }

    const sheetResponseData = await sheetResponse.json();
    
    // Extract row number from response
    const updatedRange = sheetResponseData.updates?.updatedRange || '';
    const rowNumber = updatedRange.match(/\d+$/)?.[0];

    // 7. INCREMENT SUBMISSION COUNT
    await supabaseServer.rpc('increment_form_submission', {
      form_id_param: formId
    });

    // 8. CHECK IF LEAD QUALIFICATION ENABLED
    const { data: clientConfig } = await supabaseServer
      .from('client_configs')
      .select('lead_qualification_enabled')
      .eq('client_id', form.user_id)
      .single();

    // 9. TRIGGER LEAD QUALIFICATION WITH JWT AUTH
    if (clientConfig?.lead_qualification_enabled && rowNumber) {
      const webhookUrl = process.env.N8N_LEAD_QUALIFICATION_WEBHOOK;
      
      if (webhookUrl) {
        try {
          const webhookToken = generateWebhookToken(form.user_id);

          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${webhookToken}`
            },
            body: JSON.stringify({
              formId: form.id,
              userId: form.user_id,
              sheetId: form.sheet_id,
              rowNumber: parseInt(rowNumber),
              questionCount: questions.length,
              googleAccessToken: accessToken,
              submittedAt: timestamp
            })
          });

          console.log(`[Form Submit] Lead qualification triggered for row ${rowNumber}`);
        } catch (webhookError) {
          console.error('[Form Submit] Lead qualification webhook failed:', webhookError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Submission saved'
    });

  } catch (error: any) {
    console.error('[Form Submit] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit form' },
      { status: 500 }
    );
  }
}