'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useUserSession } from '@/hooks/use-user-session';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Clock } from 'lucide-react';

const SessionMonitor = () => {
  const router = useRouter();
  const { user } = useUserSession();
  
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(15); // Countdown in seconds
  
  const lastActivityRef = useRef<number>(Date.now());
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // ============================================
  // CONFIGURATION - TESTING MODE
  // ============================================
  // CURRENT: Testing mode (fast timeouts)
  const WARNING_TIME = 30 * 1000; // 30 seconds (PRODUCTION: 45 * 60 * 1000 for 45 mins)
  const LOGOUT_TIME = 45 * 1000; // 45 seconds (PRODUCTION: 60 * 60 * 1000 for 60 mins)
  const WARNING_DURATION = LOGOUT_TIME - WARNING_TIME; // 15 seconds warning (PRODUCTION: 15 mins)
  // ============================================

  // Play notification sound
  const playNotificationSound = useCallback(() => {
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
      
      console.log('🔔 Notification sound played');
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }, []);

  // Handle logout
  const handleLogout = useCallback(async () => {
    console.log('🚪 Auto-logging out user due to inactivity');
    
    // Clear all timers
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    
    // Hide warning
    setShowWarning(false);
    
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error);
    }
    
    // Force redirect to login
    window.location.href = '/login?reason=inactivity';
  }, []);

  // Reset activity timer
  const resetActivityTimer = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    
    console.log('🔄 Activity detected - resetting timers');
    
    // Clear existing timers
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    
    // Hide warning if showing
    if (showWarning) {
      setShowWarning(false);
      console.log('✅ Warning dismissed');
    }
    
    // Set warning timer
    warningTimerRef.current = setTimeout(() => {
      console.log('⚠️ Showing inactivity warning');
      setShowWarning(true);
      
      // Calculate countdown in seconds
      const warningSeconds = Math.floor(WARNING_DURATION / 1000);
      setCountdown(warningSeconds);
      playNotificationSound();
      
      // Start countdown (update every second)
      let remainingSeconds = warningSeconds;
      countdownIntervalRef.current = setInterval(() => {
        remainingSeconds -= 1;
        setCountdown(remainingSeconds);
        
        console.log(`⏱️ Countdown: ${remainingSeconds} seconds remaining`);
        
        if (remainingSeconds <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
        }
      }, 1000); // Update every second
      
      // Set final logout timer
      logoutTimerRef.current = setTimeout(() => {
        console.log('⏰ Logout timer triggered!');
        handleLogout();
      }, WARNING_DURATION);
      
    }, WARNING_TIME);
    
  }, [showWarning, handleLogout, playNotificationSound, WARNING_TIME, WARNING_DURATION]);

  // Activity event listeners
  useEffect(() => {
    if (!user) return;
    
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetActivityTimer();
    };
    
    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });
    
    // Initialize timer on mount
    resetActivityTimer();
    
    console.log(`👀 Session monitor initialized
    ⏰ Warning after: ${WARNING_TIME / 1000}s
    🚪 Logout after: ${LOGOUT_TIME / 1000}s`);
    
    // Cleanup
    return () => {
      console.log('🧹 Cleaning up session monitor');
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [user, resetActivityTimer, WARNING_TIME, LOGOUT_TIME]);

  // Handle "Stay Logged In" button
  const handleStayLoggedIn = () => {
    console.log('✅ User chose to stay logged in');
    playNotificationSound();
    resetActivityTimer();
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {showWarning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#10101d] border-2 border-yellow-500 rounded-2xl shadow-2xl max-w-md w-full p-8"
          >
            <div className="flex items-center justify-center mb-6">
              <div className="bg-yellow-500/20 p-4 rounded-full">
                <Clock className="w-12 h-12 text-yellow-500 animate-pulse" />
              </div>
            </div>

            <h2 className="text-2xl font-mono font-bold text-white text-center mb-4">
              Inactivity Warning
            </h2>

            <p className="text-gray-300 text-center mb-6">
              You've been inactive. You'll be automatically logged out in:
            </p>

            <div className="bg-[#010112] rounded-lg p-6 mb-6 text-center">
              <div className="text-5xl font-bold text-yellow-500 font-mono">
                {countdown}
              </div>
              <div className="text-sm text-gray-400 mt-2">
                {countdown === 1 ? 'second' : 'seconds'} remaining
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleStayLoggedIn}
                className="flex-1 bg-[#5ccfa2] text-black font-semibold py-3 rounded-lg hover:bg-[#45a881] transition-colors flex items-center justify-center gap-2"
              >
                <Clock className="w-5 h-5" />
                Stay Logged In
              </button>

              <button
                onClick={handleLogout}
                className="flex-1 bg-red-600 text-white font-semibold py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Logout Now
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              Move your mouse or press any key to stay active
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SessionMonitor;