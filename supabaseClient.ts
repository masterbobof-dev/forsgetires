import { createClient } from '@supabase/supabase-js';

// Keys should be stored in .env.local:
// VITE_SUPABASE_URL=https://zzxueclhkhvwdmxflmyx.supabase.co
// VITE_SUPABASE_KEY=your_anon_key
// Uses env variables if available, otherwise falls back to hardcoded values
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zzxueclhkhvwdmxflmyx.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6eHVlY2xoa2h2d2RteGZsbXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjEzMTAsImV4cCI6MjA4MDIzNzMxMH0.yJW-HC03EwyYPpyWTrDbTN4t0YrlNe1H40fwLZ_ZxfU';

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
