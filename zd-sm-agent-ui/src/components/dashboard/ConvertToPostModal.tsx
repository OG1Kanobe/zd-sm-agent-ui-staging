/**
 * Convert to Post Modal
 * Allows users to convert standalone images into social posts for multiple platforms
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Check } from 'lucide-react';
import { FaFacebook, FaInstagram, FaLinkedin } from 'react-icons/fa';

type Platform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok';

interface ConvertToPostModalProps {
  imageUrl: string;
  sourcePostId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  facebook: <FaFacebook className="w-5 h-5" />,
  instagram: <FaInstagram className="w-5 h-5" />,
  linkedin: <FaLinkedin className="w-5 h-5" />,
  tiktok: <TikTokIcon className="w-5 h-5" />,
};

const PLATFORM_NAMES: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
};

export const ConvertToPostModal: React.FC<ConvertToPostModalProps> = ({
  imageUrl,
  sourcePostId,
  onClose,
  onSuccess,
}) => {
  const [caption, setCaption] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePlatform = (platform: Platform) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handleSubmit = async () => {
    if (selectedPlatforms.length === 0) {
      setError('Please select at least one platform');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/posts/convert-to-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePostId,
          caption: caption.trim() || null,
          platforms: selectedPlatforms,
          category: category || null,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to convert image');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[ConvertToPost] Error:', err);
      setError(err.message || 'Failed to convert image');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#0b0b10] w-full max-w-2xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-[#0b0b10] z-10">
            <h2 className="text-lg font-bold text-white">Convert Image to Social Post</h2>
            <button 
              onClick={onClose} 
              className="p-2 rounded-lg bg-transparent hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Image Preview */}
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Image Preview</label>
              <img
                src={imageUrl}
                alt="Preview"
                className="w-full max-w-sm aspect-square object-cover rounded-lg mx-auto"
              />
            </div>

            {/* Caption */}
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">
                Caption (Optional)
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption or leave blank for AI generation"
                rows={4}
                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2] resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to let AI generate a caption based on the image
              </p>
            </div>

            {/* Platform Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-3">
                Select Platforms
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['facebook', 'instagram', 'linkedin', 'tiktok'] as Platform[]).map(platform => {
                  const isSelected = selectedPlatforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      onClick={() => togglePlatform(platform)}
                      className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-[#5ccfa2] bg-[#5ccfa2]/10'
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                      }`}
                    >
                      <div className={isSelected ? 'text-[#5ccfa2]' : 'text-gray-400'}>
                        {PLATFORM_ICONS[platform]}
                      </div>
                      <span className={isSelected ? 'text-white font-semibold' : 'text-gray-300'}>
                        {PLATFORM_NAMES[platform]}
                      </span>
                      {isSelected && <Check className="w-5 h-5 text-[#5ccfa2] ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">
                Category (Optional)
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Marketing, Branding"
                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">
                Tags (Optional)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="summer, promo, sale (comma-separated)"
                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
              />
              <p className="text-xs text-gray-500 mt-1">Separate multiple tags with commas</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-800">
            <button 
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || selectedPlatforms.length === 0}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center ${
                loading || selectedPlatforms.length === 0
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-[#5ccfa2] text-black hover:bg-[#45a881]'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Posts...
                </>
              ) : (
                `Generate Posts for ${selectedPlatforms.length} Platform${selectedPlatforms.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};