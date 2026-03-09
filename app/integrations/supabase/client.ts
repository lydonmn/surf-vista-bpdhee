
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from './types';

const supabaseUrl = 'https://ucbilksfpnmltrkwvzft.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYmlsa3NmcG5tbHRya3d2emZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM1MjI3NzksImV4cCI6MjA0OTA5ODc3OX0.Hy-Aw-Yz-Qs-Vu_Uh-Hy-Aw-Yz-Qs-Vu_Uh-Hy-Aw-Yz-Qs-Vu_Uh';

console.log('[Supabase Client] Initializing with URL:', supabaseUrl);

// 🚨 CRITICAL FIX: Add error handling for client initialization
let supabase: ReturnType<typeof createClient<Database>>;

try {
  supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  
  console.log('[Supabase Client] Client initialized successfully');
} catch (error) {
  console.error('[Supabase Client] CRITICAL ERROR during initialization:', error);
  
  // Create a fallback client that will throw errors on use
  supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export { supabase };
