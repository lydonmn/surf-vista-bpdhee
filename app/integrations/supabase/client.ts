
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native';

const SUPABASE_URL = "https://ucbilksfpnmltrkwvzft.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYmlsa3NmcG5tbHRya3d2emZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDM2MjcsImV4cCI6MjA4MTQxOTYyN30.pQkSbD0JzvRV4_lj0rAmeaQFZqK1QVW0EkVlhYM-KA8";

// 🚨 CRITICAL: Web-compatible storage adapter
// AsyncStorage has issues on web during SSR/initial load
// Use a safe wrapper that falls back to localStorage on web
const createWebSafeStorage = () => {
  if (Platform.OS === 'web') {
    // Web: Use localStorage directly (available immediately)
    return {
      getItem: async (key: string) => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem(key);
          }
          return null;
        } catch {
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, value);
          }
        } catch {
          // Silently fail
        }
      },
      removeItem: async (key: string) => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(key);
          }
        } catch {
          // Silently fail
        }
      },
    };
  }
  
  // Native: Use AsyncStorage (works perfectly on iOS/Android)
  return AsyncStorage;
};

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: createWebSafeStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Suppress refresh token errors in console
    debug: false,
  },
  global: {
    headers: {
      'x-client-info': 'supabase-js-react-native',
    },
  },
})
