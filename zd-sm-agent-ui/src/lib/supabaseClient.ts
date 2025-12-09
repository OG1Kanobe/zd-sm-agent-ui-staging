import { createClient, Session, AuthChangeEvent } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables. Please define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

// FRONTEND client only
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type { Session, AuthChangeEvent };

export interface Post {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  display_name?: string;
  likes?: number;
  comments?: number;
  image_url?: string;
  platforms?: string[];
  status?: 'Draft' | 'Scheduled' | 'Published' | 'Discarded';
  scheduled_at?: string | null;
}
