import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServerClient';
import { getGoogleAccessToken } from '@/lib/google-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { formId, answers } = body;

    if (!formId || !answers) {
      return NextResponse.json(
        { error: 'Missing formId or answers' },
        { status: 400 }
      );
    }

    // Get form details (including sheet_id and user_id)
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

    // Get user's Google access token
    const accessToken = await getGoogleAccessToken(form.user_id);

    if (!accessToken) {
      console.error('[Form Submit] No valid Google token for user:', form.user_id);
      return NextResponse.json(
        { error: 'Unable to save submission' },
        { status: 500 }
      );
    }

    // Build row data
    const timestamp = new Date().toISOString();
    const rowData = [timestamp]; // First column: timestamp

    // Add answers in order of form schema
    const questions = form.form_schema.questions || [];
    questions.forEach((q: any) => {
      rowData.push(answers[q.id] || '');
    });

    // Append to Google Sheet
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
    // Response format: "Sheet1!A5:G5" means row 5
    const updatedRange = sheetResponseData.updates?.updatedRange || '';
    const rowNumber = updatedRange.match(/\d+$/)?.[0];

    // Increment submission count
    await supabaseServer.rpc('increment_form_submission', {
      form_id_param: formId
    });

    // Check if user has lead qualification enabled
    const { data: clientConfig } = await supabaseServer
      .from('client_configs')
      .select('lead_qualification_enabled')
      .eq('client_id', form.user_id)
      .single();

    // Trigger AI lead qualification if enabled
    if (clientConfig?.lead_qualification_enabled && rowNumber) {
      const webhookUrl = process.env.N8N_LEAD_QUALIFICATION_WEBHOOK;
      
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
          // Don't fail the submission if webhook fails
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