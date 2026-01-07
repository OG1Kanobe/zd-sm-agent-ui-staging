'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Eye, EyeOff, Save, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useUserSession } from '@/hooks/use-user-session';
import { FcGoogle } from 'react-icons/fc';

type Provider = 'openai' | 'gemini';

interface ApiKeyData {
  provider: Provider;
  api_key_last_four: string;
  is_valid: boolean;
  updated_at: string;
}

const PROVIDER_INFO = {
  openai: {
    name: 'OpenAI',
    placeholder: 'sk-proj-...',
    helpUrl: '#',
  },
  gemini: {
    name: 'Google Gemini',
    placeholder: 'AIza...',
    helpUrl: '#',
  },
};

const IntegrationsPage = () => {
  const { user } = useUserSession();
  const userId = user?.id;
  const isAdmin = userId === 'a1bb9dc6-09bf-4952-bbb2-4248a4e8f544';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<Provider, boolean>>({
    openai: false,
    gemini: false,
  });
  
  const [keys, setKeys] = useState<Record<Provider, string>>({
    openai: '',
    gemini: '',
  });

  const [existingKeys, setExistingKeys] = useState<Record<Provider, ApiKeyData | null>>({
    openai: null,
    gemini: null,
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing keys
  useEffect(() => {
    const fetchKeys = async () => {
      if (!userId) return;

      try {
        const { data, error } = await supabase
          .from('user_api_keys')
          .select('provider, api_key_last_four, is_valid, updated_at')
          .eq('user_id', userId)
          .in('provider', ['openai', 'gemini']);

        if (error) throw error;

        const keyMap: Record<Provider, ApiKeyData | null> = {
          openai: null,
          gemini: null,
        };

        data?.forEach((item: any) => {
          keyMap[item.provider as Provider] = item;
        });

        setExistingKeys(keyMap);
      } catch (err: any) {
        console.error('Error fetching API keys:', err);
        setError('Failed to load API keys');
      } finally {
        setLoading(false);
      }
    };

    fetchKeys();
  }, [userId]);

  const handleSave = async () => {
  if (!userId) return;

  setSaving(true);
  setError(null);
  setSaveSuccess(false);

  try {
    // Collect keys that have been entered
    const updates: Array<{ provider: Provider; key: string }> = [];
    Object.entries(keys).forEach(([provider, key]) => {
      if (key.trim()) {
        updates.push({ provider: provider as Provider, key: key.trim() });
      }
    });

    if (updates.length === 0) {
      setError('Please enter at least one API key');
      setSaving(false);
      return;
    }

    // Call API route to save each key
    for (const { provider, key } of updates) {
      const response = await fetch('/api/user-keys/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: key,
          skipValidation: false,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to save ${provider} key`);
      }
    }

    // Clear input fields
    setKeys({ openai: '', gemini: '' });
    
    // Refresh existing keys
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('provider, api_key_last_four, is_valid, updated_at')
      .eq('user_id', userId)
      .in('provider', ['openai', 'gemini']);

    if (error) throw error;

    const keyMap: Record<Provider, ApiKeyData | null> = {
      openai: null,
      gemini: null,
    };

    data?.forEach((item: any) => {
      keyMap[item.provider as Provider] = item;
    });

    setExistingKeys(keyMap);
    setSaveSuccess(true);

    setTimeout(() => setSaveSuccess(false), 3000);
  } catch (err: any) {
    console.error('Save error:', err);
    setError(err.message || 'Failed to save API keys');
  } finally {
    setSaving(false);
  }
};

  const toggleShowKey = (provider: Provider) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#5ccfa2]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-gray-800">
        <div>
          <h2 className="text-3xl font-mono text-white">Integrations</h2>
          <p className="text-sm text-gray-400 mt-1">Manage your AI service connections</p>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-200">
          <p className="font-semibold mb-1">Your API keys are encrypted and secure</p>
          <p className="text-blue-300">We use AES-256-GCM encryption to protect your keys. They are never shared or exposed.</p>
        </div>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-900/50 border border-red-700 rounded-lg p-4 flex items-center space-x-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-200 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Message */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-green-900/50 border border-green-700 rounded-lg p-4 flex items-center space-x-3"
          >
            <Check className="w-5 h-5 text-green-400" />
            <p className="text-green-200 text-sm">API keys saved successfully!</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Keys Form */}
      <div className="bg-[#10101d] rounded-2xl border border-gray-800 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white">API Keys</h3>

        {/* OpenAI */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-300">
            {PROVIDER_INFO.openai.name} API Key
          </label>
          
          {existingKeys.openai && (
            <div className="text-xs text-gray-400 mb-2">
              Current key: ****{existingKeys.openai.api_key_last_four}
              {existingKeys.openai.is_valid && (
                <span className="ml-2 text-green-400">✓ Valid</span>
              )}
            </div>
          )}

          <div className="relative">
            <input
              type={showKeys.openai ? 'text' : 'password'}
              value={keys.openai}
              onChange={(e) => setKeys(prev => ({ ...prev, openai: e.target.value }))}
              placeholder={existingKeys.openai ? 'Enter new key to update' : PROVIDER_INFO.openai.placeholder}
              className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg px-4 py-3 pr-12 text-sm focus:ring-2 focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
            />
            <button
              type="button"
              onClick={() => toggleShowKey('openai')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showKeys.openai ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          
          <a  href={PROVIDER_INFO.openai.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs text-gray-400 hover:text-[#5ccfa2] transition-colors"
          >
            How do I get my {PROVIDER_INFO.openai.name} API key?
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>

        {/* Gemini */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-300">
            {PROVIDER_INFO.gemini.name} API Key
          </label>
          
          {existingKeys.gemini && (
            <div className="text-xs text-gray-400 mb-2">
              Current key: ****{existingKeys.gemini.api_key_last_four}
              {existingKeys.gemini.is_valid && (
                <span className="ml-2 text-green-400">✓ Valid</span>
              )}
            </div>
          )}

          <div className="relative">
            <input
              type={showKeys.gemini ? 'text' : 'password'}
              value={keys.gemini}
              onChange={(e) => setKeys(prev => ({ ...prev, gemini: e.target.value }))}
              placeholder={existingKeys.gemini ? 'Enter new key to update' : PROVIDER_INFO.gemini.placeholder}
              className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg px-4 py-3 pr-12 text-sm focus:ring-2 focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
            />
            <button
              type="button"
              onClick={() => toggleShowKey('gemini')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showKeys.gemini ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          
          <a  href={PROVIDER_INFO.gemini.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs text-gray-400 hover:text-[#5ccfa2] transition-colors"
          >
            How do I get my {PROVIDER_INFO.gemini.name} API key?
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || (!keys.openai.trim() && !keys.gemini.trim())}
          className="w-full flex items-center justify-center space-x-2 py-3 rounded-lg font-semibold transition-all bg-[#5ccfa2] text-black hover:bg-[#45a881] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Save API Keys</span>
            </>
          )}
        </button>
      </div>

      {/* Google OAuth - Admin Only */}
      {isAdmin && (
        <div className="bg-[#10101d] rounded-2xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Google Services</h3>
              <p className="text-xs text-gray-400 mt-1">Admin Only</p>
            </div>
            <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full">ADMIN</span>
          </div>

          <button
            onClick={() => alert('Google OAuth setup coming soon!')}
            className="w-full flex items-center justify-center space-x-3 py-3 rounded-lg border-2 border-gray-700 hover:border-[#5ccfa2] transition-all bg-white/5"
          >
            <FcGoogle className="w-6 h-6" />
            <span className="text-white font-semibold">Connect Google Account</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default IntegrationsPage;