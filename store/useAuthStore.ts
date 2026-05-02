import { create } from 'zustand';
import { EmailOtpType, Session, User } from '@supabase/supabase-js';
import {
  getSupabaseConfigError,
  SUPABASE_AUTH_REDIRECT_URL,
  supabase,
} from '@/services/supabaseClient';
import {
  pullUserStateFromSupabase,
  pushLocalStateToSupabase,
  syncProfileAndPreferences,
} from '@/services/supabaseSyncService';
import { useAppStore } from './useAppStore';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  initializeAuth: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncCurrentUserData: () => Promise<void>;
  handleAuthRedirect: (url: string) => Promise<boolean>;
  clearAuthError: () => void;
}

export const AUTH_CONFIRMATION_SIGN_IN_REQUIRED =
  'Email confirmed. Please sign in to continue.';

async function reconcileCloudState() {
  const localState = useAppStore.getState();
  const cloudState = await pullUserStateFromSupabase();

  if (cloudState?.hasCompletedOnboarding || cloudState?.selectedTopics?.length) {
    localState.applyCloudState(cloudState);
    return;
  }

  await pushLocalStateToSupabase(useAppStore.getState());
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: false,
  error: null,

  initializeAuth: async () => {
    if (!supabase) {
      set({ error: getSupabaseConfigError(), isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      set({ error: error.message, isLoading: false });
      return;
    }

    set({
      session: data.session,
      user: data.session?.user ?? null,
      isLoading: false,
    });

    if (data.session?.user) {
      await reconcileCloudState();
    }

    supabase.auth.onAuthStateChange((_event, nextSession) => {
      set({
        session: nextSession,
        user: nextSession?.user ?? null,
        error: nextSession?.user ? null : undefined,
      });

      if (nextSession?.user) {
        void reconcileCloudState();
      }
    });
  },

  signUpWithEmail: async (email, password) => {
    if (!supabase) {
      set({ error: getSupabaseConfigError() });
      return;
    }

    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: SUPABASE_AUTH_REDIRECT_URL,
      },
    });

    if (error) {
      set({ error: error.message, isLoading: false });
      return;
    }

    if (!data.session) {
      set({
        session: null,
        user: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    set({ session: data.session, user: data.session.user, isLoading: false });
    await pushLocalStateToSupabase(useAppStore.getState());
  },

  signInWithEmail: async (email, password) => {
    if (!supabase) {
      set({ error: getSupabaseConfigError() });
      return;
    }

    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      set({ error: error.message, isLoading: false });
      return;
    }

    set({ session: data.session, user: data.user, isLoading: false });
    await reconcileCloudState();
  },

  signOut: async () => {
    if (!supabase) {
      set({ session: null, user: null, error: null });
      return;
    }

    set({ isLoading: true, error: null });
    await syncProfileAndPreferences(useAppStore.getState());
    const { error } = await supabase.auth.signOut();

    set({
      session: null,
      user: null,
      isLoading: false,
      error: error?.message ?? null,
    });
  },

  syncCurrentUserData: async () => {
    set({ error: null });
    try {
      await pushLocalStateToSupabase(useAppStore.getState());
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to sync account data.' });
    }
  },

  handleAuthRedirect: async (url) => {
    if (!supabase) {
      set({ error: getSupabaseConfigError(), isLoading: false });
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      const parsedUrl = new URL(url);
      const searchParams = new URLSearchParams(parsedUrl.search);
      const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
      const params = new URLSearchParams([...searchParams.entries(), ...hashParams.entries()]);

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const code = params.get('code');
      const tokenHash = params.get('token_hash');
      const type = params.get('type') as EmailOtpType | null;
      const linkError = params.get('error') ?? params.get('error_code');
      const linkErrorDescription = params.get('error_description') ?? params.get('error_message');

      if (linkError) {
        throw new Error(linkErrorDescription ?? 'This confirmation link is invalid or expired.');
      }

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) throw error;

        set({ session: data.session, user: data.session?.user ?? null, isLoading: false });
        await reconcileCloudState();
        return Boolean(data.session?.user);
      }

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) throw error;

        set({ session: data.session, user: data.session?.user ?? null, isLoading: false });
        await reconcileCloudState();
        return Boolean(data.session?.user);
      }

      if (tokenHash && type) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });

        if (error) throw error;

        set({ session: data.session, user: data.user, isLoading: false });
        await reconcileCloudState();
        return Boolean(data.user);
      }

      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (data.session?.user) {
        set({
          session: data.session,
          user: data.session.user,
          isLoading: false,
          error: null,
        });
        await reconcileCloudState();
        return true;
      }

      set({
        isLoading: false,
        error: AUTH_CONFIRMATION_SIGN_IN_REQUIRED,
      });
      return false;
    } catch (error) {
      const { data } = await supabase.auth.getSession();

      if (data.session?.user) {
        set({
          session: data.session,
          user: data.session.user,
          isLoading: false,
          error: null,
        });
        await reconcileCloudState();
        return true;
      }

      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unable to confirm your email.',
      });
      return false;
    }
  },

  clearAuthError: () => set({ error: null }),
}));
