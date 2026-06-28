import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'citizen' | 'admin' | 'moderator' | 'validator' | 'yamioo_agent' | null;

export const useUserRole = () => {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setRole(null);
          setLoading(false);
          return;
        }

        // Check for admin or moderator role
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        let currentRole: UserRole = 'citizen';

        if (userRoles && userRoles.length > 0) {
          // Priority: admin > moderator > citizen
          const adminRoles = ['admin', 'admin_national', 'admin_province', 'admin_municipality'];
          const hasAdmin = userRoles.some(r => adminRoles.includes(r.role));
          const hasModerator = userRoles.some(r => r.role === 'moderator');
          const hasYamiooAgent = userRoles.some(r => r.role === 'yamioo_agent');
          
          if (hasAdmin) {
            currentRole = 'admin';
          } else if (hasModerator) {
            currentRole = 'moderator';
          } else if (hasYamiooAgent) {
            currentRole = 'yamioo_agent';
          }
        }

        // Check if user is also a validator (only upgrade from citizen)
        if (currentRole === 'citizen') {
          const { data: validationNumbers } = await supabase
            .from('validation_phone_numbers')
            .select('id')
            .eq('validator_user_id', user.id)
            .eq('is_active', true)
            .limit(1);

          if (validationNumbers && validationNumbers.length > 0) {
            currentRole = 'validator';
          }
        }

        setRole(currentRole);
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole('citizen');
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { 
    role, 
    loading,
    isCitizen: role === 'citizen',
    isValidator: role === 'validator',
    isAdmin: role === 'admin',
    isModerator: role === 'moderator',
    isYamiooAgent: role === 'yamioo_agent'
  };
};
