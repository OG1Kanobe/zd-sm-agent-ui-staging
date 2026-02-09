import { NextRequest, NextResponse } from 'next/server';
import { generateWebhookToken } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, testMessage } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    // Generate JWT token
    const token = generateWebhookToken(userId);

    console.log('[JWT Test] Generated token for user:', userId);

    // Call n8n test webhook
    const webhookUrl = process.env.N8N_JWT_TEST_WEBHOOK;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'N8N_JWT_TEST_WEBHOOK not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        userId,
        testMessage: testMessage || 'Hello from JWT test!',
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[JWT Test] n8n returned error:', errorText);
      return NextResponse.json(
        { error: 'n8n webhook failed', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: 'JWT test successful',
      token, // Include token in response for debugging
      n8nResponse: result
    });

  } catch (err: any) {
    console.error('[JWT Test] Error:', err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}