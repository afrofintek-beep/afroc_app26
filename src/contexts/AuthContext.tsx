import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { startPodpSampler, stopPodpSampler } from '@/lib/podp/sampler';

type ApprovalStatus = 'approved' | 'pending' | 'rejected';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Estado de aprovação da conta (fase experimental). null = ainda não carregado. */
  approvalStatus: ApprovalStatus | null;
  rejectionReason: string | null;
  /** Admin/autoridade: passa o gate de aprovação. */
  isPrivileged: boolean;
  approvalLoading: boolean;
  refreshApproval: () => Promise<void>;
}

const ADMIN_ROLES = ['admin', 'admin_national', 'admin_province', 'admin_municipality', 'operator_field'];

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  approvalStatus: null,
  rejectionReason: null,
  isPrivileged: false,
  approvalLoading: false,
  refreshApproval: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);

  // Carrega o estado de aprovação + se é admin (bypass do gate).
  const loadApproval = useCallback(async (userId: string) => {
    setApprovalLoading(true);
    try {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from('profiles').select('approval_status, rejection_reason').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
      ]);
      const privileged = (roles ?? []).some((r: { role: string }) => ADMIN_ROLES.includes(r.role));
      setIsPrivileged(privileged);
      // Sem coluna/linha ainda → tratar como aprovado (não bloquear por engano).
      const status = (profile as { approval_status?: ApprovalStatus } | null)?.approval_status ?? 'approved';
      setApprovalStatus(status);
      setRejectionReason((profile as { rejection_reason?: string | null } | null)?.rejection_reason ?? null);
    } catch {
      // Falha de rede/coluna inexistente: não bloquear o utilizador.
      setApprovalStatus('approved');
      setIsPrivileged(false);
    } finally {
      setApprovalLoading(false);
    }
  }, []);

  const refreshApproval = useCallback(async () => {
    if (user?.id) await loadApproval(user.id);
  }, [user?.id, loadApproval]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setLoading(false);
          if (session?.user) {
            void loadApproval(session.user.id);
            // Silent presence sampler — no UI, ignored if context disallows
            void startPodpSampler(session.user.id);
          }
        }
        if (event === 'SIGNED_OUT') {
          setLoading(false);
          setApprovalStatus(null);
          setRejectionReason(null);
          setIsPrivileged(false);
          stopPodpSampler();
          localStorage.removeItem('afroloc_remember_me');
          sessionStorage.removeItem('afroloc_session_active');
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        void loadApproval(session.user.id);
        void startPodpSampler(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadApproval]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        approvalStatus,
        rejectionReason,
        isPrivileged,
        approvalLoading,
        refreshApproval,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
