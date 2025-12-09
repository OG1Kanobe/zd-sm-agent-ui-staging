// lib/supabaseServerClients.ts
import { createClient } from '@supabase/supabase-js';

/**
 * IMPORTANT:
 * This file MUST ONLY run on the server — NEVER in the browser.
 * Make sure no frontend code imports this file.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables safely
if (!SUPABASE_URL) {
  throw new Error(
    'Missing environment variable: NEXT_PUBLIC_SUPABASE_URL. Make sure it is defined.'
  );
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing environment variable: SUPABASE_SERVICE_ROLE_KEY. This must be set on the server.'
  );
}

/**
 * Create a server‑side Supabase client using the Service Role Key.
 *
 * WARNING:
 * - This key bypasses all Row Level Security.
 * - Never use this client in the browser.
 * - Only import this file inside API routes or server components/actions.
 */
export const supabaseServer = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
