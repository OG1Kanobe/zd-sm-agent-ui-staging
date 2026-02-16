'use client';

import React, { useState, useEffect } from 'react';
import { useUserSession } from '@/hooks/use-user-session';
import { useOnboarding } from '@/hooks/useOnboarding';
import LaunchpadModal from '@/components/Launchpad/LaunchpadModal';
import ProductTour from '@/components/ProductTour/ProductTour';
import { supabase } from '@/lib/supabaseClient';

/**
 * LaunchpadWrapper
 * 
 * Handles both onboarding modal and product tour
 */
const LaunchpadWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: sessionLoading } = useUserSession();
  const { needsOnboarding, loading: onboardingLoading } = useOnboarding(user?.id);
  const [showModal, setShowModal] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(false);

  // Check if user has completed tour
  useEffect(() => {
    const checkTourStatus = async () => {
      if (!user?.id) return;

      const { data } = await supabase
        .from('client_configs')
        .select('onboarding_tour_completed')
        .eq('client_id', user.id)
        .single();

      setTourCompleted(data?.onboarding_tour_completed || false);
    };

    checkTourStatus();
  }, [user?.id]);

  // Don't render anything while loading
  if (sessionLoading || onboardingLoading) {
    return <>{children}</>;
  }

  // No user = no onboarding needed
  if (!user) {
    return <>{children}</>;
  }

  const handleModalComplete = () => {
    setShowModal(false);
    // Start tour after modal closes
    setTimeout(() => {
      setShowTour(true);
    }, 500);
  };

  const handleTourComplete = () => {
    setShowTour(false);
    setTourCompleted(true);
  };

  // Show onboarding modal
  if (needsOnboarding && showModal) {
    return (
      <>
        {children}
        <LaunchpadModal
          userId={user.id}
          onComplete={handleModalComplete}
        />
      </>
    );
  }

  // Show product tour (after onboarding or if tour not completed)
  if (showTour || (!tourCompleted && !needsOnboarding)) {
    return (
      <>
        {children}
        <ProductTour
          userId={user.id}
          onComplete={handleTourComplete}
        />
      </>
    );
  }

  // Normal flow
  return <>{children}</>;
};

export default LaunchpadWrapper;