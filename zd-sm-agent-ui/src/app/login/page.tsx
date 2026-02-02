'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mail, Lock, LogIn, UserPlus, Loader2, User, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useUserSession } from '@/hooks/use-user-session';
import AuthInput from '@/components/AuthInput'; 
import OTPInput from '@/components/OTPInput';
import { generateDeviceFingerprint, generateDeviceToken } from '@/lib/deviceFingerprint';

type AuthMode = 'login' | 'register';
type LoginStep = 'credentials' | 'otp';

const AuthPage = () => {
    const router = useRouter();
    const { user, loading: sessionLoading } = useUserSession();
    const buttonRef = useRef<HTMLButtonElement>(null);

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
    
    // Button dodge state
    const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const reason = params.get('reason');
        
        if (reason === 'inactivity') {
            setMessage('You were logged out due to inactivity. Please log in again.');
        }
    }, []);

    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => {
                setResendCooldown(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]); 

    useEffect(() => {
        if (!sessionLoading && user && !isAuthenticating && step === 'credentials') {
            router.push('/dashboard');
        }
    }, [user, sessionLoading, router, step, isAuthenticating]);

    // Mouse tracking for button dodge
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Button dodge logic
    useEffect(() => {
        if (!buttonRef.current || step !== 'credentials') return;

        const isFormValid = mode === 'login' 
            ? email && password
            : email && password && username;

        if (isFormValid) {
            setButtonPosition({ x: 0, y: 0 });
            return;
        }

        const button = buttonRef.current.getBoundingClientRect();
        const buttonCenterX = button.left + button.width / 2;
        const buttonCenterY = button.top + button.height / 2;

        const distanceX = mousePosition.x - buttonCenterX;
        const distanceY = mousePosition.y - buttonCenterY;
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

        const dodgeThreshold = 100;

        if (distance < dodgeThreshold) {
            const angle = Math.atan2(distanceY, distanceX);
            const dodgeDistance = 60;
            
            const newX = -Math.cos(angle) * dodgeDistance;
            const newY = -Math.sin(angle) * dodgeDistance;

            setButtonPosition({ x: newX, y: newY });
        } else if (distance > dodgeThreshold + 50) {
            setButtonPosition({ x: 0, y: 0 });
        }
    }, [mousePosition, email, password, username, mode, step]);

    const getCallbackUrl = () => {
        if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SITE_URL) {
            return `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`;
        }
        return `${window.location.origin}/auth/callback`;
    };

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
                .limit(1);

            const deviceData = data && data.length > 0 ? data[0] : null;
            if (error || !deviceData) return false;

            await supabase
                .from('trusted_devices')
                .update({ last_used_at: new Date().toISOString() })
                .eq('id', deviceData.id);

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
                
                if (!data.user) throw new Error('Login failed');

                const userIdToCheck = data.user.id;
                const isTrusted = await checkTrustedDevice(userIdToCheck);
                
                if (isTrusted) {
                    setIsAuthenticating(false);
                    router.push('/dashboard');
                    return;
                } else {
                    setUserId(userIdToCheck);
                    setStep('otp');
                    
                    await supabase.auth.signOut();
                    
                    const { error: otpError } = await supabase.auth.signInWithOtp({ 
                        email,
                        options: {
                            shouldCreateUser: false,
                            emailRedirectTo: undefined
                        }
                    });
                    
                    if (otpError) throw otpError;
                    
                    setResendCooldown(60);
                    setIsAuthenticating(false);
                    return;
                }
                
            } else {
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
                
                setMessage("Success! Check your email to confirm your account.");
            }

        } catch (err: any) {
            console.error("Auth Error:", err);
            setError(err.message || 'An unknown authentication error occurred.');
            setIsAuthenticating(false);
        } finally {
            setLoading(false);
        }
    };

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

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (signInError) throw signInError;

            if (rememberDevice && userId) {
                let deviceToken = localStorage.getItem('device_token');
                
                if (!deviceToken) {
                    deviceToken = generateDeviceToken();
                    const deviceFingerprint = generateDeviceFingerprint();

                    const { error } = await supabase.from('trusted_devices').insert({
                        user_id: userId,
                        device_token: deviceToken,
                        device_fingerprint: deviceFingerprint,
                        ip_address: null,
                        user_agent: navigator.userAgent,
                        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                    });
                    
                    if (!error) {
                        localStorage.setItem('device_token', deviceToken);
                    }
                } else {
                    const { data, error } = await supabase
                        .from('trusted_devices')
                        .update({ 
                            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                            last_used_at: new Date().toISOString()
                        })
                        .eq('device_token', deviceToken)
                        .eq('user_id', userId)
                        .select();
                    
                    if (!error && (!data || data.length === 0)) {
                        const deviceFingerprint = generateDeviceFingerprint();
                        
                        await supabase.from('trusted_devices').insert({
                            user_id: userId,
                            device_token: deviceToken,
                            device_fingerprint: deviceFingerprint,
                            ip_address: null,
                            user_agent: navigator.userAgent,
                            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                        });
                    }
                }
            }

            router.push('/dashboard');

        } catch (err: any) {
            console.error('OTP verification error:', err);
            setError('Invalid or expired code. Please try again.');
        } finally {
            setOtpLoading(false);
        }
    };

    const handleResendOTP = async () => {
        if (resendCooldown > 0) return;

        setOtpLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: false,
                    emailRedirectTo: undefined
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
                <span className="ml-3 font-['Inter_Tight']">Checking Authentication Status...</span>
            </div>
        );
    }

    // OTP STEP
    if (step === 'otp') {
        return (
            <div className="min-h-screen bg-[#010112] flex justify-center items-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-md bg-[#10101d] rounded-2xl shadow-2xl p-8 border border-gray-800"
                >
                    <h1 className="text-3xl font-['Space_Mono'] text-[#5ccfa2] text-center mb-6">
                        Enter Verification Code
                    </h1>
                    
                    <div className="mb-6">
                        <p className="text-gray-400 text-center text-sm mb-6 font-['Inter_Tight']">
                            We sent a 6-digit code to <span className="text-[#5ccfa2] font-semibold">{email}</span>
                        </p>

                        <OTPInput
                            onComplete={handleVerifyOTP}
                            error={!!error}
                            disabled={otpLoading}
                        />

                        {error && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="mt-4 p-3 rounded-lg text-sm font-['Inter_Tight'] flex items-center bg-red-900/50 text-red-300"
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                {error}
                            </motion.div>
                        )}

                        <div className="mt-6 flex items-center justify-center">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rememberDevice}
                                    onChange={(e) => setRememberDevice(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-700 bg-[#1f2937] text-[#5ccfa2] focus:ring-[#5ccfa2]"
                                />
                                <span className="text-sm text-gray-300 font-['Inter_Tight']">Remember this device for 30 days</span>
                            </label>
                        </div>

                        <button
                            type="button"
                            onClick={handleResendOTP}
                            disabled={resendCooldown > 0 || otpLoading}
                            className="mt-4 w-full text-sm text-gray-400 hover:text-[#5ccfa2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-['Inter_Tight']"
                        >
                            {resendCooldown > 0 
                                ? `Resend code in ${resendCooldown}s` 
                                : 'Resend code'
                            }
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ANIMATED CREDENTIALS STEP
    return (
        <div className="min-h-screen bg-[#1a1a1a] flex justify-center items-center p-4">
            <div className="w-full max-w-4xl h-[500px] relative rounded-2xl overflow-hidden shadow-2xl">
                
                {/* CONTAINER WITH DIAGONAL SPLIT */}
                <motion.div
                    className="relative w-full h-full"
                    style={{
                        clipPath: mode === 'login' 
                            ? 'polygon(0 0, 50% 0, 100% 100%, 0 100%)'
                            : 'polygon(50% 0, 100% 0, 100% 100%, 0 100%)'
                    }}
                    animate={{
                        clipPath: mode === 'login' 
                            ? 'polygon(0 0, 50% 0, 100% 100%, 0 100%)'
                            : 'polygon(50% 0, 100% 0, 100% 100%, 0 100%)'
                    }}
                    transition={{ duration: 0.7, ease: 'easeInOut' }}
                >
                    {/* ORANGE GRADIENT SIDE */}
                    <div 
                        className="absolute inset-0"
                        style={{
                            background: 'linear-gradient(135deg, #d9613a 0%, #c94d2a 100%)'
                        }}
                    />
                </motion.div>

                {/* DARK SIDE */}
                <div className="absolute inset-0 bg-[#2a2a2a]" style={{ zIndex: -1 }} />

                {/* WELCOME TEXT - LEFT SIDE (REGISTER MODE) */}
                <AnimatePresence mode="wait">
                    {mode === 'register' && (
                        <motion.div
                            key="welcome-left"
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="absolute left-12 top-1/2 -translate-y-1/2 text-white z-10 max-w-xs"
                        >
                            <h2 className="text-5xl font-['Space_Mono'] font-bold mb-4">
                                WELCOME!
                            </h2>
                            <p className="text-base font-['Inter_Tight'] opacity-90">
                                We're delighted to have you here. If you need any assistance, feel free to reach out.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* WELCOME TEXT - RIGHT SIDE (LOGIN MODE) */}
                <AnimatePresence mode="wait">
                    {mode === 'login' && (
                        <motion.div
                            key="welcome-right"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 50 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="absolute right-12 top-1/2 -translate-y-1/2 text-white z-10 max-w-xs text-right"
                        >
                            <h2 className="text-5xl font-['Space_Mono'] font-bold mb-4">
                                WELCOME BACK!
                            </h2>
                            <p className="text-base font-['Inter_Tight'] opacity-90">
                                We are happy to have you with us again. If you need anything, we are here to help.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* FORM - LEFT SIDE (LOGIN MODE) */}
                <AnimatePresence mode="wait">
                    {mode === 'login' && (
                        <motion.div
                            key="form-left"
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="absolute left-12 top-1/2 -translate-y-1/2 w-80 z-10"
                        >
                            <h1 className="text-3xl font-['Space_Mono'] text-white mb-6">Login</h1>
                            
                            <form onSubmit={handleAuth} className="space-y-4">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Username"
                                    className="w-full bg-transparent border-b border-gray-500 text-white py-2 px-2 font-['Inter_Tight'] focus:outline-none focus:border-[#d9613a] placeholder-gray-500"
                                    required
                                />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    className="w-full bg-transparent border-b border-gray-500 text-white py-2 px-2 font-['Inter_Tight'] focus:outline-none focus:border-[#d9613a] placeholder-gray-500"
                                    required
                                />

                                {(error || message) && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className={`p-3 rounded-lg text-sm font-['Inter_Tight'] ${
                                            error ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'
                                        }`}
                                    >
                                        {error || message}
                                    </motion.div>
                                )}

                                <motion.button
                                    ref={buttonRef}
                                    type="submit"
                                    disabled={loading}
                                    animate={{
                                        x: buttonPosition.x,
                                        y: buttonPosition.y
                                    }}
                                    transition={{
                                        type: 'spring',
                                        stiffness: 300,
                                        damping: 20
                                    }}
                                    className="w-full py-3 rounded-full font-['Space_Mono'] font-semibold text-white transition-all"
                                    style={{
                                        background: 'linear-gradient(90deg, #d9613a 0%, #c94d2a 100%)',
                                        boxShadow: '0 4px 15px rgba(217, 97, 58, 0.4)'
                                    }}
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Login'}
                                </motion.button>
                            </form>

                            <p className="mt-4 text-center text-sm font-['Inter_Tight'] text-gray-400">
                                Don't have an account?{' '}
                                <button
                                    onClick={() => {
                                        setMode('register');
                                        setError(null);
                                        setMessage(null);
                                    }}
                                    className="text-[#d9613a] hover:underline font-semibold"
                                >
                                    Sign Up
                                </button>
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* FORM - RIGHT SIDE (REGISTER MODE) */}
                <AnimatePresence mode="wait">
                    {mode === 'register' && (
                        <motion.div
                            key="form-right"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 50 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="absolute right-12 top-1/2 -translate-y-1/2 w-80 z-10"
                        >
                            <h1 className="text-3xl font-['Space_Mono'] text-white mb-6">Register</h1>
                            
                            <form onSubmit={handleAuth} className="space-y-4">
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Username"
                                    className="w-full bg-transparent border-b border-gray-500 text-white py-2 px-2 font-['Inter_Tight'] focus:outline-none focus:border-[#d9613a] placeholder-gray-500"
                                    required
                                />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Email"
                                    className="w-full bg-transparent border-b border-gray-500 text-white py-2 px-2 font-['Inter_Tight'] focus:outline-none focus:border-[#d9613a] placeholder-gray-500"
                                    required
                                />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    className="w-full bg-transparent border-b border-gray-500 text-white py-2 px-2 font-['Inter_Tight'] focus:outline-none focus:border-[#d9613a] placeholder-gray-500"
                                    required
                                />

                                {(error || message) && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className={`p-3 rounded-lg text-sm font-['Inter_Tight'] ${
                                            error ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'
                                        }`}
                                    >
                                        {error || message}
                                    </motion.div>
                                )}

                                <motion.button
                                    ref={buttonRef}
                                    type="submit"
                                    disabled={loading}
                                    animate={{
                                        x: buttonPosition.x,
                                        y: buttonPosition.y
                                    }}
                                    transition={{
                                        type: 'spring',
                                        stiffness: 300,
                                        damping: 20
                                    }}
                                    className="w-full py-3 rounded-full font-['Space_Mono'] font-semibold text-white transition-all"
                                    style={{
                                        background: 'linear-gradient(90deg, #d9613a 0%, #c94d2a 100%)',
                                        boxShadow: '0 4px 15px rgba(217, 97, 58, 0.4)'
                                    }}
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Register'}
                                </motion.button>
                            </form>

                            <p className="mt-4 text-center text-sm font-['Inter_Tight'] text-gray-400">
                                Don't have an account?{' '}
                                <button
                                    onClick={() => {
                                        setMode('login');
                                        setError(null);
                                        setMessage(null);
                                    }}
                                    className="text-[#d9613a] hover:underline font-semibold"
                                >
                                    Sign In
                                </button>
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default AuthPage;