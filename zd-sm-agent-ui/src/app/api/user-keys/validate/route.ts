import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServerClient';
import { decryptApiKey } from '@/lib/encryption';
import { withSecurity } from '@/lib/security';

/**
 * POST /api/user-keys/validate
 * 
 * Validate an API key by making a test request to the provider
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
 *   isValid: boolean,
 *   message: string
 * }
 */
export async function POST(request: NextRequest) {
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
        
        console.log(`[Validate API Key] Validating ${provider} key for user ${userId}`);
        
        // Fetch the encrypted key from database
        const { data: keyData, error: fetchError } = await supabaseServer
          .from('user_api_keys')
          .select('api_key_encrypted')
          .eq('user_id', userId)
          .eq('provider', provider)
          .single();
        
        if (fetchError || !keyData) {
          return NextResponse.json(
            { error: `No API key found for ${provider}` },
            { status: 404 }
          );
        }
        
        // Decrypt the API key
        const apiKey = decryptApiKey(keyData.api_key_encrypted);
        
        // Validate based on provider
        let isValid = false;
        let message = '';
        
        try {
          switch (provider) {
            case 'openai':
              isValid = await validateOpenAI(apiKey);
              message = isValid ? 'OpenAI API key is valid' : 'OpenAI API key is invalid';
              break;
            
            case 'gemini':
              isValid = await validateGemini(apiKey);
              message = isValid ? 'Gemini API key is valid' : 'Gemini API key is invalid';
              break;
            
            case 'perplexity':
              isValid = await validatePerplexity(apiKey);
              message = isValid ? 'Perplexity API key is valid' : 'Perplexity API key is invalid';
              break;
            
            case 'anthropic':
              isValid = await validateAnthropic(apiKey);
              message = isValid ? 'Anthropic API key is valid' : 'Anthropic API key is invalid';
              break;
            
            default:
              return NextResponse.json(
                { error: 'Unsupported provider' },
                { status: 400 }
              );
          }
        } catch (error: any) {
          console.error(`[Validate API Key] Validation error for ${provider}:`, error);
          isValid = false;
          message = `Validation failed: ${error.message}`;
        }
        
        // Update the is_valid flag in database
        await supabaseServer
          .from('user_api_keys')
          .update({ is_valid: isValid, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('provider', provider);
        
        console.log(`[Validate API Key] ${provider} key for user ${userId}: ${isValid ? 'VALID' : 'INVALID'}`);
        
        return NextResponse.json({
          success: true,
          provider,
          isValid,
          message,
        });
      } catch (error: any) {
        console.error('[Validate API Key] Error:', error);
        return NextResponse.json(
          { error: 'Failed to validate API key', details: error.message },
          { status: 500 }
        );
      }
    },
    {
      rateLimitKey: 'api-key-validate',
      rateLimitMax: 20, // 20 validations per 15 minutes
      auditAction: 'api_key_validated',
    }
  );
}

/**
 * Validate OpenAI API key by making a test request
 */
async function validateOpenAI(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    return response.ok;
  } catch (error) {
    console.error('[OpenAI Validation] Error:', error);
    return false;
  }
}

/**
 * Validate Gemini API key by making a test request
 */
async function validateGemini(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: 'GET',
      }
    );
    
    return response.ok;
  } catch (error) {
    console.error('[Gemini Validation] Error:', error);
    return false;
  }
}

/**
 * Validate Perplexity API key by making a test request
 */
async function validatePerplexity(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    });
    
    // Perplexity returns 200 even for invalid keys sometimes, so check response
    const data = await response.json();
    
    // If we get an error about authentication, key is invalid
    if (data.error && data.error.message?.includes('authentication')) {
      return false;
    }
    
    return response.ok;
  } catch (error) {
    console.error('[Perplexity Validation] Error:', error);
    return false;
  }
}

/**
 * Validate Anthropic API key by making a test request
 */
async function validateAnthropic(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('[Anthropic Validation] Error:', error);
    return false;
  }
}