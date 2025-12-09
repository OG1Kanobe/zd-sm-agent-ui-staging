// src/app/connected-success/page.tsx
import { Suspense } from 'react';
import ConnectedSuccessContent from './ConnectedSuccessContent';
import { Loader2 } from 'lucide-react';

/**
 * ConnectedSuccessPage Component (Server Component Wrapper)
 * This file is a Server Component by default and MUST NOT contain client hooks.
 * It only imports the Client Component and wraps it in Suspense.
 */
export default function ConnectedSuccessPage() {
    return (
        // The Suspense boundary is the CRITICAL fix for useSearchParams, 
        // as it tells the server to stop rendering here and wait for the client.
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
        }>
            {/* The imported component is the one marked 'use client' */}
            <ConnectedSuccessContent />
        </Suspense>
    );
}