'use client';

import React, { useState, useEffect } from 'react';
import { X, Bell, Check, FileText, CheckCircle, Loader2, Settings, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { DateTime } from 'luxon';

type Notification = {
  id: string;
  user_id: string;
  type: 'post_generated' | 'post_published' | 'error' | 'warning' | 'success' | 'info' | 'other';
  title: string;
  message: string;
  post_id: string | null;
  platforms: string[] | null;
  is_read: boolean;
  created_at: string;
};

interface NotificationPreferences {
  soundEnabled: boolean;
  toastEnabled: boolean;
  postGeneratedEnabled: boolean;
  postPublishedEnabled: boolean;
}

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onNotificationClick: (postId: string) => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ 
  isOpen, 
  onClose, 
  userId,
  onNotificationClick 
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'unread' | 'all' | 'settings'>('unread');
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    soundEnabled: true,
    toastEnabled: true,
    postGeneratedEnabled: true,
    postPublishedEnabled: true,
  });

  useEffect(() => {
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

  const playNotificationSound = () => {
    if (preferences.soundEnabled) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (err) {
        console.log('[Notifications] Sound play failed:', err);
      }
    }
  };

  const showToastNotification = (notification: Notification) => {
    if (!preferences.toastEnabled) return;

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/logo.png',
        tag: notification.id,
      });
    }
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!userId || !isOpen) return;

    fetchNotifications();

    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('[Notifications] Real-time event:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newNotification = payload.new as Notification;
            
            const shouldShow = (
              (newNotification.type === 'post_generated' && preferences.postGeneratedEnabled) ||
              (newNotification.type === 'post_published' && preferences.postPublishedEnabled)
            );

            if (shouldShow) {
              setNotifications(prev => [newNotification, ...prev]);
              playNotificationSound();
              showToastNotification(newNotification);
            }
          } else if (payload.eventType === 'UPDATE') {
            setNotifications(prev =>
              prev.map(n => n.id === payload.new.id ? payload.new as Notification : n)
            );
          } else if (payload.eventType === 'DELETE') {
            setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isOpen, preferences.postGeneratedEnabled, preferences.postPublishedEnabled]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const sevenDaysAgo = DateTime.now().minus({ days: 7 }).toISO();

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setNotifications(data || []);
    } catch (err) {
      console.error('[Notifications] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (err) {
      console.error('[Notifications] Mark as read error:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('[Notifications] Mark all as read error:', err);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    if (notification.post_id) {
      onClose();
      onNotificationClick(notification.post_id);
    }
  };

  const filteredNotifications = activeTab === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // CRITICAL: Only render when isOpen is true
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40"
      />

      {/* Side Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-full md:w-96 bg-[#10101d] border-l border-gray-800 z-50 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-[#5ccfa2]" />
            <h2 className="text-xl font-mono text-white">Notifications</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('unread')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'unread'
                ? 'text-[#5ccfa2] border-b-2 border-[#5ccfa2]'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'text-[#5ccfa2] border-b-2 border-[#5ccfa2]'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'text-[#5ccfa2] border-b-2 border-[#5ccfa2]'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'settings' ? (
            <div className="p-4 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Notification Preferences</h3>
                
                <div className="flex items-center justify-between mb-4">
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

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Bell className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">Browser Notifications</span>
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
              </div>

              <div className="border-t border-gray-700 pt-4">
                <p className="text-xs text-gray-500 mb-3">Notification Types</p>

                <div className="flex items-center justify-between mb-4">
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

              <div className="bg-[#010112] p-3 rounded-lg border border-gray-800">
                <p className="text-xs text-gray-500">
                  💡 Settings are saved to your browser. Enable browser notifications above to receive alerts even when this tab is in the background.
                </p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-[#5ccfa2]" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
              <Bell className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm text-center">
                {activeTab === 'unread' 
                  ? 'No unread notifications' 
                  : 'No notifications in the last 7 days'}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {filteredNotifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
  notification.is_read
    ? 'bg-[#010112] border-gray-800 hover:border-gray-700'
    : notification.type === 'error'
      ? 'bg-red-950/30 border-red-900/50 hover:border-red-700'
      : notification.type === 'warning'
        ? 'bg-orange-950/30 border-orange-900/50 hover:border-orange-700'
        : 'bg-[#1a1a2e] border-[#5ccfa2]/30 hover:border-[#5ccfa2]'
}`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`mt-1 ${
  notification.is_read 
    ? 'text-gray-500' 
    : notification.type === 'error' 
      ? 'text-red-500' 
      : notification.type === 'warning'
        ? 'text-orange-500'
        : notification.type === 'success' || notification.type === 'post_generated' || notification.type === 'post_published'
          ? 'text-[#5ccfa2]'
          : 'text-gray-400'
}`}>
  {notification.type === 'post_generated' ? (
    <FileText className="w-5 h-5" />
  ) : notification.type === 'post_published' || notification.type === 'success' ? (
    <CheckCircle className="w-5 h-5" />
  ) : notification.type === 'error' ? (
    <X className="w-5 h-5" />
  ) : notification.type === 'warning' ? (
    <AlertTriangle className="w-5 h-5" />
  ) : (
    <Bell className="w-5 h-5" />
  )}
</div>
                    
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold mb-1 ${
                        notification.is_read ? 'text-gray-400' : 'text-white'
                      }`}>
                        {notification.title}
                      </p>
                      <p className={`text-xs mb-2 ${
                        notification.is_read ? 'text-gray-500' : 'text-gray-300'
                      }`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-600">
                        {DateTime.fromISO(notification.created_at).toRelative()}
                      </p>
                    </div>

                    {!notification.is_read && (
                      <div className="w-2 h-2 rounded-full bg-[#5ccfa2] mt-2" />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {activeTab !== 'settings' && unreadCount > 0 && (
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={markAllAsRead}
              className="w-full px-4 py-2 bg-[#5ccfa2] text-black rounded-lg font-semibold hover:bg-[#45a881] transition-colors flex items-center justify-center"
            >
              <Check className="w-4 h-4 mr-2" />
              Mark All as Read
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default NotificationPanel;