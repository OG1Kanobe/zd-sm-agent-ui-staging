// src/app/connected-success/ConnectedSuccessContent.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle } from 'lucide-react';

/**
 * ConnectedSuccessContent Component
 * Contains all client-side logic and hooks.
 */
export default function ConnectedSuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const platform = searchParams.get('platform');
    const [countdown, setCountdown] = useState(5);
    
    const platformName = platform 
        ? platform.charAt(0).toUpperCase() + platform.slice(1) 
        : 'Social Media';

    useEffect(() => {
        // 1. IMMEDIATELY notify parent window of successful connection
        if (window.opener && platform) {
            window.opener.postMessage(
                { 
                    success: true, 
                    platform: platform // 'fb', 'ig', or 'li'
                },
                window.location.origin
            );
            console.log(`[OAuth Success] Sent message to parent: platform=${platform}`);
        }

        // 2. Start countdown timer
        const timer = setInterval(() => {
            setCountdown((prevCountdown) => {
                if (prevCountdown <= 1) {
                    clearInterval(timer);
                    // Close the popup window instead of redirecting
                    if (window.opener) {
                        window.close();
                    } else {
                        // Fallback: if not opened as popup, redirect
                        router.push('/publishing');
                    }
                    return 0;
                }
                return prevCountdown - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [router, platform]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                    Connection Successful!
                </h1>
                <p className="text-xl text-green-600 mb-6">
                    <strong>{platformName}</strong> account has been connected successfully.
                </p>
                <div className="flex items-center justify-center space-x-2 text-gray-500 mb-4">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <p className="text-lg">
                        This window will close in <strong>{countdown}</strong> seconds...
                    </p>
                </div>
                <button
                    onClick={() => window.close()}
                    className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition duration-150"
                >
                    Close this window now
                </button>
            </div>
        </div>
    );
}