import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type Platform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok';

export async function POST(req: NextRequest) {
  try {
    const {
      sourcePostId,
      platforms,
    } = await req.json();

    // Validation
    if (!sourcePostId) {
      return NextResponse.json({ error: 'Missing sourcePostId' }, { status: 400 });
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json({ error: 'Must select at least one platform' }, { status: 400 });
    }

    // 1. Fetch source post details
    const { data: sourcePost, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', sourcePostId)
      .single();

    if (fetchError || !sourcePost) {
      console.error('[CreateCrossPostRows] Error fetching source:', fetchError);
      return NextResponse.json({ error: 'Source post not found' }, { status: 404 });
    }

    // 2. Create new rows for each platform
    const newPosts = [];

    for (const platform of platforms as Platform[]) {
      const newPost = {
        user_id: sourcePost.user_id,
        content_group_id: sourcePost.content_group_id, // ✅ SAME group ID
        source_type: 'social_post' as const,
        platform: platform,
        
        // ✅ Copy all content from source
        image_url: sourcePost.image_url,
        video_url: sourcePost.video_url,
        video_thumbnail_url: sourcePost.video_thumbnail_url,
        caption: sourcePost.caption,
        category: sourcePost.category,
        tags: sourcePost.tags,
        orientation: sourcePost.orientation,
        duration: sourcePost.duration,
        
        // Set parent_post_id to track this is a cross-post
        parent_post_id: sourcePostId,
        
        // Initial status
        status: 'Draft' as const,
        published: false,
        discard: false,
      };

      const { data: insertedPost, error: insertError } = await supabase
        .from('posts')
        .insert(newPost)
        .select()
        .single();

      if (insertError) {
        console.error(`[CreateCrossPostRows] Error inserting ${platform}:`, insertError);
        throw insertError;
      }

      newPosts.push(insertedPost);
    }

    console.log('[CreateCrossPostRows] Created rows:', newPosts.map(p => ({ id: p.id, platform: p.platform })));

    return NextResponse.json({
      success: true,
      newPosts: newPosts.map(p => ({ id: p.id, platform: p.platform })),
    });

  } catch (error: any) {
    console.error('[CreateCrossPostRows] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create cross-post rows' },
      { status: 500 }
    );
  }
}