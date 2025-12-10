'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Step1CompanyInfo from './Step1CompanyInfo';
import Step2ApiKeys from './Step2ApiKeys';
import Step3Socials from './Step3Socials';
import { authenticatedFetchJSON } from '@/lib/api-client';

interface LaunchpadModalProps {
  userId: string;
  onComplete: () => void;
}

export interface CompanyFormData {
  companyName: string;
  website: string | null;
  hasNoWebsite: boolean;
  description: string;
  industry: string;
  logoFile: File | null;
}

const LaunchpadModal: React.FC<LaunchpadModalProps> = ({ userId, onComplete }) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Company form data
  const [companyData, setCompanyData] = useState<CompanyFormData>({
    companyName: '',
    website: '',
    hasNoWebsite: false,
    description: '',
    industry: '',
    logoFile: null,
  });

  const totalSteps = 3;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      // Mark onboarding as complete
      await authenticatedFetchJSON('/api/launchpad/complete', {
        method: 'POST',
      });

      console.log('[Launchpad] Onboarding marked complete');
      onComplete();
      router.push('/dashboard');
    } catch (error: any) {
      console.error('[Launchpad] Failed to complete onboarding:', error);
      alert('Failed to complete setup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnectSocials = async () => {
    setIsSubmitting(true);
    try {
      // Mark onboarding as complete
      await authenticatedFetchJSON('/api/launchpad/complete', {
        method: 'POST',
      });

      console.log('[Launchpad] Redirecting to Publishing page');
      router.push('/publishing');
    } catch (error: any) {
      console.error('[Launchpad] Failed to complete onboarding:', error);
      alert('Failed to complete setup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#0b0b10] w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header with Progress */}
        <div className="bg-[#10101d] p-6 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Welcome to Architect C</h2>
            <div className="text-sm text-gray-400">
              Step {currentStep} of {totalSteps}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#010112] rounded-full h-2">
            <motion.div
              className="bg-[#5ccfa2] h-2 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  currentStep >= 1 ? 'bg-[#5ccfa2] text-black' : 'bg-gray-700 text-gray-400'
                }`}
              >
                {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <span className={`text-sm ${currentStep >= 1 ? 'text-white' : 'text-gray-500'}`}>
                Company Info
              </span>
            </div>

            <div className="flex-1 h-0.5 bg-gray-700 mx-4" />

            <div className="flex items-center space-x-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  currentStep >= 2 ? 'bg-[#5ccfa2] text-black' : 'bg-gray-700 text-gray-400'
                }`}
              >
                {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <span className={`text-sm ${currentStep >= 2 ? 'text-white' : 'text-gray-500'}`}>
                API Keys
              </span>
            </div>

            <div className="flex-1 h-0.5 bg-gray-700 mx-4" />

            <div className="flex items-center space-x-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  currentStep >= 3 ? 'bg-[#5ccfa2] text-black' : 'bg-gray-700 text-gray-400'
                }`}
              >
                3
              </div>
              <span className={`text-sm ${currentStep >= 3 ? 'text-white' : 'text-gray-500'}`}>
                Socials
              </span>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="p-8 min-h-[400px] max-h-[60vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <Step1CompanyInfo
                userId={userId}
                formData={companyData}
                setFormData={setCompanyData}
                onNext={handleNext}
              />
            )}
            {currentStep === 2 && (
              <Step2ApiKeys userId={userId} onNext={handleNext} onBack={handleBack} />
            )}
            {currentStep === 3 && (
              <Step3Socials
                onBack={handleBack}
                onFinish={handleFinish}
                onConnectSocials={handleConnectSocials}
                isSubmitting={isSubmitting}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Footer Note */}
        <div className="bg-[#10101d] px-8 py-4 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            {currentStep === 1 && '💡 You can edit this information later in the Configs page'}
            {currentStep === 2 && '💡 You can add or delete API keys later in the Settings page'}
            {currentStep === 3 && '💡 You can manage your social connections anytime in the Publishing page'}
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LaunchpadModal;