import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServerClient';
import { encryptApiKey, getLastFourChars, validateApiKeyFormat } from '@/lib/encryption';
import { withSecurity } from '@/lib/security';

/**
 * POST /api/user-keys/save
 * 
 * Save an encrypted API key for a user
 * 
 * Request body:
 * {
 *   provider: 'openai' | 'gemini' | 'perplexity' | 'anthropic',
 *   apiKey: string,
 *   skipValidation?: boolean
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   provider: string,
 *   lastFour: string,
 *   isValid: boolean
 * }
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (userId: string) => {
      try {
        const body = await request.json();
        const { provider, apiKey, skipValidation } = body;
        
        // Validate input
        if (!provider || !apiKey) {
          return NextResponse.json(
            { error: 'Provider and API key are required' },
            { status: 400 }
          );
        }
        
        // Validate provider
        const validProviders = ['openai', 'gemini', 'perplexity', 'anthropic'];
        if (!validProviders.includes(provider)) {
          return NextResponse.json(
            { error: 'Invalid provider. Must be one of: openai, gemini, perplexity, anthropic' },
            { status: 400 }
          );
        }
        
        // Validate API key format
        if (!skipValidation && !validateApiKeyFormat(provider, apiKey)) {
          return NextResponse.json(
            { error: `Invalid API key format for ${provider}` },
            { status: 400 }
          );
        }
        
        // Encrypt the API key
        const encryptedKey = encryptApiKey(apiKey);
        const lastFour = getLastFourChars(apiKey);
        
        console.log(`[Save API Key] Saving ${provider} key for user ${userId} (last 4: ${lastFour})`);
        
        // Check if key already exists for this provider
        const { data: existing } = await supabaseServer
          .from('user_api_keys')
          .select('id')
          .eq('user_id', userId)
          .eq('provider', provider)
          .single();
        
        if (existing) {
          // Update existing key
          const { error: updateError } = await supabaseServer
            .from('user_api_keys')
            .update({
              api_key_encrypted: encryptedKey,
              api_key_last_four: lastFour,
              is_valid: true,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            .eq('provider', provider);
          
          if (updateError) {
            console.error('[Save API Key] Update failed:', updateError);
            throw updateError;
          }
          
          console.log(`[Save API Key] Updated existing ${provider} key for user ${userId}`);
        } else {
          // Insert new key
          const { error: insertError } = await supabaseServer
            .from('user_api_keys')
            .insert({
              user_id: userId,
              provider,
                api_key_encrypted: encryptedKey,
  api_key_last_four: lastFour,
              is_valid: true,
            });
          
          if (insertError) {
            console.error('[Save API Key] Insert failed:', insertError);
            throw insertError;
          }
          
          console.log(`[Save API Key] Created new ${provider} key for user ${userId}`);
        }
        
        return NextResponse.json({
          success: true,
          provider,
          lastFour,
          isValid: true,
        });
      } catch (error: any) {
        console.error('[Save API Key] Error:', error);
        return NextResponse.json(
          { error: 'Failed to save API key', details: error.message },
          { status: 500 }
        );
      }
    },
    {
      rateLimitKey: 'api-key-save',
      rateLimitMax: 10, // 10 saves per 15 minutes
      auditAction: 'api_key_saved',
    }
  );
}