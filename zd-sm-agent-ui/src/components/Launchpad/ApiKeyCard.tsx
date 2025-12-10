'use client';

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, X, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { authenticatedFetchJSON } from '@/lib/api-client';

interface ApiKeyCardProps {
  provider: {
    id: string;
    name: string;
    placeholder: string;
    helpLink: string;
  };
  userId: string;
}

const ApiKeyCard: React.FC<ApiKeyCardProps> = ({ provider, userId }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'validating' | 'success' | 'error'>('idle');
  const [existingKey, setExistingKey] = useState<{
    lastFour: string;
    isValid: boolean;
  } | null>(null);

  // Load existing key on mount
  useEffect(() => {
    const loadExistingKey = async () => {
      try {
        const data = await authenticatedFetchJSON('/api/user-keys/list', {
          method: 'GET',
        });

        const key = data.keys?.find((k: any) => k.provider === provider.id);
        if (key) {
          setExistingKey({
            lastFour: key.api_key_last_four,
            isValid: key.is_valid,
          });
        }
      } catch (error) {
        console.error(`[ApiKeyCard] Failed to load ${provider.name} key:`, error);
      }
    };

    loadExistingKey();
  }, [provider.id, userId]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      alert('Please enter an API key');
      return;
    }

    setStatus('saving');

    try {
      const data = await authenticatedFetchJSON('/api/user-keys/save', {
        method: 'POST',
        body: JSON.stringify({
          provider: provider.id,
          apiKey: apiKey,
          skipValidation: false,
        }),
      });

      setExistingKey({
        lastFour: data.lastFour,
        isValid: data.isValid,
      });
      setApiKey('');
      setStatus('success');

      setTimeout(() => setStatus('idle'), 2000);
    } catch (error: any) {
      console.error(`[ApiKeyCard] Save failed for ${provider.name}:`, error);
      setStatus('error');
      alert(`Failed to save ${provider.name} API key: ${error.message}`);
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const handleValidate = async () => {
    setStatus('validating');

    try {
      const data = await authenticatedFetchJSON('/api/user-keys/validate', {
        method: 'POST',
        body: JSON.stringify({
          provider: provider.id,
        }),
      });

      setExistingKey((prev) => (prev ? { ...prev, isValid: data.isValid } : null));
      setStatus('success');

      setTimeout(() => setStatus('idle'), 2000);
    } catch (error: any) {
      console.error(`[ApiKeyCard] Validation failed for ${provider.name}:`, error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete your ${provider.name} API key?`)) return;

    try {
      await authenticatedFetchJSON('/api/user-keys/delete', {
        method: 'DELETE',
        body: JSON.stringify({
          provider: provider.id,
        }),
      });

      setExistingKey(null);
      setApiKey('');
      setStatus('idle');
    } catch (error: any) {
      console.error(`[ApiKeyCard] Delete failed for ${provider.name}:`, error);
      alert(`Failed to delete ${provider.name} API key`);
    }
  };

  return (
    <div className="bg-[#10101d] p-4 rounded-lg border border-gray-800 hover:border-[#5ccfa2] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-semibold text-white">{provider.name}</h4>
        {existingKey && (
          <div className="flex items-center space-x-2">
            <span
              className={`text-xs font-semibold ${
                existingKey.isValid ? 'text-green-500' : 'text-red-500'
              }`}
            >
              {existingKey.isValid ? '✓ Valid' : '✗ Invalid'}
            </span>
          </div>
        )}
      </div>

      {existingKey ? (
        /* Existing Key Display */
        <div className="space-y-3">
          <div className="bg-[#010112] p-3 rounded border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">Saved Key</p>
            <p className="text-sm text-white font-mono">****{existingKey.lastFour}</p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleValidate}
              disabled={status === 'validating'}
              className="flex-1 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {status === 'validating' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Key'
              )}
            </button>

            <button
              onClick={handleDelete}
              className="bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              title="Delete Key"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Add New Key */
        <div className="space-y-3">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider.placeholder}
              className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 pr-10 focus:ring-2 focus:ring-[#5ccfa2] focus:border-[#5ccfa2] text-sm"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={status === 'saving' || !apiKey.trim()}
            className="w-full bg-[#5ccfa2] text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#45a881] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {status === 'saving' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : status === 'success' ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Saved!
              </>
            ) : status === 'error' ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Failed
              </>
            ) : (
              'Save Key'
            )}
          </button>

          <a
            href={provider.helpLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-[#5ccfa2] hover:underline flex items-center justify-center"
          >
            How do I get my {provider.name} API key?
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>
      )}
    </div>
  );
};

export default ApiKeyCard;