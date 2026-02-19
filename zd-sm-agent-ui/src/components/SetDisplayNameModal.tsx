'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface SetDisplayNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
  onSuccess: (displayName: string) => void;
}

export const SetDisplayNameModal: React.FC<SetDisplayNameModalProps> = ({
  isOpen,
  onClose,
  currentEmail,
  onSuccess,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { display_name: displayName.trim() }
      });

      if (updateError) throw updateError;

      onSuccess(displayName.trim());
      onClose();
    } catch (err: any) {
      console.error('[SetDisplayName] Error:', err);
      setError(err.message || 'Failed to update display name');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#0b0b10] w-full max-w-md rounded-xl shadow-2xl border border-gray-800"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div className="flex items-center space-x-3">
              <User className="w-6 h-6 text-[#5ccfa2]" />
              <h2 className="text-xl font-bold text-white">Set Display Name</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <p className="text-sm text-gray-400 mb-4">
                Currently showing: <span className="text-white font-semibold">{currentEmail}</span>
              </p>
              <p className="text-sm text-gray-400 mb-4">
                Set a display name to personalize your experience!
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setError('');
                }}
                placeholder="e.g., John Doe"
                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !displayName.trim()}
                className="px-6 py-2 rounded-lg bg-[#5ccfa2] hover:bg-[#45a881] text-black font-semibold transition-colors disabled:opacity-50 flex items-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SetDisplayNameModal;