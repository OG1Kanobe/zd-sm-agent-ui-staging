'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Check, ExternalLink } from 'lucide-react';
import { FaFacebook, FaInstagram, FaLinkedin, FaTiktok } from 'react-icons/fa';

interface Step3Props {
  onBack: () => void;
  onFinish: () => void;
  onConnectSocials: () => void;
  isSubmitting: boolean;
}

const platforms = [
  { name: 'Facebook', icon: FaFacebook, color: '#1877F2' },
  { name: 'Instagram', icon: FaInstagram, color: '#E4405F' },
  { name: 'LinkedIn', icon: FaLinkedin, color: '#0A66C2' },
  { name: 'TikTok', icon: FaTiktok, color: '#000000' },
];

const Step3Socials: React.FC<Step3Props> = ({ onBack, onFinish, onConnectSocials, isSubmitting }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-2">Connect Your Social Media</h3>
        <p className="text-sm text-gray-400">
          Link your social media accounts to start publishing content seamlessly across platforms.
        </p>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-2 gap-4 py-6">
        {platforms.map((platform) => {
          const Icon = platform.icon;
          return (
            <div
              key={platform.name}
              className="bg-[#10101d] p-6 rounded-lg border border-gray-800 flex flex-col items-center justify-center hover:border-[#5ccfa2] transition-colors"
            >
              <Icon className="w-12 h-12 mb-3" style={{ color: platform.color === '#000000' ? '#5ccfa2' : platform.color }} />
              <span className="text-sm font-medium text-white">{platform.name}</span>
            </div>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
        <p className="text-sm text-blue-200">
          💡 <strong>Note:</strong> You'll be redirected to the Publishing page where you can securely connect your
          social media accounts using OAuth.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={onConnectSocials}
          disabled={isSubmitting}
          className="w-full bg-[#5ccfa2] text-black font-semibold px-6 py-4 rounded-lg hover:bg-[#45a881] transition-colors flex items-center justify-center text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <motion.div
                className="w-5 h-5 border-2 border-black border-t-transparent rounded-full mr-2"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              Loading...
            </>
          ) : (
            <>
              Connect My Socials
              <ExternalLink className="w-5 h-5 ml-2" />
            </>
          )}
        </button>

        <button
          onClick={onFinish}
          disabled={isSubmitting}
          className="w-full bg-gray-800 text-white font-semibold px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <motion.div
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              Finishing...
            </>
          ) : (
            <>
              <Check className="w-5 h-5 mr-2" />
              Finish & Go to Dashboard
            </>
          )}
        </button>
      </div>

      {/* Back Button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="text-sm text-gray-400 hover:text-white transition-colors flex items-center disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Go Back
        </button>
      </div>
    </motion.div>
  );
};

export default Step3Socials;