'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Bell, Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Optional: Notification Settings Component
 * Add this to your settings page or as a dropdown from the bell icon
 * Stores preferences in localStorage
 */

interface NotificationPreferences {
  soundEnabled: boolean;
  toastEnabled: boolean;
  postGeneratedEnabled: boolean;
  postPublishedEnabled: boolean;
}

const NotificationSettings: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    soundEnabled: true,
    toastEnabled: true,
    postGeneratedEnabled: true,
    postPublishedEnabled: true,
  });

  useEffect(() => {
    // Load preferences from localStorage
    const saved = localStorage.getItem('notification_preferences');
    if (saved) {
      setPreferences(JSON.parse(saved));
    }
  }, []);

  const updatePreference = (key: keyof NotificationPreferences, value: boolean) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    localStorage.setItem('notification_preferences', JSON.stringify(updated));
  };

  return (
    <div className="bg-[#10101d] p-6 rounded-xl border border-gray-800 max-w-md">
      <div className="flex items-center space-x-2 mb-6">
        <Settings className="w-5 h-5 text-[#5ccfa2]" />
        <h3 className="text-lg font-mono text-white">Notification Settings</h3>
      </div>

      <div className="space-y-4">
        {/* Sound Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {preferences.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-gray-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-gray-400" />
            )}
            <span className="text-sm text-gray-300">Notification Sounds</span>
          </div>
          <button
            onClick={() => updatePreference('soundEnabled', !preferences.soundEnabled)}
            className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
              preferences.soundEnabled ? 'bg-[#5ccfa2]' : 'bg-gray-600'
            }`}
          >
            <motion.div
              className="bg-white w-4 h-4 rounded-full shadow-md"
              animate={{ x: preferences.soundEnabled ? 24 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>

        {/* Toast Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Toast Notifications</span>
          </div>
          <button
            onClick={() => updatePreference('toastEnabled', !preferences.toastEnabled)}
            className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
              preferences.toastEnabled ? 'bg-[#5ccfa2]' : 'bg-gray-600'
            }`}
          >
            <motion.div
              className="bg-white w-4 h-4 rounded-full shadow-md"
              animate={{ x: preferences.toastEnabled ? 24 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>

        <div className="border-t border-gray-700 pt-4 mt-4">
          <p className="text-xs text-gray-500 mb-3">Notification Types</p>

          {/* Post Generated Toggle */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-300">New posts generated</span>
            <button
              onClick={() => updatePreference('postGeneratedEnabled', !preferences.postGeneratedEnabled)}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                preferences.postGeneratedEnabled ? 'bg-[#5ccfa2]' : 'bg-gray-600'
              }`}
            >
              <motion.div
                className="bg-white w-4 h-4 rounded-full shadow-md"
                animate={{ x: preferences.postGeneratedEnabled ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          {/* Post Published Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Posts published</span>
            <button
              onClick={() => updatePreference('postPublishedEnabled', !preferences.postPublishedEnabled)}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                preferences.postPublishedEnabled ? 'bg-[#5ccfa2]' : 'bg-gray-600'
              }`}
            >
              <motion.div
                className="bg-white w-4 h-4 rounded-full shadow-md"
                animate={{ x: preferences.postPublishedEnabled ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-600 mt-4">
        Settings are saved locally to your browser.
      </p>
    </div>
  );
};

export default NotificationSettings;

/**
 * To use notification preferences in NotificationPanel:
 * 
 * const getPreferences = () => {
 *   const saved = localStorage.getItem('notification_preferences');
 *   return saved ? JSON.parse(saved) : {
 *     soundEnabled: true,
 *     toastEnabled: true,
 *     postGeneratedEnabled: true,
 *     postPublishedEnabled: true
 *   };
 * };
 * 
 * // Play sound on new notification (if enabled)
 * const prefs = getPreferences();
 * if (prefs.soundEnabled && payload.eventType === 'INSERT') {
 *   const audio = new Audio('/notification-sound.mp3');
 *   audio.play().catch(err => console.log('Audio play failed:', err));
 * }
 */