import { supabase } from '@/lib/supabaseClient';

/**
 * Makes an authenticated API call with the user's JWT token
 * Automatically handles session retrieval and authorization headers
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get current session token
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.error('[authenticatedFetch] Session error:', sessionError);
    throw new Error(`Session error: ${sessionError.message}`);
  }
  
  if (!session?.access_token) {
    console.error('[authenticatedFetch] No active session');
    throw new Error('No active session. Please log in.');
  }

  console.log('[authenticatedFetch] Making request to:', url);

  // Add Authorization header
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  headers.set('Content-Type', 'application/json');

  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
  });

  console.log('[authenticatedFetch] Response status:', response.status);

  return response;
}

/**
 * Convenience wrapper that automatically parses JSON responses
 * and throws errors for non-OK responses
 */
export async function authenticatedFetchJSON<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await authenticatedFetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }

  return data;
}