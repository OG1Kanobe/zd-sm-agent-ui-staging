import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export interface AuthenticatedUser {
  user: {
    id: string;
    email: string;
  };
  token: string;
}

/**
 * Authenticates a request using JWT token from Authorization header
 * Returns user data if valid, or error object if invalid
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<{ error: string; status: number } | AuthenticatedUser> {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  
  // Use anon key for JWT verification (this is safe and correct)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.error('Auth error:', error?.message);
    return { error: 'Invalid or expired token', status: 401 };
  }

  return { 
    user: { 
      id: user.id, 
      email: user.email || '' 
    }, 
    token 
  };
}

/**
 * Helper to create an authenticated Supabase client
 * This client respects RLS policies for the authenticated user
 */
export function createAuthenticatedClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  );
}