"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { explainAuthError, readStoredSession } from "@/lib/auth-time";
import { seedProfile } from "@/lib/profiles";
import { syncLedgerSession } from "@/lib/ledger-store";
import { getSupabase, isSupabaseConfigured, setActiveUser } from "@/lib/supabase";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  sendReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function accountUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata as Record<string, unknown>,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) {
      setActiveUser(null);
      syncLedgerSession(null);
      return;
    }
    const supabase = getSupabase();
    const apply = (next: Session | null) => {
      setSession(next);
      setUser(next?.user ?? null);
      setActiveUser(next?.user?.id ?? null);
      syncLedgerSession(next?.user ? accountUser(next.user) : null);
      setLoading(false);
    };
    const stored = readStoredSession();
    if (stored) {
      const cached = stored.user as User;
      setUser(cached);
      setActiveUser(cached.id);
      syncLedgerSession(accountUser(cached));
      setLoading(false);
    }
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      window.setTimeout(() => apply(next), 0);
    });
    const timeout = window.setTimeout(() => setLoading(false), 1200);
    return () => {
      window.clearTimeout(timeout);
      data.subscription.unsubscribe();
    };
  }, [configured]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    loading,
    configured,
    async signIn(email, password) {
      const { data, error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (error) return explainAuthError(error.message);
      if (!data.session || !data.user) return "Confirm your email, then sign in.";
      const profileError = await seedProfile(accountUser(data.user));
      return profileError;
    },
    async signUp(name, email, password) {
      const origin = window.location.origin;
      const { data, error } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name, user_name: name },
          emailRedirectTo: `${origin}/`,
        },
      });
      if (error) return explainAuthError(error.message);
      const already = !data.session && Array.isArray(data.user?.identities) && data.user.identities.length === 0;
      if (already) return "This email already has an account. Sign in instead.";
      if (!data.user) return "The account could not be created.";
      if (!data.session) return "Confirm the email from Supabase, then sign in.";
      return seedProfile({
        id: data.user.id,
        email: data.user.email,
        user_metadata: { ...data.user.user_metadata, full_name: name, user_name: name },
      });
    },
    async sendReset(email) {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return error?.message ?? null;
    },
    async updatePassword(password) {
      const { error } = await getSupabase().auth.updateUser({ password });
      return error?.message ?? null;
    },
    async signOut() {
      await getSupabase().auth.signOut();
    },
  }), [configured, loading, session, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
