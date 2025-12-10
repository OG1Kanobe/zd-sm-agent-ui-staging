'use client';

import React, { useState } from 'react';
import { useUserSession } from '@/hooks/use-user-session';
import { useOnboarding } from '@/hooks/useOnboarding';
import LaunchpadModal from '@/components/Launchpad/LaunchpadModal';

/**
 * LaunchpadWrapper
 * 
 * Checks if user needs onboarding and shows modal if needed
 * Add this component to your main layout or a high-level page
 */
const LaunchpadWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: sessionLoading } = useUserSession();
  const { needsOnboarding, loading: onboardingLoading } = useOnboarding(user?.id);
  const [showModal, setShowModal] = useState(true);

  // Don't render anything while loading
  if (sessionLoading || onboardingLoading) {
    return <>{children}</>;
  }

  // No user = no onboarding needed
  if (!user) {
    return <>{children}</>;
  }

  // User needs onboarding and modal is visible
  if (needsOnboarding && showModal) {
    return (
      <>
        {children}
        <LaunchpadModal
          userId={user.id}
          onComplete={() => setShowModal(false)}
        />
      </>
    );
  }

  // Normal flow
  return <>{children}</>;
};

export default LaunchpadWrapper;