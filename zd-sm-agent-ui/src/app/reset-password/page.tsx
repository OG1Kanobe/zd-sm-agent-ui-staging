'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Lock, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuthInput from '@/components/AuthInput';

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validToken, setValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        setValidToken(false);
        setError('Invalid or expired reset link. Please request a new one.');
      } else {
        setValidToken(true);
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setSuccess(true);

      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (err: any) {
      console.error('Reset password error:', err);
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (validToken === null) {
    return (
      <div className="min-h-screen bg-[#010112] flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#5ccfa2]" />
        <span className="ml-3 text-white font-mono">Verifying reset link...</span>
      </div>
    );
  }

  if (validToken === false) {
    return (
      <div className="min-h-screen bg-[#010112] flex justify-center items-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#10101d] rounded-2xl shadow-2xl p-8 border border-gray-800 text-center"
        >
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-mono text-white mb-4">Invalid Reset Link</h1>
          <p className="text-gray-400 mb-6">
            This password reset link is invalid or has expired.
          </p>
          
            <a href="/forgot-password"
            className="inline-block bg-[#5ccfa2] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#45a881] transition-colors"
          >
            Request New Link
          </a>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#010112] flex justify-center items-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#10101d] rounded-2xl shadow-2xl p-8 border border-gray-800 text-center"
        >
          <CheckCircle className="w-16 h-16 text-[#5ccfa2] mx-auto mb-4" />
          <h1 className="text-2xl font-mono text-white mb-4">Password Reset!</h1>
          <p className="text-gray-400 mb-6">
            Your password has been successfully reset.
          </p>
          <p className="text-sm text-gray-500">
            Redirecting to login...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010112] flex justify-center items-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-[#10101d] rounded-2xl shadow-2xl p-8 border border-gray-800"
      >
        <h1 className="text-3xl font-mono text-[#5ccfa2] text-center mb-2">
          Set New Password
        </h1>
        <p className="text-gray-400 text-center text-sm mb-6">
          Enter your new password below
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthInput
            Icon={Lock}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New Password"
            required
          />

          <AuthInput
            Icon={Lock}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm New Password"
            required
          />

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 rounded-lg text-sm bg-red-900/50 text-red-300"
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center space-x-2 py-3 rounded-lg font-mono font-semibold transition-all duration-200 shadow-md ${
              loading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-[#5ccfa2] text-[#010112] hover:bg-opacity-90'
            }`}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Lock className="w-5 h-5" />
                <span>Reset Password</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#010112] flex justify-center items-center">
        <div className="text-white font-mono">Loading...</div>
      </div>
    }>
      <ResetPasswordPageContent />
    </Suspense>
  );
}