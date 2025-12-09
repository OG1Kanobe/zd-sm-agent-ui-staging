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

type AuthMode = 'login' | 'register';

const AuthPage = () => {
    const router = useRouter();
    const { user, loading: sessionLoading } = useUserSession();

    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    // Add this near the top of your AuthPage component
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get('reason');
  
  if (reason === 'inactivity') {
    setMessage('You were logged out due to inactivity. Please log in again.');
  }
}, []);

    // Redirect authenticated users away from the login page
    useEffect(() => {
        if (!sessionLoading && user) {
            router.push('/dashboard');
        }
    }, [user, sessionLoading, router]);

    // Helper function to get the correct callback URL
    const getCallbackUrl = () => {
        // Check if we're in production
        if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SITE_URL) {
            return `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`;
        }
        // Fallback to current origin (works for both dev and prod)
        return `${window.location.origin}/auth/callback`;
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
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                // Redirection is handled by the useEffect hook after session update
            } else { // Register Mode
                if (!username) {
                    throw new Error("Display Name is required for registration.");
                }
                
                // Supabase registration with user metadata and proper callback
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

    if (sessionLoading || user) {
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
                    {mode === 'login' ? 'Agent Sign In' : 'Agent Activation'}
                </h1>
                
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
                
            </motion.div>
        </div>
    );
};

export default AuthPage;