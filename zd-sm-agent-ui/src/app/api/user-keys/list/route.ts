import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServerClient';
import { withSecurity } from '@/lib/security';

/**
 * GET /api/user-keys/list
 * 
 * List all API keys for the authenticated user
 * Returns masked keys (last 4 characters only) with validity status
 * 
 * Response:
 * {
 *   success: true,
 *   keys: [
 *     {
 *       provider: 'openai',
 *       lastFour: '3Xz9',
 *       isValid: true,
 *       createdAt: '2024-01-01T00:00:00Z',
 *       updatedAt: '2024-01-01T00:00:00Z'
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (userId: string) => {
      try {
        console.log(`[List API Keys] Fetching keys for user ${userId}`);
        
        // Fetch all API keys for the user (without decrypting)
        const { data: keys, error: fetchError } = await supabaseServer
          .from('user_api_keys')
          .select('provider, api_key_last_four, is_valid, created_at, updated_at')
          .eq('user_id', userId)
          .order('provider', { ascending: true });
        
        if (fetchError) {
          console.error('[List API Keys] Fetch failed:', fetchError);
          throw fetchError;
        }
        
        console.log(`[List API Keys] Found ${keys?.length || 0} keys for user ${userId}`);
        
        return NextResponse.json({
          success: true,
          keys: keys || [],
        });
      } catch (error: any) {
        console.error('[List API Keys] Error:', error);
        return NextResponse.json(
          { error: 'Failed to list API keys', details: error.message },
          { status: 500 }
        );
      }
    },
    {
      rateLimitKey: 'api-key-list',
      rateLimitMax: 100, // 100 lists per 15 minutes (generous for UI refreshes)
    }
  );
}