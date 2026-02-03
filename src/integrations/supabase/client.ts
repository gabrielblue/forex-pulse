import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

// Add auth state logging
supabase.auth.onAuthStateChange((event, session) => {
  console.log('🔐 Auth state change:', event, session ? 'Session exists' : 'No session');
  if (session) {
    console.log('👤 User ID:', session.user.id);
  }
});

// Function to refresh the session if expired
export async function refreshSessionIfExpired(): Promise<boolean> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.log('⚠️ No valid session found - attempting to refresh...');
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshedSession) {
        console.error('❌ Failed to refresh session:', refreshError?.message);
        return false;
      }
      
      console.log('✅ Session refreshed successfully');
      return true;
    }
    
    // Check if session is expired
    if (session.expires_at && new Date(session.expires_at * 1000) <= new Date()) {
      console.log('🔄 Session expired, attempting to refresh...');
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshedSession) {
        console.error('❌ Failed to refresh expired session:', refreshError?.message);
        return false;
      }
      
      console.log('✅ Expired session refreshed successfully');
      return true;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error refreshing session:', error);
    return false;
  }
}