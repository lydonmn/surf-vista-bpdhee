
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/app/integrations/supabase/client';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { Database } from '@/app/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface User extends SupabaseUser {
  profile?: Profile;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  signUp: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean; message: string }>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<void>;
  checkSubscription: () => boolean;
  isAdmin: () => boolean;
  isRegionalAdmin: () => boolean;
  canManageLocation: (locationId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  console.log('[AuthProvider] ===== MOUNTING =====');
  
  // 🚨 CRITICAL FIX: Start with initialized=false, set to true after setup
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const mountedRef = useRef(true);
  const initStartedRef = useRef(false);

  const loadUserProfile = useCallback(async (authUser: SupabaseUser) => {
    if (!mountedRef.current) return;
    
    try {
      console.log('[AuthContext] Loading profile for user:', authUser.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (!mountedRef.current) return;

      if (data) {
        console.log('[AuthContext] Profile loaded successfully');
        setProfile(data);
        setUser({ ...authUser, profile: data });
        return;
      }

      // Profile not found - try to create
      if (error?.code === 'PGRST116') {
        console.log('[AuthContext] Profile not found, creating...');
        
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: authUser.id,
            email: authUser.email,
            is_admin: false,
            is_subscribed: false,
          })
          .select()
          .single();
        
        if (!mountedRef.current) return;
        
        if (newProfile) {
          console.log('[AuthContext] Profile created successfully');
          setProfile(newProfile);
          setUser({ ...authUser, profile: newProfile });
          return;
        }
      }

      // Fallback
      console.log('[AuthContext] Using user without profile');
      if (mountedRef.current) {
        setProfile(null);
        setUser({ ...authUser });
      }
    } catch (err) {
      console.error('[AuthContext] Profile load error:', err);
      if (mountedRef.current) {
        setProfile(null);
        setUser({ ...authUser });
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    console.log('[AuthContext] Signing out...');
    
    setUser(null);
    setProfile(null);
    setSession(null);
    setIsLoading(false);
    
    try {
      await supabase.auth.signOut();
      console.log('[AuthContext] Sign out successful');
    } catch (err) {
      console.error('[AuthContext] Sign out error:', err);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      console.log('[AuthContext] Refreshing session...');
      
      const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[AuthContext] Refresh error:', error);
        
        if (error.message.includes('Invalid Refresh Token') || 
            error.message.includes('Refresh Token Not Found')) {
          await AsyncStorage.removeItem('supabase.auth.token').catch(() => {});
          await signOut();
        }
        return;
      }
      
      if (newSession) {
        console.log('[AuthContext] Session refreshed successfully');
        setSession(newSession);
        if (newSession.user) {
          await loadUserProfile(newSession.user);
        }
      }
    } catch (err) {
      console.error('[AuthContext] Refresh error:', err);
    }
  }, [loadUserProfile, signOut]);

  // 🚨 CRITICAL FIX: Proper initialization sequence
  useEffect(() => {
    // Prevent double initialization
    if (initStartedRef.current) {
      console.log('[AuthContext] Init already started, skipping...');
      return;
    }
    
    initStartedRef.current = true;
    console.log('[AuthContext] ===== STARTING INITIALIZATION =====');

    let authSubscription: { unsubscribe: () => void } | null = null;

    const initialize = async () => {
      try {
        // Set up auth state listener first
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (!mountedRef.current) return;

          console.log('[AuthContext] Auth event:', event);

          try {
            if (event === 'SIGNED_OUT') {
              if (mountedRef.current) {
                setUser(null);
                setProfile(null);
                setSession(null);
                setIsLoading(false);
              }
            } else if (event === 'SIGNED_IN' && newSession?.user) {
              if (mountedRef.current) {
                setSession(newSession);
                await loadUserProfile(newSession.user);
                setIsLoading(false);
              }
            } else if (event === 'TOKEN_REFRESHED' && newSession?.user) {
              if (mountedRef.current) {
                setSession(newSession);
              }
            } else if (event === 'USER_UPDATED' && newSession?.user) {
              if (mountedRef.current) {
                setSession(newSession);
                await loadUserProfile(newSession.user);
                setIsLoading(false);
              }
            } else if (!newSession) {
              if (mountedRef.current) {
                setUser(null);
                setProfile(null);
                setSession(null);
                setIsLoading(false);
              }
            }
          } catch (err) {
            console.error('[AuthContext] Auth state error:', err);
          }
        });

        authSubscription = subscription;

        // Load initial session
        console.log('[AuthContext] Loading initial session...');
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AuthContext] Session error:', error);
        } else if (initialSession?.user) {
          console.log('[AuthContext] Initial session found');
          if (mountedRef.current) {
            setSession(initialSession);
            await loadUserProfile(initialSession.user);
          }
        } else {
          console.log('[AuthContext] No initial session');
        }

        // Mark as initialized
        if (mountedRef.current) {
          console.log('[AuthContext] ===== INITIALIZATION COMPLETE =====');
          setIsLoading(false);
          setIsInitialized(true);
        }
      } catch (err) {
        console.error('[AuthContext] Init error:', err);
        if (mountedRef.current) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initialize();

    return () => {
      console.log('[AuthContext] ===== CLEANUP =====');
      mountedRef.current = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [loadUserProfile]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await loadUserProfile(session.user);
    }
  }, [session?.user, loadUserProfile]);

  const signUp = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const getRedirectUrl = () => {
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined') {
            return `${window.location.origin}/verification-success`;
          }
          return undefined;
        } else {
          return 'surfvista://verification-success';
        }
      };

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getRedirectUrl(),
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          return { 
            success: false, 
            message: 'This email is already registered. Please sign in instead.' 
          };
        }
        if (error.message.includes('rate limit') || error.message.includes('email rate limit exceeded')) {
          return { 
            success: false, 
            message: 'Too many signup attempts. Please wait a few minutes and try again, or contact support for assistance.' 
          };
        }
        return { success: false, message: error.message };
      }

      if (data.user && !data.session) {
        return { 
          success: true, 
          message: 'Account created! Please check your email to verify your account.' 
        };
      }

      return { success: true, message: 'Account created successfully!' };
    } catch (error: any) {
      return { success: false, message: error.message || 'An unexpected error occurred' };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setIsLoading(false);
        
        if (error.message.includes('Email not confirmed')) {
          return { 
            success: false, 
            message: 'Please verify your email address before signing in.' 
          };
        } else if (error.message.includes('Invalid login credentials')) {
          return { 
            success: false, 
            message: 'Invalid email or password.' 
          };
        }
        
        return { success: false, message: error.message };
      }

      if (data.user && data.session) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, message: 'Signed in successfully!' };
      }

      setIsLoading(false);
      return { success: false, message: 'Sign in failed' };
    } catch (error: any) {
      setIsLoading(false);
      return { success: false, message: error.message || 'An unexpected error occurred' };
    }
  };

  const deleteAccount = async (): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: 'No user is currently signed in' };
    }

    try {
      const userId = user.id;

      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);

      setUser(null);
      setProfile(null);
      setSession(null);
      setIsLoading(false);

      return { success: true, message: 'Your account has been permanently deleted' };
    } catch (error: any) {
      await signOut();
      return { success: false, message: error.message || 'An unexpected error occurred' };
    }
  };

  const checkSubscription = useCallback((): boolean => {
    if (!profile) return false;
    if (profile.is_admin) return true;
    if (!profile.is_subscribed) return false;
    if (!profile.subscription_end_date) return true;
    
    const endDate = new Date(profile.subscription_end_date);
    return endDate > new Date();
  }, [profile]);

  const isAdmin = useCallback((): boolean => {
    return profile?.is_admin || false;
  }, [profile]);

  const isRegionalAdmin = useCallback((): boolean => {
    return profile?.is_regional_admin || false;
  }, [profile]);

  const canManageLocation = useCallback((locationId: string): boolean => {
    if (profile?.is_admin) return true;
    if (profile?.is_regional_admin && profile.managed_locations) {
      return profile.managed_locations.includes(locationId);
    }
    return false;
  }, [profile]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile,
      session,
      isLoading, 
      isInitialized,
      signUp,
      signIn, 
      signOut,
      deleteAccount,
      refreshProfile,
      refreshSession,
      checkSubscription,
      isAdmin,
      isRegionalAdmin,
      canManageLocation
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
