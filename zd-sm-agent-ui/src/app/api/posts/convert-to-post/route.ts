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
      caption,
      platforms,
      category,
      tags,
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
      console.error('[ConvertToPost] Error fetching source:', fetchError);
      return NextResponse.json({ error: 'Source post not found' }, { status: 404 });
    }

    // 2. Generate new content_group_id
    const { data: uuidData } = await supabase.rpc('gen_random_uuid');
    const contentGroupId = uuidData || crypto.randomUUID();

    // 3. Create new rows for each platform
    const newPosts = [];

    for (const platform of platforms as Platform[]) {
      const newPost = {
        user_id: sourcePost.user_id,
        content_group_id: contentGroupId,
        source_type: 'social_post' as const,
        platform: platform,
        
        // Copy from source
        image_url: sourcePost.image_url,
        
        // Use provided caption or copy from source
        caption: caption || sourcePost.caption || null,
        
        // Use provided category/tags or copy from source
        category: category || sourcePost.category,
        tags: tags && tags.length > 0 ? tags : sourcePost.tags,
        
        // Set parent_post_id to track origin
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
        console.error(`[ConvertToPost] Error inserting ${platform}:`, insertError);
        throw insertError;
      }

      newPosts.push(insertedPost);
    }

    console.log('[ConvertToPost] Created posts:', newPosts.map(p => ({ id: p.id, platform: p.platform })));

    return NextResponse.json({
      success: true,
      contentGroupId,
      newPosts: newPosts.map(p => ({ id: p.id, platform: p.platform })),
    });

  } catch (error: any) {
    console.error('[ConvertToPost] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to convert to post' },
      { status: 500 }
    );
  }
}