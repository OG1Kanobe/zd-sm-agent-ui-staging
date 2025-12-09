import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthenticatedClient } from '@/lib/auth-middleware';
import { Client } from '@upstash/qstash';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

interface RequestBody {
  action: 'schedule' | 'delete';
  messageId: string;
  time?: string;
}

interface QStashPayload {
  userId: string;
  clientConfigId: string;
  clientId: string;
  companyName: string | null;
  customPrompt: string | null;
  rssUrls: string[];
  scheduledTimeUTC: string;
  userTimezone: string;
  linkedin_organization_urn: string | null; // ← Add this
}

export async function POST(request: NextRequest) {
  // 1. AUTHENTICATE
  const authResult = await authenticateRequest(request);
  if ('error' in authResult) {
    return NextResponse.json(
      { success: false, message: authResult.error },
      { status: authResult.status }
    );
  }

  const { user, token } = authResult;
  const supabase = createAuthenticatedClient(token);

  // 2. VALIDATE ENV VARS
  const QSTASH_TOKEN = process.env.QSTASH_TOKEN;
  const N8N_SCHEDULED_WEBHOOK_URL = process.env.N8N_SCHEDULED_WEBHOOK_URL;

  if (!QSTASH_TOKEN || !N8N_SCHEDULED_WEBHOOK_URL) {
    console.error('Missing environment variables');
    return NextResponse.json(
      { success: false, message: 'Server misconfigured' },
      { status: 500 }
    );
  }

  const qstash = new Client({ token: QSTASH_TOKEN });

  // 3. GET USER TIMEZONE
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  const actualTimezone = profile?.timezone || 'UTC';

  // 4. PARSE BODY
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { action, messageId, time: scheduleTime } = body;

  // 5. HANDLE SCHEDULE ACTION
  if (action === 'schedule') {
    if (!scheduleTime) {
      return NextResponse.json(
        { success: false, message: 'Missing schedule time' },
        { status: 400 }
      );
    }

    // FETCH CONFIG (RLS enforces ownership)
    const { data: config, error: configError } = await supabase
      .from('client_configs')
      .select('id, client_id, company_name, custom_prompt, rss_urls, linkedin_organization_urn')
      .eq('id', messageId)
      .single();

    if (configError || !config) {
      console.error('Client config not found:', configError?.message);
      return NextResponse.json(
        { success: false, message: 'Client configuration not found or access denied' },
        { status: 404 }
      );
    }

    // VERIFY OWNERSHIP (extra safety)
    if (config.client_id !== user.id) {
      return NextResponse.json(
        { success: false, message: 'You do not have permission to schedule this config' },
        { status: 403 }
      );
    }

    // TIMEZONE CONVERSION (your existing logic)
    let targetTimeUTC: dayjs.Dayjs;
    const nowUTC = dayjs.utc();

    if (/^\d{2}:\d{2}$/.test(scheduleTime)) {
      const [h, m] = scheduleTime.split(':').map(Number);
      const nowInTargetTZ = dayjs().tz(actualTimezone);
      let targetTimeInLocalTZ = nowInTargetTZ
        .hour(h)
        .minute(m)
        .second(0)
        .millisecond(0);

      const nowInTargetTZ_withBuffer = nowInTargetTZ.add(5, 'second');

      if (targetTimeInLocalTZ.isBefore(nowInTargetTZ_withBuffer)) {
        console.log(`[ROLLOVER] Scheduling for tomorrow`);
        targetTimeInLocalTZ = targetTimeInLocalTZ.add(1, 'day');
      }

      let offsetHours = targetTimeInLocalTZ.utcOffset() / 60;
      if (actualTimezone === 'Africa/Johannesburg' && offsetHours <= 0) {
        offsetHours = 2;
        console.warn('Day.js offset failure. Overriding SAST offset.');
      }

      targetTimeUTC = targetTimeInLocalTZ
        .subtract(offsetHours, 'hour')
        .utc(true);

      if (!targetTimeUTC.isValid()) {
        console.error('UTC conversion failed');
        return NextResponse.json(
          { success: false, message: 'UTC conversion failed' },
          { status: 500 }
        );
      }
    } else {
      targetTimeUTC = dayjs.tz(scheduleTime, actualTimezone).utc();
    }

    const delaySeconds = Math.ceil(targetTimeUTC.diff(nowUTC) / 1000);

    if (delaySeconds < 1) {
      return NextResponse.json(
        { success: false, message: 'Schedule time must be in the future' },
        { status: 400 }
      );
    }

    // SCHEDULE WITH QSTASH
    try {
      const payload: QStashPayload = {
        userId: user.id,
        clientConfigId: messageId,
        clientId: config.client_id,
        companyName: config.company_name,
        customPrompt: config.custom_prompt,
        rssUrls: config.rss_urls,
        scheduledTimeUTC: targetTimeUTC.toISOString(),
        userTimezone: actualTimezone,
        linkedin_organization_urn: config.linkedin_organization_urn || null,
      };

      const qstashResponse = await qstash.publish({
        url: N8N_SCHEDULED_WEBHOOK_URL,
        messageId,
        body: JSON.stringify(payload),
        delay: delaySeconds,
        method: 'POST',
        contentType: 'application/json',
        headers: { 'Upstash-Forward-User-Timezone': actualTimezone },
      });

      // UPDATE DB WITH QSTASH MESSAGE ID
      await supabase
        .from('client_configs')
        .update({ qstash_message_id: qstashResponse.messageId })
        .eq('id', messageId);

      return NextResponse.json({
        success: true,
        message: `Scheduled for ${scheduleTime} (${actualTimezone})`,
        messageId: qstashResponse.messageId
      });

    } catch (error: any) {
      console.error('QStash schedule error:', error);
      return NextResponse.json(
        { success: false, message: `Scheduling failed: ${error.message}` },
        { status: 500 }
      );
    }
  }

  // 6. HANDLE DELETE ACTION
  if (action === 'delete') {
    try {
      // FETCH CONFIG (RLS enforces ownership)
      const { data: configData } = await supabase
        .from('client_configs')
        .select('qstash_message_id')
        .eq('id', messageId)
        .single();

      const qstashIdToDelete = configData?.qstash_message_id;

      if (qstashIdToDelete) {
        await qstash.schedules.delete(qstashIdToDelete);
      }

      await supabase
        .from('client_configs')
        .update({ qstash_message_id: null })
        .eq('id', messageId);

      return NextResponse.json({
        success: true,
        message: `Schedule deleted`
      });

    } catch (error: any) {
      console.error('QStash delete error:', error);
      return NextResponse.json(
        { success: false, message: `Delete failed: ${error.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { success: false, message: 'Invalid action provided' },
    { status: 400 }
  );
}