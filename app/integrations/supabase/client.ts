import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://ucbilksfpnmltrkwvzft.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYmlsa3NmcG5tbHRya3d2emZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDM2MjcsImV4cCI6MjA4MTQxOTYyN30.pQkSbD0JzvRV4_lj0rAmeaQFZqK1QVW0EkVlhYM-KA8";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
