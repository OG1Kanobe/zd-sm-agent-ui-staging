'use client';

import { useState, useEffect } from 'react';
import { supabase, Session } from '@/lib/supabaseClient'; // Import your client and types
import { User } from '@supabase/supabase-js';

// Define the shape of the data returned by the hook
interface UserSessionState {
    user: User | null;
    session: Session | null;
    loading: boolean;
}

/**
 * Custom hook to track Supabase authentication state across client components.
 * It uses onAuthStateChange for real-time updates (login/logout/token refresh).
 */
export const useUserSession = (): UserSessionState => {
    const [state, setState] = useState<UserSessionState>({
        user: null,
        session: null,
        loading: true,
    });

    useEffect(() => {
        // 1. Get the initial session status immediately
        const getInitialSession = async () => {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) {
                console.error("Error fetching initial session:", error.message);
            }
            
            setState({
                user: session?.user ?? null,
                session: session ?? null,
                loading: false,
            });
        };
        
        getInitialSession();

        // 2. Subscribe to future state changes (login, logout, token refresh)
        const { data: authListener } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setState({
                    user: session?.user ?? null,
                    session: session ?? null,
                    loading: false,
                });
            }
        );

        // Cleanup the subscription when the component unmounts
        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    return state;
};