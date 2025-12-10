import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServerClient';
import { withSecurity } from '@/lib/security';

/**
 * DELETE /api/user-keys/delete
 * 
 * Delete an API key for a specific provider
 * 
 * Request body:
 * {
 *   provider: 'openai' | 'gemini' | 'perplexity' | 'anthropic'
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   provider: string,
 *   message: string
 * }
 */
export async function DELETE(request: NextRequest) {
  return withSecurity(
    request,
    async (userId: string) => {
      try {
        const body = await request.json();
        const { provider } = body;
        
        if (!provider) {
          return NextResponse.json(
            { error: 'Provider is required' },
            { status: 400 }
          );
        }
        
        // Validate provider
        const validProviders = ['openai', 'gemini', 'perplexity', 'anthropic'];
        if (!validProviders.includes(provider)) {
          return NextResponse.json(
            { error: 'Invalid provider' },
            { status: 400 }
          );
        }
        
        console.log(`[Delete API Key] Deleting ${provider} key for user ${userId}`);
        
        // Delete the key
        const { error: deleteError } = await supabaseServer
          .from('user_api_keys')
          .delete()
          .eq('user_id', userId)
          .eq('provider', provider);
        
        if (deleteError) {
          console.error('[Delete API Key] Delete failed:', deleteError);
          throw deleteError;
        }
        
        console.log(`[Delete API Key] Deleted ${provider} key for user ${userId}`);
        
        return NextResponse.json({
          success: true,
          provider,
          message: 'API key deleted successfully',
        });
      } catch (error: any) {
        console.error('[Delete API Key] Error:', error);
        return NextResponse.json(
          { error: 'Failed to delete API key', details: error.message },
          { status: 500 }
        );
      }
    },
    {
      rateLimitKey: 'api-key-delete',
      rateLimitMax: 10, // 10 deletions per 15 minutes
      auditAction: 'api_key_deleted',
    }
  );
}