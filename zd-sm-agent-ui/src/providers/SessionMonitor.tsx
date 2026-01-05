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
  const [countdown, setCountdown] = useState(15);
  
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // ============================================
  // CONFIGURATION - TESTING MODE
  // ============================================
  const WARNING_TIME = 55 * 60 * 1000 ; // 30 seconds for testing (30 * 1000)
  const LOGOUT_TIME =  60 * 60 * 1000 ; // 45 seconds for testing (45 * 1000)
  const WARNING_DURATION = LOGOUT_TIME - WARNING_TIME;
  // ============================================

  // Play notification sound
  const playNotificationSound = () => {
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
  };

  // Handle logout
  const handleLogout = async () => {
    console.log('🚪 EXECUTING LOGOUT NOW!');
    
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
    
    setShowWarning(false);
    
    // Sign out
    await supabase.auth.signOut();
    
    // Force redirect
    window.location.href = '/login?reason=inactivity';
  };

  // Reset activity timer (stable - doesn't depend on state)
  const resetActivityTimer = useCallback(() => {
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
    setShowWarning(false);
    
    // Set warning timer
    warningTimerRef.current = setTimeout(() => {
      console.log('⚠️ WARNING TIMER FIRED - Showing inactivity warning');
      setShowWarning(true);
      
      const warningSeconds = Math.floor(WARNING_DURATION / 1000);
      setCountdown(warningSeconds);
      playNotificationSound();
      
      // Start countdown
      let remainingSeconds = warningSeconds;
      countdownIntervalRef.current = setInterval(() => {
        remainingSeconds -= 1;
        console.log(`⏱️ Countdown: ${remainingSeconds}s remaining`);
        setCountdown(remainingSeconds);
        
        if (remainingSeconds <= 0 && countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }, 1000);
      
      // Set final logout timer
      logoutTimerRef.current = setTimeout(() => {
        console.log('⏰ LOGOUT TIMER FIRED!');
        handleLogout();
      }, WARNING_DURATION);
      
    }, WARNING_TIME);
    
    console.log(`✅ Timers set - Warning in ${WARNING_TIME/1000}s, Logout in ${LOGOUT_TIME/1000}s`);
    
  }, [WARNING_TIME, LOGOUT_TIME, WARNING_DURATION]); // Stable dependencies

  // Initialize ONCE when user logs in
  useEffect(() => {
    if (!user) {
      console.log('❌ No user - session monitor disabled');
      return;
    }
    
    console.log('👀 Session monitor initialized');
    
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Initialize timer
    resetActivityTimer();
    
    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, resetActivityTimer, { passive: true });
    });
    
    // Cleanup ONLY when component unmounts or user changes
    return () => {
      console.log('🧹 Session monitor cleanup');
      events.forEach(event => {
        window.removeEventListener(event, resetActivityTimer);
      });
      
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [user?.id, resetActivityTimer]); // Only re-run if user ID changes

  // Handle "Stay Logged In"
  const handleStayLoggedIn = () => {
    console.log('✅ User clicked Stay Logged In');
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
              Any activity will reset the timer
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SessionMonitor;