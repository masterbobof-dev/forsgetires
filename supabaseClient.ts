import { createClient } from '@supabase/supabase-js';

// Keys should be stored in .env.local:
// VITE_SUPABASE_URL=https://zzxueclhkhvwdmxflmyx.supabase.co
// VITE_SUPABASE_KEY=your_anon_key
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.');
}

// Singleton pattern to avoid multiple instances on hot reload
const getSupabase = () => {
  if (typeof window !== 'undefined') {
    if ((window as any)._supabaseInstance) {
      return (window as any)._supabaseInstance;
    }
    const client = createClient(SUPABASE_URL, SUPABASE_KEY);
    (window as any)._supabaseInstance = client;
    return client;
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY);
};

export const supabase = getSupabase();
