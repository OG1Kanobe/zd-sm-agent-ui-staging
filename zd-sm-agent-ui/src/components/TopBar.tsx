'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';

type TopBarProps = {
    title: string;
    subtitle?: string;
    onRefresh?: () => void;
    showRefresh?: boolean;
};

export const TopBar: React.FC<TopBarProps> = ({ title, subtitle, onRefresh, showRefresh = false }) => {
    return (
        <header className="sticky top-0 z-10 bg-[#010112] pt-4 pb-8 border-b border-gray-800 -mx-8 px-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-extrabold text-white">
                        {title}
                    </h1>
                    {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
                </div>
                
                {showRefresh && onRefresh && (
                    <button 
                        onClick={onRefresh}
                        className="p-2 rounded-full hover:bg-gray-800 hover:text-[#5ccfa2] transition-colors"
                        aria-label="Refresh"
                    >
                        <RefreshCw className="w-6 h-6 text-gray-400" />
                    </button>
                )}
            </div>
        </header>
    );
};