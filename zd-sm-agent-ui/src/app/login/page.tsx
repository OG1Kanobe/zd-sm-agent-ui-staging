'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, UserPlus, Loader2, User, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

// --- PRODUCTION SUPABASE IMPORTS ---
import { supabase } from '@/lib/supabaseClient';
import { useUserSession } from '@/hooks/use-user-session';
import AuthInput from '@/components/AuthInput'; 
// --- END PRODUCTION SUPABASE IMPORTS ---

import OTPInput from '@/components/OTPInput';
import { generateDeviceFingerprint, generateDeviceToken } from '@/lib/deviceFingerprint';


type AuthMode = 'login' | 'register';

const AuthPage = () => {
    const router = useRouter();
    const { user, loading: sessionLoading } = useUserSession();

    type LoginStep = 'credentials' | 'otp';

const [mode, setMode] = useState<AuthMode>('login');
const [step, setStep] = useState<LoginStep>('credentials');
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [username, setUsername] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [message, setMessage] = useState<string | null>(null);
const [userId, setUserId] = useState<string | null>(null);
const [rememberDevice, setRememberDevice] = useState(false);
const [otpLoading, setOtpLoading] = useState(false);
const [resendCooldown, setResendCooldown] = useState(0);
const [isAuthenticating, setIsAuthenticating] = useState(false);

    // Add this near the top of your AuthPage component
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get('reason');
  
  if (reason === 'inactivity') {
    setMessage('You were logged out due to inactivity. Please log in again.');
  }
}, []);

