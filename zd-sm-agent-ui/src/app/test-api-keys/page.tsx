'use client';

import React, { useState } from 'react';
import { authenticatedFetchJSON } from '@/lib/api-client';

/**
 * PROTECTED API Key Testing Page
 * 
 * Access at: https://your-app.vercel.app/test-api-keys
 * Password required to access
 * 
 * REMEMBER TO DELETE THIS PAGE AFTER TESTING
 */

// Set a simple password - change this!
const TEST_PASSWORD = 'Taahir0201';

interface ApiKey {
  provider: string;
  lastFour: string;
  isValid: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function TestApiKeysPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);

  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === TEST_PASSWORD) {
      setAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
      setTimeout(() => setPasswordError(false), 2000);
    }
  };

  const handleTest = async (testFunction: () => Promise<any>) => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const data = await testFunction();
      setResult(data);
      console.log('✅ Success:', data);
    } catch (err: any) {
      setError(err.message);
      console.error('❌ Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const testSaveKey = async () => {
    if (!apiKey) {
      setError('Please enter an API key');
      return;
    }
    
    return handleTest(async () => {
      return await authenticatedFetchJSON('/api/user-keys/save', {
        method: 'POST',
        body: JSON.stringify({
          provider,
          apiKey,
          skipValidation: false,
        }),
      });
    });
  };

  const testValidateKey = async () => {
    return handleTest(async () => {
      return await authenticatedFetchJSON('/api/user-keys/validate', {
        method: 'POST',
        body: JSON.stringify({
          provider,
        }),
      });
    });
  };

  const testListKeys = async () => {
    return handleTest(async () => {
      const data = await authenticatedFetchJSON('/api/user-keys/list', {
        method: 'GET',
      });
      setKeys(data.keys || []);
      return data;
    });
  };

  const testDeleteKey = async () => {
    return handleTest(async () => {
      return await authenticatedFetchJSON('/api/user-keys/delete', {
        method: 'DELETE',
        body: JSON.stringify({
          provider,
        }),
      });
    });
  };

  // Password gate
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              🔒 Protected Test Page
            </h1>
            <p className="text-gray-600 text-sm">
              Enter password to access API testing
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter password"
              className={`w-full border-2 ${
                passwordError ? 'border-red-500' : 'border-gray-300'
              } rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4`}
              autoFocus
            />
            
            {passwordError && (
              <p className="text-red-600 text-sm mb-4">
                ❌ Incorrect password
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Access Test Page
            </button>
          </form>

          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-800">
              ⚠️ This is a development testing page. Delete before production launch.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main test UI (same as before)
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">🧪 API Key Routes Testing</h1>
              <p className="text-gray-600">
                Test your API key management endpoints
              </p>
            </div>
            <button
              onClick={() => setAuthenticated(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              🔒 Lock Page
            </button>
          </div>

          {/* Input Section */}
          <div className="bg-blue-50 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-4">Test Inputs</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="perplexity">Perplexity</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                API Key (for save test)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-proj-..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter a real API key to test save & validate
              </p>
            </div>
          </div>

          {/* Test Buttons */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
              onClick={testSaveKey}
              disabled={loading}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Testing...' : '1. Save API Key'}
            </button>

            <button
              onClick={testValidateKey}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Testing...' : '2. Validate Key'}
            </button>

            <button
              onClick={testListKeys}
              disabled={loading}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Testing...' : '3. List All Keys'}
            </button>

            <button
              onClick={testDeleteKey}
              disabled={loading}
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Testing...' : '4. Delete Key'}
            </button>
          </div>

          {/* Results Section */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h3 className="text-red-800 font-semibold mb-2">❌ Error</h3>
              <pre className="text-sm text-red-700 whitespace-pre-wrap">
                {error}
              </pre>
            </div>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <h3 className="text-green-800 font-semibold mb-2">✅ Success</h3>
              <pre className="text-sm text-green-700 whitespace-pre-wrap overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          {/* Saved Keys Display */}
          {keys.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold mb-4">💾 Your Saved API Keys</h3>
              <div className="space-y-2">
                {keys.map((key) => (
                  <div
                    key={key.provider}
                    className="bg-white p-4 rounded-lg border border-gray-200 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium capitalize">{key.provider}</p>
                      <p className="text-sm text-gray-600">
                        Last 4: ****{key.lastFour}
                      </p>
                    </div>
                    <div>
                      {key.isValid ? (
                        <span className="text-green-600 text-sm font-medium">
                          ✓ Valid
                        </span>
                      ) : (
                        <span className="text-red-600 text-sm font-medium">
                          ✗ Invalid
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold mb-2">📝 Testing Instructions</h3>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>Select a provider from the dropdown</li>
              <li>Enter a real API key (it will be encrypted)</li>
              <li>Click "1. Save API Key" - should show success with last 4 chars</li>
              <li>Click "2. Validate Key" - tests if key works with provider</li>
              <li>Click "3. List All Keys" - shows all saved keys (masked)</li>
              <li>Click "4. Delete Key" - removes the selected provider's key</li>
              <li>Check browser console for detailed logs</li>
            </ol>
          </div>

          {/* Warning */}
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm font-medium">
              ⚠️ DELETE THIS PAGE AFTER TESTING - Change password in code before deploying
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}