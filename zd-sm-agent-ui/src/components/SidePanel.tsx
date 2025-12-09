'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Settings, Calendar, LogOut, Zap, type LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type SidePanelProps = {
    userDisplayName: string;
};

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'configs', label: 'Agent Configs', icon: Settings, path: '/configs' },
    { id: 'publishing', label: 'Publishing', icon: Calendar, path: '/publishing' },
];

const PanelButton: React.FC<{ label: string; icon: LucideIcon; active: boolean; onClick: () => void }> = ({ label, icon: Icon, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
            active ? 'bg-[#5ccfa2] text-black shadow-lg font-bold' : 'text-gray-300 hover:bg-gray-700'
        }`}
    >
        <Icon className="w-5 h-5 mr-3" />
        {label}
    </button>
);

export const SidePanel: React.FC<SidePanelProps> = ({ userDisplayName }) => {
    const router = useRouter();
    const pathname = usePathname();

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error("Logout Error:", error.message);
        else router.push('/login');
    };

    return (
        <aside className="w-64 bg-[#10101d] p-4 flex flex-col justify-between border-r border-gray-800 fixed h-full z-20">
            <div>
                <h1 className="text-2xl font-mono text-[#5ccfa2] mb-8 flex items-center">
                    <Zap className="w-6 h-6 mr-2" /> ARCHITECT C
                </h1>
                <nav className="space-y-2">
                    {navItems.map(item => (
                        <PanelButton
                            key={item.id}
                            label={item.label}
                            icon={item.icon}
                            active={pathname === item.path || (pathname === '/' && item.path === '/dashboard')}
                            onClick={() => router.push(item.path)}
                        />
                    ))}
                </nav>
            </div>

            <div className="pt-4 border-t border-gray-700">
                <p className="text-sm text-gray-500 mb-2 truncate">
                    User: <span className="text-gray-300 font-mono">{userDisplayName}</span>
                </p>
                <button onClick={handleLogout} className="flex items-center w-full px-4 py-3 rounded-lg text-red-400 hover:bg-gray-700 transition-colors font-medium">
                    <LogOut className="w-5 h-5 mr-3" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
};
