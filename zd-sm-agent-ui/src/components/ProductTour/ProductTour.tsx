'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, usePathname } from 'next/navigation';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface TourStep {
  target: string | null; // CSS selector for element to highlight (null for popups)
  title: string;
  description: string;
  page: string; // Which page this step should be on
  tab?: string; // For settings tabs
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  isPopup?: boolean; // For center popups without target element
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '.dashboard-content',
    title: 'Dashboard',
    description: "This is your command center. View all your generated content, edit captions, and publish to social media from here.",
    page: '/dashboard',
    position: 'center'
  },
  {
    target: 'a[href="/publishing"]',
    title: 'Content Studio',
    description: "Create stunning social media posts with AI. Just describe what you want and we'll generate it for you.",
    page: '/dashboard',
    position: 'right'
  },
  {
    target: 'a[href="/settings"]',
    title: 'Settings',
    description: "This is where you configure information about your business. The information here will be used to personalize the content to your brand.",
    page: '/dashboard',
    position: 'right'
  },
  {
    target: '.google-connection-card',
    title: 'Google Drive & Sheets',
    description: "Connecting your Google account allows you to create lead forms based on the ads you create in-app - and qualify any leads with AI. Note: Google connections expire after 7 days for security, so you'll need to reconnect periodically.",
    page: '/settings',
    tab: 'integrations',
    position: 'center'
  },
  {
    target: null,
    title: 'Advanced Features',
    description: "You can also generate animated versions of your images! Just click 'View' on any content card, scroll down, and hit 'Animate Image'. You can also create lead forms using the same steps.",
    page: '/dashboard',
    position: 'center',
    isPopup: true
  }
];

interface ProductTourProps {
  userId: string;
  onComplete: () => void;
}

export const ProductTour: React.FC<ProductTourProps> = ({ userId, onComplete }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [currentStep, setCurrentStep] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  const step = TOUR_STEPS[currentStep];

  // Find and highlight target element
  useEffect(() => {
    if (!step.target || step.isPopup) {
      setTargetElement(null);
      return;
    }

    const findElement = () => {
      const element = document.querySelector(step.target!) as HTMLElement;
      if (element) {
        setTargetElement(element);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // Retry after a short delay if element not found
        setTimeout(findElement, 100);
      }
    };

    findElement();
  }, [step, pathname]);

  // Navigate to required page
  useEffect(() => {
    if (pathname !== step.page) {
      setIsNavigating(true);
      router.push(step.page);
      
      // Wait for navigation
      setTimeout(() => {
        setIsNavigating(false);
      }, 300);
    }
  }, [step.page, pathname, router]);

  // Set active tab for settings
  useEffect(() => {
    if (step.page === '/settings' && step.tab) {
      // Trigger tab change if on settings page
      setTimeout(() => {
        const tabButton = document.querySelector(`button[data-tab="${step.tab}"]`) as HTMLButtonElement;
        tabButton?.click();
      }, 100);
    }
  }, [step.page, step.tab, pathname]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (confirm('Are you sure you want to skip the tour? You can always revisit these features later.')) {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    try {
      await supabase
        .from('client_configs')
        .update({ onboarding_tour_completed: true })
        .eq('client_id', userId);
      
      onComplete();
    } catch (error) {
      console.error('[ProductTour] Failed to save completion:', error);
      onComplete(); // Complete anyway
    }
  };

  const getTooltipPosition = () => {
    if (!targetElement || step.isPopup) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = 400;
    const tooltipHeight = 200;
    const offset = 20;

    switch (step.position) {
      case 'right':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.right + offset}px`,
          transform: 'translateY(-50%)'
        };
      case 'left':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.left - tooltipWidth - offset}px`,
          transform: 'translateY(-50%)'
        };
      case 'top':
        return {
          top: `${rect.top - tooltipHeight - offset}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)'
        };
      case 'bottom':
        return {
          top: `${rect.bottom + offset}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)'
        };
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        };
    }
  };

  if (isNavigating) {
    return (
      <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] pointer-events-none">
        {/* Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 pointer-events-auto"
          onClick={handleSkip}
        />

        {/* Spotlight on target element */}
        {targetElement && !step.isPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute pointer-events-none"
            style={{
              top: targetElement.getBoundingClientRect().top - 8,
              left: targetElement.getBoundingClientRect().left - 8,
              width: targetElement.getBoundingClientRect().width + 16,
              height: targetElement.getBoundingClientRect().height + 16,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
              border: '3px solid #5ccfa2',
              borderRadius: '12px',
              zIndex: 9998
            }}
          />
        )}

        {/* Tooltip */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="absolute bg-[#0b0b10] border-2 border-[#5ccfa2] rounded-xl shadow-2xl p-6 pointer-events-auto"
          style={{
            ...getTooltipPosition(),
            maxWidth: step.isPopup ? '500px' : '400px',
            zIndex: 10000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 p-1 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>

          {/* Content */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{step.description}</p>
            </div>

            {/* Progress Indicator */}
            <div className="flex items-center space-x-2">
              {TOUR_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    idx === currentStep ? 'bg-[#5ccfa2]' : idx < currentStep ? 'bg-[#5ccfa2]/50' : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleSkip}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Skip Tour
              </button>

              <div className="flex items-center space-x-2">
                {currentStep > 0 && (
                  <button
                    onClick={handlePrevious}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center text-sm"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Previous
                  </button>
                )}

                <button
                  onClick={handleNext}
                  className="px-6 py-2 bg-[#5ccfa2] hover:bg-[#45a881] text-black font-semibold rounded-lg transition-colors flex items-center text-sm"
                >
                  {currentStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                  {currentStep < TOUR_STEPS.length - 1 && <ArrowRight className="w-4 h-4 ml-1" />}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ProductTour;