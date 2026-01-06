'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface OTPInputProps {
  length?: number;
  onComplete: (otp: string) => void;
  error?: boolean;
  disabled?: boolean;
}

export default function OTPInput({ 
  length = 6, 
  onComplete, 
  error = false,
  disabled = false 
}: OTPInputProps) {
  const [otp, setOtp] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Handle input change
  const handleChange = (value: string, index: number) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if complete
    if (newOtp.every(digit => digit !== '')) {
      onComplete(newOtp.join(''));
    }
  };

  // Handle key down
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    // Backspace - clear current and focus previous
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newOtp = [...otp];
      
      if (otp[index]) {
        // Clear current
        newOtp[index] = '';
        setOtp(newOtp);
      } else if (index > 0) {
        // Move to previous and clear it
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    }

    // Arrow left
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    // Arrow right
    if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').trim();
    
    // Only process if it's all digits and correct length
    if (/^\d+$/.test(pastedData) && pastedData.length === length) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      
      // Focus last input
      inputRefs.current[length - 1]?.focus();
      
      // Trigger completion
      onComplete(pastedData);
    }
  };

  // Reset OTP when error changes to true
  useEffect(() => {
    if (error) {
      setOtp(Array(length).fill(''));
      inputRefs.current[0]?.focus();
    }
  }, [error, length]);

  return (
    <motion.div
      className="flex justify-center gap-3"
      animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(e.target.value, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          disabled={disabled}
          className={`
            w-12 h-14 text-center text-2xl font-mono font-bold rounded-lg
            bg-[#1f2937] text-white border-2 transition-all
            focus:outline-none focus:ring-2 focus:ring-[#5ccfa2]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error 
              ? 'border-red-500 animate-shake' 
              : digit 
                ? 'border-[#5ccfa2]' 
                : 'border-gray-700'
            }
          `}
        />
      ))}
    </motion.div>
  );
}