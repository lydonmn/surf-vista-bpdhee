
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = "https://ucbilksfpnmltrkwvzft.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYmlsa3NmcG5tbHRya3d2emZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDM2MjcsImV4cCI6MjA4MTQxOTYyN30.pQkSbD0JzvRV4_lj0rAmeaQFZqK1QVW0EkVlhYM-KA8";

// Web-safe AsyncStorage adapter
const webSafeStorage = {
  getItem: async (key: string) => {
    try {
      if (Platform.OS === 'web' && typeof window === 'undefined') {
        return null;
      }
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('[Supabase Storage] getItem error:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      if (Platform.OS === 'web' && typeof window === 'undefined') {
        return;
      }
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('[Supabase Storage] setItem error:', error);
    }
  },
  removeItem: async (key: string) => {
    try {
      if (Platform.OS === 'web' && typeof window === 'undefined') {
        return;
      }
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('[Supabase Storage] removeItem error:', error);
    }
  },
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: webSafeStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
