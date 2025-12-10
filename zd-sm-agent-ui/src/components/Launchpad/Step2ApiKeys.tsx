'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Key } from 'lucide-react';
import ApiKeyCard from './ApiKeyCard';

interface Step2Props {
  userId: string;
  onNext: () => void;
  onBack: () => void;
}

const providers = [
  {
    id: 'openai',
    name: 'OpenAI',
    placeholder: 'sk-proj-...',
    helpLink: '#',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    placeholder: 'AIza...',
    helpLink: '#',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    placeholder: 'pplx-...',
    helpLink: '#',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    placeholder: 'sk-ant-...',
    helpLink: '#',
  },
];

const Step2ApiKeys: React.FC<Step2Props> = ({ userId, onNext, onBack }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <h3 className="text-xl font-bold text-white mb-2">Add your API keys</h3>
        <p className="text-sm text-gray-400">
          Connect your AI providers to enable content generation. All fields are optional - you can add them later.
        </p>
      </div>

      {/* API Key Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((provider) => (
          <ApiKeyCard key={provider.id} provider={provider} userId={userId} />
        ))}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="bg-gray-800 text-white font-semibold px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors flex items-center"
        >
          <ChevronLeft className="w-5 h-5 mr-2" />
          Back
        </button>

        <button
          onClick={onNext}
          className="bg-[#5ccfa2] text-black font-semibold px-6 py-3 rounded-lg hover:bg-[#45a881] transition-colors flex items-center"
        >
          Next
          <ChevronRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </motion.div>
  );
};

export default Step2ApiKeys;