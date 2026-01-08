'use client';

import React, { useState, useEffect } from 'react';
import { Zap, Home, Settings, Calendar, LogOut, Bell, Key, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useUserSession } from '@/hooks/use-user-session';
import { HighlightContext } from '@/contexts/HighlightContext';
import NotificationPanel from '@/components/NotificationPanel';
import SessionMonitor from '@/providers/SessionMonitor';
import LaunchpadWrapper from '@/components/LaunchpadWrapper';
import { getGreeting } from '@/lib/greetings';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useUserSession();
  const userId = user?.id;
  const userDisplayName = user?.user_metadata?.display_name || user?.email || 'Architect-Agent';
  const [greetingData, setGreetingData] = useState(() => getGreeting(userDisplayName));
  // Don't render until user is loaded
if (!user) {
  return (
    <div className="min-h-screen bg-[#010112] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#5ccfa2]" />
    </div>
  );
}
  // Update greeting to use user name correctly
useEffect(() => {
  setGreetingData(getGreeting(userDisplayName));
}, [userDisplayName]);

  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false);

        if (error) throw error;
        setUnreadCount(count || 0);
      } catch (err) {
        console.error('[Layout] Failed to fetch unread count:', err);
      }
    };

    fetchUnreadCount();

    const channel = supabase
      .channel('unread-count-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        () => fetchUnreadCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleNotificationClick = (postId: string) => {
    setHighlightedPostId(postId);
    
    if (pathname !== '/dashboard') {
      window.location.href = '/dashboard';
    }

    setTimeout(() => {
      const postCard = document.getElementById(`post-${postId}`);
      if (postCard) {
        postCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    setTimeout(() => setHighlightedPostId(null), 3000);
  };

  return (
    <>
      <SessionMonitor />
      <LaunchpadWrapper>
        <HighlightContext.Provider value={{ highlightedPostId, setHighlightedPostId }}>
          <div className="min-h-screen bg-[#010112] text-white flex">
            <aside className="w-64 bg-[#10101d] p-4 flex flex-col justify-between border-r border-gray-800 fixed h-full z-20">
              <div>
                <div className="mb-8 w-full">
  {/* Logo Image */}
  <div className="w-full h-relative mb-3 bg-none rounded-lg flex items-center justify-center">
    <img 
      src="https://edgkxonczgbvngdwpqei.supabase.co/storage/v1/object/public/logos/ZD/Content-Studio%20Logo%20-%20v2.png" 
      alt="Content Factory Logo" 
      className="w-full h-auto object-contain rounded-lg"
    />
  </div>
  
  {/* App Name */}
  <h1 className="text-xl font-mono font-bold text-[#5ccfa2] w-full">
    The Content Factory
  </h1>
  
  {/* Tagline */}
  <p className="text-xs text-white w-full mt-1">
    by Zenith Digital
  </p>
</div>
                <nav className="space-y-2">
                  <a
                    href="/dashboard"
                    className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors font-medium ${
                      pathname === '/dashboard' ? 'bg-[#5ccfa2] text-black shadow-lg' : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <Home className="w-5 h-5 mr-3" />
                    Dashboard
                  </a>
                  
                  <a
                    href="/configs"
                    className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors font-medium ${
                      pathname === '/configs' ? 'bg-[#5ccfa2] text-black shadow-lg' : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <Settings className="w-5 h-5 mr-3" />
                    Agent Configs
                  </a>

                  <a
                    href="/publishing"
                    className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors font-medium ${
                      pathname === '/publishing' ? 'bg-[#5ccfa2] text-black shadow-lg' : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <Calendar className="w-5 h-5 mr-3" />
                    Publishing
                  </a>

                   {/* NEW: INTEGRATIONS LINK */}
  
   <a href="/integrations"
    className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors font-medium ${
      pathname === '/integrations' ? 'bg-[#5ccfa2] text-black shadow-lg' : 'text-gray-300 hover:bg-gray-700'
    }`}
  >
    <Key className="w-5 h-5 mr-3" />
    Integrations
  </a>
                </nav>
              </div>

              <div className="pt-4 border-t border-gray-700">
                <p className="text-sm text-gray-500 mb-2 truncate">
                  User: <span className="text-gray-300 font-mono">{userDisplayName}</span>
                </p>
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-3 rounded-lg text-red-400 hover:bg-gray-700 transition-colors font-medium"
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Sign Out
                </button>
              </div>
            </aside>

            <div className="flex-1 ml-64">
              <header className="sticky top-0 z-10 bg-[#010112] pt-8 px-8 pb-4 border-b border-gray-800 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-4xl font-extrabold text-white font-mono">
  {greetingData.greeting} <span className="text-[#5ccfa2]">{greetingData.userName}</span>
</h1>
<p className="text-sm text-gray-400 mt-1">{greetingData.subtext}</p>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setIsNotificationPanelOpen(true)}
                      className="relative p-2 rounded-full hover:bg-[#10101d] transition-colors"
                    >
                      <Bell className="w-6 h-6 text-gray-400 hover:text-[#5ccfa2]" />
                      {unreadCount > 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                        >
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </motion.span>
                      )}
                    </button>
                  </div>
                </div>
              </header>

              <main className="p-8">{children}</main>
            </div>

            {userId && (
              <NotificationPanel
                isOpen={isNotificationPanelOpen}
                onClose={() => setIsNotificationPanelOpen(false)}
                userId={userId}
                onNotificationClick={handleNotificationClick}
              />
            )}
          </div>
        </HighlightContext.Provider>
      </LaunchpadWrapper>
    </>
  );
}