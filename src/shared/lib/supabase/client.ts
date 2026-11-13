import { createClient } from '@supabase/supabase-js';

const env = (import.meta.env || {}) as Record<string, string | undefined>;

const supabaseUrl: string =
  env.VITE_SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://emcsgczybqryxjxucfva.supabase.co';

const supabaseAnonKey: string =
  env.VITE_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtY3NnY3p5YnFyeXhqeHVjZnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMzIxNDAsImV4cCI6MjEwNDkwODE0MH0.canNtSU-Rj-Sab77ip_MVLsNeptdbSHhgbWPW_GiDjQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});
