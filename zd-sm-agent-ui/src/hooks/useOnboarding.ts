import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Hook to check if user needs to complete onboarding
 * Returns true if onboarding_completed is null or false
 */
export const useOnboarding = (userId: string | undefined) => {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('client_configs')
          .select('onboarding_completed')
          .eq('client_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows (new user, needs onboarding)
          console.error('[useOnboarding] Error:', error);
          setNeedsOnboarding(true);
        } else if (!data || !data.onboarding_completed) {
          // No record or onboarding_completed is false/null
          setNeedsOnboarding(true);
        } else {
          // Has completed onboarding
          setNeedsOnboarding(false);
        }
      } catch (err) {
        console.error('[useOnboarding] Unexpected error:', err);
        setNeedsOnboarding(false); // Don't block user if check fails
      } finally {
        setLoading(false);
      }
    };

    checkOnboarding();
  }, [userId]);

  return { needsOnboarding, loading };
};