import { useState, useEffect } from 'react';
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase';

const SESSION_KEY = 'kri_session';

export interface KRIUser {
  id: string;
  email: string;
  tour_completed: boolean;
}

export interface AuthState {
  user: KRIUser | null;
  loading: boolean;
  isTourCompleted: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  markTourComplete: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<KRIUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase
      .from('kri_users')
      .select('id, email, password_hash, tour_completed')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !data) throw new Error('Invalid email or password.');

    const valid = await bcrypt.compare(password, data.password_hash);
    if (!valid) throw new Error('Invalid email or password.');

    const sessionUser: KRIUser = {
      id: data.id,
      email: data.email,
      tour_completed: data.tour_completed ?? false,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    setUser(sessionUser);
  };

  const signUp = async (email: string, password: string) => {
    const hash = await bcrypt.hash(password, 10);
    const { error } = await supabase
      .from('kri_users')
      .insert({ email: email.toLowerCase().trim(), password_hash: hash });

    if (error) {
      if (error.code === '23505') throw new Error('An account with this email already exists.');
      throw new Error(error.message);
    }
  };

  const signOut = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const markTourComplete = async () => {
    if (!user) return;
    await supabase.from('kri_users').update({ tour_completed: true }).eq('id', user.id);
    const updated = { ...user, tour_completed: true };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    setUser(updated);
  };

  return {
    user,
    loading,
    isTourCompleted: user?.tour_completed === true,
    signIn,
    signUp,
    signOut,
    markTourComplete,
  };
}
