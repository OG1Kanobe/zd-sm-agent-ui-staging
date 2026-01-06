'use client';

import React, { useState } from 'react';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import AuthInput from '@/components/AuthInput';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSuccess(true);
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#010112] flex justify-center items-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#10101d] rounded-2xl shadow-2xl p-8 border border-gray-800 text-center"
        >
          <CheckCircle className="w-16 h-16 text-[#5ccfa2] mx-auto mb-4" />
          <h1 className="text-2xl font-mono text-white mb-4">Check Your Email</h1>
          <p className="text-gray-400 mb-6">
            We have sent a password reset link to <span className="text-[#5ccfa2] font-semibold">{email}</span>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Click the link in the email to reset your password. The link expires in 1 hour.
          </p>
          
           <a href="/login"
            className="inline-flex items-center text-[#5ccfa2] hover:text-[#45a881] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </a>
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
          Reset Password
        </h1>
        <p className="text-gray-400 text-center text-sm mb-6">
          Enter your email and we will send you a reset link
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthInput
            Icon={Mail}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
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
                <Mail className="w-5 h-5" />
                <span>Send Reset Link</span>
              </>
            )}
          </button>
        </form>

        
         <a href="/login"
          className="mt-6 flex items-center justify-center text-sm text-gray-400 hover:text-[#5ccfa2] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Login
        </a>
      </motion.div>
    </div>
  );
}