// Resend cooldown timer
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => {
                setResendCooldown(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]); 

    // Redirect authenticated users away from the login page
    useEffect(() => {
    if (!sessionLoading && user && !isAuthenticating && step === 'credentials') {
        router.push('/dashboard');
    }
}, [user, sessionLoading, router, step, isAuthenticating]);

    // Helper function to get the correct callback URL
    const getCallbackUrl = () => {
        // Check if we're in production
        if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SITE_URL) {
            return `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`;
        }
        // Fallback to current origin (works for both dev and prod)
        return `${window.location.origin}/auth/callback`;
    };

    // Check if current device is trusted
    const checkTrustedDevice = async (userIdToCheck: string): Promise<boolean> => {
        try {
            const deviceToken = localStorage.getItem('device_token');
            
            if (!deviceToken) return false;
            
            const { data, error } = await supabase
                .from('trusted_devices')
                .select('*')
                .eq('device_token', deviceToken)
                .eq('user_id', userIdToCheck)
                .gt('expires_at', new Date().toISOString())
                .single();
            
            if (error || !data) return false;
            
            // Update last_used_at
            await supabase
                .from('trusted_devices')
                .update({ last_used_at: new Date().toISOString() })
                .eq('id', data.id);
            
            return true;
        } catch (err) {
            console.error('Device check error:', err);
            return false;
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        if (!email || !password) {
            setError("Email and password are required.");
            setLoading(false);
            return;
        }

        try {
    if (mode === 'login') {
        setIsAuthenticating(true);
        
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        if (!data.user) {
            throw new Error('Login failed');
        }

        setUserId(data.user.id);

        const isTrusted = await checkTrustedDevice(data.user.id);
        
        if (isTrusted) {
            console.log('✅ Device is trusted, skipping OTP');
            setIsAuthenticating(false); // ← ADD HERE
            router.push('/dashboard');
            return;
        } else {
            console.log('❌ Device not trusted, showing OTP');
            
            const { error: otpError } = await supabase.auth.signInWithOtp({ 
                email,
                options: {
                    shouldCreateUser: false
                }
            });
            
            if (otpError) throw otpError;
            
            setStep('otp');
            setResendCooldown(60);
            setIsAuthenticating(false); // ← ADD HERE
            return;
        }
                
            } else {
                // Register Mode (unchanged)
                if (!username) {
                    throw new Error("Display Name is required for registration.");
                }
                
                const { error } = await supabase.auth.signUp({ 
                    email, 
                    password, 
                    options: { 
                        data: { display_name: username },
                        emailRedirectTo: getCallbackUrl()
                    } 
                });

                if (error) throw error;
                
                setMessage("Success! Check your email to confirm your account. Click the link in the email to activate your profile.");
            }

        } catch (err: any) {
            console.error("Auth Error:", err);
            setError(err.message || 'An unknown authentication error occurred.');
        } finally {
            setLoading(false);
        }
    };

    // Verify OTP code
    const handleVerifyOTP = async (otpCode: string) => {
        setOtpLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.verifyOtp({
                email,
                token: otpCode,
                type: 'email'
            });

            if (error) throw error;

            // OTP verified successfully
            if (rememberDevice && userId) {
                // Save device as trusted
                const deviceToken = generateDeviceToken();
                const deviceFingerprint = generateDeviceFingerprint();

                await supabase.from('trusted_devices').insert({
                    user_id: userId,
                    device_token: deviceToken,
                    device_fingerprint: deviceFingerprint,
                    ip_address: null,
                    user_agent: navigator.userAgent,
                    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                });

                localStorage.setItem('device_token', deviceToken);
            }

            // Redirect to dashboard
            router.push('/dashboard');

        } catch (err: any) {
            console.error('OTP verification error:', err);
            setError('Invalid or expired code. Please try again.');
        } finally {
            setOtpLoading(false);
        }
    };

    // Resend OTP code
    const handleResendOTP = async () => {
        if (resendCooldown > 0) return;

        setOtpLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: false
                }
            });

            if (error) throw error;

            setMessage('New code sent to your email');
            setResendCooldown(60);

            setTimeout(() => setMessage(null), 3000);

        } catch (err: any) {
            console.error('Resend OTP error:', err);
            setError('Failed to resend code. Please try again.');
        } finally {
            setOtpLoading(false);
        }
    };

    if (sessionLoading) {
        return (
            <div className="min-h-screen bg-[#010112] flex justify-center items-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-[#5ccfa2]" />
                <span className="ml-3 font-mono">Checking Authentication Status...</span>
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
                <h1 className="text-3xl font-mono text-[#5ccfa2] text-center mb-6">
                    {step === 'otp' 
                        ? 'Enter Verification Code' 
                        : mode === 'login' 
                            ? 'Agent Sign In' 
                            : 'Agent Activation'
                    }
                </h1>
                
                    {step === 'otp' && (
                    <div className="mb-6">
                        <p className="text-gray-400 text-center text-sm mb-6">
                            We sent a 6-digit code to <span className="text-[#5ccfa2] font-semibold">{email}</span>
                        </p>

                        <OTPInput
                            onComplete={handleVerifyOTP}
                            error={!!error}
                            disabled={otpLoading}
                        />

                        <div className="mt-6 flex items-center justify-center">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rememberDevice}
                                    onChange={(e) => setRememberDevice(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-700 bg-[#1f2937] text-[#5ccfa2] focus:ring-[#5ccfa2]"
                                />
                                <span className="text-sm text-gray-300">Remember this device for 30 days</span>
                            </label>
                        </div>

                        <button
                            type="button"
                            onClick={handleResendOTP}
                            disabled={resendCooldown > 0 || otpLoading}
                            className="mt-4 w-full text-sm text-gray-400 hover:text-[#5ccfa2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {resendCooldown > 0 
                                ? `Resend code in ${resendCooldown}s` 
                                : 'Resend code'
                            }
                        </button>
                    </div>
                )}

                {step === 'credentials' && (
                <form onSubmit={handleAuth} className="space-y-4">
                    {mode === 'register' && (
                        <AuthInput 
                            Icon={User} 
                            type="text" 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                            placeholder="Display Name"
                            required
                        />
                    )}
                    <AuthInput 
                        Icon={Mail} 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        placeholder="Email Address"
                        required
                    />
                    <AuthInput 
                        Icon={Lock} 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="Password"
                        required
                    />

                    {(error || message) && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`p-3 rounded-lg text-sm font-sans flex items-center ${
                                error ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'
                            }`}
                        >
                            {error ? <XCircle className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                            {error || message}
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
                                {mode === 'login' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                                <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                            </>
                        )}
                    </button>
                </form>
                )}

                <button
                    onClick={() => {
                        setMode(mode === 'login' ? 'register' : 'login');
                        setError(null);
                        setMessage(null);
                    }}
                    className="mt-4 w-full text-center text-sm text-gray-400 hover:text-[#5ccfa2] transition-colors duration-200"
                >
                    {mode === 'login' ? "Need an account? Sign Up" : "Already have an account? Sign In"}
                </button>

                {mode === 'login' && (
                  
                    <a href="/forgot-password"
                    className="mt-2 block text-center text-sm text-gray-400 hover:text-[#5ccfa2] transition-colors duration-200"
                  >
                    Forgot your password?
                  </a>
                )}

            </motion.div>
        </div>
    );
};

export default AuthPage;