'use client';

import React, { useState } from 'react';
import OTPInput from '@/components/OTPInput';
import { generateDeviceFingerprint, getDeviceInfo } from '@/lib/deviceFingerprint';

export default function TestOTPPage() {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(false);

  const handleComplete = (value: string) => {
    console.log('OTP Complete:', value);
    setOtp(value);
    
    // Simulate validation
    if (value === '123456') {
      alert('Correct OTP!');
    } else {
      setError(true);
      setTimeout(() => setError(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-[#010112] flex flex-col justify-center items-center p-4">
      <h1 className="text-3xl font-mono text-[#5ccfa2] mb-8">OTP Input Test</h1>
      
      <OTPInput
        onComplete={handleComplete}
        error={error}
      />
      
      <p className="mt-6 text-gray-400 text-sm">
        Entered OTP: <span className="text-white font-mono">{otp || 'None'}</span>
      </p>
      
      <p className="mt-2 text-gray-500 text-xs">
        Try entering: 123456 (correct) or anything else (error)
      </p>
    </div>
  );
}

<div className="mt-12 p-6 bg-[#10101d] rounded-lg border border-gray-800 max-w-md">
        <h2 className="text-xl font-mono text-[#5ccfa2] mb-4">Device Fingerprint Test</h2>
        
        <div className="space-y-2 text-sm">
          <p className="text-gray-400">
            Fingerprint: <span className="text-white font-mono">{generateDeviceFingerprint()}</span>
          </p>
          
          <p className="text-gray-400">
            Browser: <span className="text-white">{getDeviceInfo().browser}</span>
          </p>
          
          <p className="text-gray-400">
            OS: <span className="text-white">{getDeviceInfo().os}</span>
          </p>
          
          <p className="text-gray-400">
            Device: <span className="text-white">{getDeviceInfo().device}</span>
          </p>
        </div>
      </div>