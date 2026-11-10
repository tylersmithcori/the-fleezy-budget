import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const AccountContext = createContext<{ user: User | null; ready: boolean; recovery: boolean }>({ user: null, ready: false, recovery: false });
export const useAccount = () => useContext(AccountContext);
export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    let active = true;
    const verify = async () => { const { data } = await supabase.auth.getUser(); if (active) { setUser(data.user); setReady(true); } };
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') { setUser(null); setReady(true); }
      else if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') setTimeout(verify, 0);
    });
    void verify();
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return <AccountContext.Provider value={{ user, ready, recovery }}>{children}</AccountContext.Provider>;
}