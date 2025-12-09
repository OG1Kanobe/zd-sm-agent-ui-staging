import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServerClient';

export async function POST(req: NextRequest) {
  try {
    // 1. PARSE BODY
    const body = await req.json();
    const { userId, type, message, title, postId } = body;

    console.log('[Notifications API] Received:', body);

    // 2. VALIDATE REQUIRED FIELDS
    if (!userId || !type || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, type, message' },
        { status: 400 }
      );
    }

    // 3. VALIDATE TYPE
    const validTypes = ['success', 'error', 'warning', 'info', 'other'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // 4. VERIFY USER EXISTS (basic security check)
// 4. VERIFY USER EXISTS (basic security check)
const { data: userExists, error: userError } = await supabaseServer.auth.admin.getUserById(userId);

if (userError || !userExists) {
  console.error('[Notifications API] Invalid userId:', userId);
  return NextResponse.json(
    { error: 'Invalid userId' },
    { status: 400 }
  );
}

    // 5. CREATE NOTIFICATION IN DATABASE (without metadata field)
    const { data, error } = await supabaseServer
      .from('notifications')
      .insert({
        user_id: userId,
        type: type,
        message: message,
        title: title || null,
        post_id: postId || null,
        is_read: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[Notifications API] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to create notification', details: error.message },
        { status: 500 }
      );
    }

    console.log('[Notifications API] Notification created:', data.id);

    return NextResponse.json({
      success: true,
      notificationId: data.id,
    });

  } catch (err: any) {
    console.error('[Notifications API] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}