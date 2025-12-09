'use client';

import React from 'react';

type TopBarProps = {
    title: string;
    subtitle?: string;
};

export const TopBar: React.FC<TopBarProps> = ({ title, subtitle }) => {
    return (
        <header className="sticky top-0 z-10 bg-[#010112] pt-4 pb-8 border-b border-gray-800 -mx-8 px-8">
            <h1 className="text-4xl font-extrabold text-white">
                {title}
            </h1>
            {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </header>
    );
};
