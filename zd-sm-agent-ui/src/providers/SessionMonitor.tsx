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
  const [countdown, setCountdown] = useState(5); // 5 minute warning
  
  const lastActivityRef = useRef<number>(Date.now());
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Configuration
  const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds
  const WARNING_BEFORE_LOGOUT = 5 * 60 * 1000; // 5 minutes warning

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // Frequency in Hz
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
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    // Sign out
    await supabase.auth.signOut();
    
    // Redirect to login
    router.push('/login?reason=inactivity');
  }, [router]);

  // Reset activity timer
  const resetActivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    // Clear existing timers
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    // Hide warning if showing
    if (showWarning) {
      setShowWarning(false);
      console.log('✅ Activity detected - warning dismissed');
    }
    
    // Set warning timer (55 minutes from now)
    warningTimerRef.current = setTimeout(() => {
      console.log('⚠️ Showing inactivity warning');
      setShowWarning(true);
      setCountdown(5); // Reset countdown to 5 minutes
      playNotificationSound();
      
      // Start countdown
      let remainingMinutes = 5;
      countdownIntervalRef.current = setInterval(() => {
        remainingMinutes -= 1;
        setCountdown(remainingMinutes);
        
        if (remainingMinutes <= 0 && countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
      }, 60000); // Update every minute
      
      // Set final logout timer (5 minutes from warning)
      logoutTimerRef.current = setTimeout(() => {
        handleLogout();
      }, WARNING_BEFORE_LOGOUT);
      
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE_LOGOUT);
    
  }, [showWarning, handleLogout, playNotificationSound, INACTIVITY_TIMEOUT, WARNING_BEFORE_LOGOUT]);

  // Activity event listeners
  useEffect(() => {
    if (!user) return; // Only monitor if user is logged in
    
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    
    const handleActivity = () => {
      resetActivityTimer();
    };
    
    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });
    
    // Initialize timer on mount
    resetActivityTimer();
    
    console.log('👀 Session monitor initialized - 1 hour inactivity timeout');
    
    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [user, resetActivityTimer]);

  // Handle "Stay Logged In" button
  const handleStayLoggedIn = () => {
    console.log('✅ User chose to stay logged in');
    playNotificationSound(); // Acknowledge action
    resetActivityTimer();
  };

  // Don't render anything if user is not logged in
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
              You've been inactive for a while. You'll be automatically logged out in:
            </p>

            <div className="bg-[#010112] rounded-lg p-6 mb-6 text-center">
              <div className="text-5xl font-bold text-yellow-500 font-mono">
                {countdown}
              </div>
              <div className="text-sm text-gray-400 mt-2">
                {countdown === 1 ? 'minute' : 'minutes'} remaining
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