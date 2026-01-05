import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://ljjepgxndqpdztpscrnt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqamVwZ3huZHFwZHp0cHNjcm50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNDcyMTAsImV4cCI6MjA2ODkyMzIxMH0.jrLAWr0QdYjqDVZai-riymFSpZQDTAxKPQ0i0m6AFwQ";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,  // ← THIS IS THE CRUCIAL FIX
      flowType: "pkce",          // ← prevents redirect issues
    },
  }
);
