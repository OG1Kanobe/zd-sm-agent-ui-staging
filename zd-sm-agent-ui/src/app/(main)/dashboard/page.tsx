'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, RefreshCw, BookOpen, Send, CheckCircle, 
  XCircle, ChevronLeft, ChevronRight, Filter, Eye,
  Trash2, MoreVertical, Grid3x3, Play, X, Check,
  Image as ImageIcon, Video as VideoIcon, Repeat, Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useUserSession } from '@/hooks/use-user-session';
import { FaFacebook, FaInstagram, FaLinkedin } from "react-icons/fa";
import { getFeatureFlags, type FeatureFlags } from '@/lib/feature-flags';

type Platform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'none';
type SourceType = 'social_post' | 'standalone_image' | 'video';
type PostStatus = 'Draft' | 'Scheduled' | 'Published' | 'Failed';

interface DashboardPost {
  id: string;
  user_id: string;
  content_group_id: string | null;
  source_type: SourceType;
  platform: Platform;
  image_url: string | null;
  video_url: string | null;
  video_thumbnail_url: string | null;
  caption: string | null;
  orientation: string | null;
  duration: string | null;
  category: string | null;
  tags: string[] | null;
  status: PostStatus;
  published: boolean;
  published_at: string | null;
  platform_post_id: string | null;
  platform_post_url: string | null;
  created_at: string;
  discard: boolean;
  parent_post_id: string | null;
  prompt_used: string | null;
  cta: string | null;
}

interface GroupedContent {
  contentGroupId: string;
  posts: DashboardPost[];
  primaryPost: DashboardPost;
  platforms: Platform[];
  allPublished: boolean;
}

interface DashboardStats {
  totalGenerated: number;
  totalPublished: number;
}

interface FilterState {
  sourceType: 'all' | SourceType;
  platform: 'all' | Platform;
  status: 'all' | PostStatus;
  category: string;
  fromDate: string;
  toDate: string;
}

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  facebook: <FaFacebook className="w-5 h-5" color="#5ccfa2" />,
  instagram: <FaInstagram className="w-5 h-5" color="#5ccfa2" />,
  linkedin: <FaLinkedin className="w-5 h-5" color="#5ccfa2" />,
  tiktok: <TikTokIcon className="w-5 h-5 text-[#5ccfa2]" />,
};

const PLATFORM_NAMES: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  none: 'None',
};

const getBadgeStyle = (sourceType: SourceType) => {
  switch (sourceType) {
    case 'social_post':
      return { color: 'bg-blue-700 text-white', icon: <Grid3x3 className="w-4 h-4 mr-1" />, label: 'Social Post' };
    case 'standalone_image':
      return { color: 'bg-orange-600 text-white', icon: <ImageIcon className="w-4 h-4 mr-1" />, label: 'Image' };
    case 'video':
      return { color: 'bg-purple-700 text-white', icon: <Play className="w-4 h-4 mr-1" />, label: 'Video' };
  }
};

const getSevenDaysAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().split('T')[0];
};

const getToday = () => new Date().toISOString().split('T')[0];

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const groupPostsByContentGroup = (posts: DashboardPost[]): {
  grouped: GroupedContent[];
  standalone: DashboardPost[];
} => {
  const groupMap = new Map<string, DashboardPost[]>();
  const standalone: DashboardPost[] = [];

  posts.forEach(post => {
    const isStandalone = !post.content_group_id || 
                         post.source_type === 'standalone_image' || 
                         post.source_type === 'video';
    
    if (isStandalone) {
      standalone.push(post);
    } else {
      const existing = groupMap.get(post.content_group_id!) || [];
      existing.push(post);
      groupMap.set(post.content_group_id!, existing);
    }
  });

  const grouped: GroupedContent[] = Array.from(groupMap.entries()).map(([contentGroupId, posts]) => {
    const platforms = posts.map(p => p.platform).filter(p => p !== 'none') as Platform[];
    const primaryPost = posts.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    
    return {
      contentGroupId,
      posts,
      primaryPost,
      platforms,
      allPublished: posts.every(p => p.published),
    };
  });

  grouped.sort((a, b) => 
    new Date(b.primaryPost.created_at).getTime() - new Date(a.primaryPost.created_at).getTime()
  );
  
  standalone.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return { grouped, standalone };
};

const useDashboardData = (userId: string | undefined, filters: FilterState) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [posts, setPosts] = useState<DashboardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      let query = supabase.from('posts').select('*').eq('user_id', userId).eq('discard', false).neq('status', 'In Progress');
      if (filters.fromDate) query = query.gte('created_at', `${filters.fromDate}T00:00:00`);
      if (filters.toDate) query = query.lte('created_at', `${filters.toDate}T23:59:59`);
      if (filters.sourceType !== 'all') query = query.eq('source_type', filters.sourceType);
      if (filters.platform !== 'all') query = query.eq('platform', filters.platform);
      if (filters.status !== 'all') query = query.eq('status', filters.status);
      if (filters.category && filters.category !== 'all') query = query.eq('category', filters.category);
      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setPosts((data || []) as DashboardPost[]);

      const { data: allPosts } = await supabase.from('posts').select('id, published, discard').eq('user_id', userId).eq('discard', false);
      const totalGenerated = new Set((allPosts || []).map(p => p.id)).size;
      const totalPublished = (allPosts || []).filter(p => p.published).length;
      setStats({ totalGenerated, totalPublished });
    } catch (e: any) {
      console.error('[Dashboard] Fetch error:', e);
      setError(e.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, [userId, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { stats, posts, loading, error, refetch: fetchData };
};

const SimpleStatCards: React.FC<{ stats: DashboardStats | null }> = ({ stats }) => {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-[#10101d] p-6 rounded-xl shadow-lg border border-gray-800 transition-all hover:border-[#5ccfa2]">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-sm font-mono uppercase text-gray-400">Content Generated</h3>
          <BookOpen className="w-6 h-6 text-[#5ccfa2]" />
        </div>
        <p className="text-4xl font-bold text-white mb-1">{stats.totalGenerated}</p>
        <p className="text-xs text-gray-500">Total pieces of content created</p>
      </div>
      <div className="bg-[#10101d] p-6 rounded-xl shadow-lg border border-gray-800 transition-all hover:border-[#5ccfa2]">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-sm font-mono uppercase text-gray-400">Posts Published</h3>
          <Send className="w-6 h-6 text-[#5ccfa2]" />
        </div>
        <p className="text-4xl font-bold text-white mb-1">{stats.totalPublished}</p>
        <p className="text-xs text-gray-500">Successfully published to platforms</p>
      </div>
    </div>
  );
};

const FilterBar: React.FC<{ filters: FilterState; onFiltersChange: (filters: FilterState) => void; }> = ({ filters, onFiltersChange }) => {
  const [tempFilters, setTempFilters] = useState(filters);
  const handleApply = () => { onFiltersChange(tempFilters); };

  return (
    <div className="bg-[#10101d] p-6 rounded-xl shadow-lg border border-gray-800">
      <div className="flex items-center mb-4">
        <Filter className="w-5 h-5 text-[#5ccfa2] mr-2" />
        <h3 className="text-lg font-mono text-white">Filter Content</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">From Date</label>
          <input type="date" value={tempFilters.fromDate} onChange={(e) => setTempFilters({ ...tempFilters, fromDate: e.target.value })} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]" style={{ colorScheme: 'dark' }} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">To Date</label>
          <input type="date" value={tempFilters.toDate} onChange={(e) => setTempFilters({ ...tempFilters, toDate: e.target.value })} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]" style={{ colorScheme: 'dark' }} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">Content Type</label>
          <select value={tempFilters.sourceType} onChange={(e) => setTempFilters({ ...tempFilters, sourceType: e.target.value as any })} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]">
            <option value="all">All Types</option><option value="social_post">Social Posts</option><option value="standalone_image">Images</option><option value="video">Videos</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">Platform</label>
          <select value={tempFilters.platform} onChange={(e) => setTempFilters({ ...tempFilters, platform: e.target.value as any })} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]">
            <option value="all">All Platforms</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="linkedin">LinkedIn</option><option value="tiktok">TikTok</option><option value="none">Standalone</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">Status</label>
          <select value={tempFilters.status} onChange={(e) => setTempFilters({ ...tempFilters, status: e.target.value as any })} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]">
            <option value="all">All Statuses</option><option value="Draft">Draft</option><option value="Scheduled">Scheduled</option><option value="Published">Published</option><option value="Failed">Failed</option>
          </select>
        </div>
      </div>
      <div className="mt-4">
        <button onClick={handleApply} className="w-full md:w-auto bg-[#5ccfa2] text-black font-semibold py-2 px-6 rounded-lg hover:bg-[#45a881] transition-colors flex items-center justify-center">
          <Filter className="w-4 h-4 mr-2" />Apply Filters
        </button>
      </div>
    </div>
  );
};

const CarouselCard: React.FC<{
  group: GroupedContent;
  onViewDetails: (group: GroupedContent) => void;
  onPublish: (group: GroupedContent) => void;
  onDelete: (postId: string) => void;
}> = ({ group, onViewDetails, onPublish, onDelete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const currentPost = group.posts[currentIndex];
  const hasMultiple = group.posts.length > 1;
  const badge = getBadgeStyle(currentPost.source_type);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#10101d] rounded-xl shadow-lg border border-gray-800 flex flex-col" style={{ aspectRatio: '4/5' }}>
      <div className="h-3/5 relative overflow-hidden rounded-t-xl">
        <img src={currentPost.image_url || 'https://placehold.co/400x500/10101d/5ccfa2?text=No+Image'} alt={PLATFORM_NAMES[currentPost.platform]} className="w-full h-full object-cover" />
        <div className="absolute top-3 right-3">
          <div className={`flex items-center px-3 py-1 text-xs rounded-full font-semibold ${badge.color}`}>{badge.icon}{badge.label}</div>
        </div>
        {currentPost.category && currentPost.category !== 'none' && (
          <div className="absolute top-3 left-3">
            <span className="bg-[#5ccfa2] text-black text-xs font-semibold px-3 py-1 rounded-full">{currentPost.category}</span>
          </div>
        )}
        {hasMultiple && (
          <>
            <button onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev - 1 + group.posts.length) % group.posts.length); }} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev + 1) % group.posts.length); }} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"><ChevronRight className="w-4 h-4" /></button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full text-white text-xs">{currentIndex + 1} / {group.posts.length}</div>
          </>
        )}
      </div>
      <div className="h-2/5 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-mono text-white">{PLATFORM_NAMES[currentPost.platform]}</h4>
            {hasMultiple && <span className="text-xs text-gray-500">{group.platforms.length} platforms</span>}
          </div>
          <p className="text-xs text-gray-400 line-clamp-2 mb-2">{truncateText(currentPost.caption || 'No caption', 100)}</p>
        </div>
        {currentPost.published && currentPost.platform_post_url ? (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-2">Published to:</p>
            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                {group.posts.filter(p => p.published).map(post => (
                  <a key={post.id} href={post.platform_post_url!} target="_blank" rel="noopener noreferrer" title={`Click to view on ${PLATFORM_NAMES[post.platform]}`} className="hover:opacity-80 transition-opacity">{PLATFORM_ICONS[post.platform]}</a>
                ))}
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => onViewDetails(group)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors flex items-center"><Eye className="w-3 h-3 mr-1" />View</button>
                <div className="relative">
                  <button onClick={() => setShowMenu(!showMenu)} className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"><MoreVertical className="w-4 h-4" /></button>
                  {showMenu && (
                    <div className="absolute right-0 bottom-full mb-2 w-40 bg-[#10101d] border border-gray-700 rounded-lg shadow-lg z-20">
                      <button onClick={() => { onDelete(currentPost.id); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-800 flex items-center text-sm rounded-lg"><Trash2 className="w-4 h-4 mr-2" />Delete</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2 mt-2">
            <button onClick={() => onViewDetails(group)} className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors flex items-center justify-center"><Eye className="w-4 h-4 mr-1" />View</button>
            <button onClick={() => onPublish(group)} className="flex-1 px-3 py-2 bg-[#5ccfa2] hover:bg-[#45a881] text-black text-sm rounded-lg font-semibold transition-colors flex items-center justify-center"><Send className="w-4 h-4 mr-1" />Publish</button>
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"><MoreVertical className="w-4 h-4" /></button>
              {showMenu && (
                <div className="absolute right-0 bottom-full mb-2 w-40 bg-[#10101d] border border-gray-700 rounded-lg shadow-lg z-20">
                  <button onClick={() => { onDelete(currentPost.id); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-800 flex items-center text-sm rounded-lg"><Trash2 className="w-4 h-4 mr-2" />Delete</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const StandaloneCard: React.FC<{
  post: DashboardPost;
  onDelete: (postId: string) => void;
  onConvertToPost: (post: DashboardPost) => void;
  onViewDetails: (group: GroupedContent) => void;
}> = ({ post, onDelete, onConvertToPost, onViewDetails }) => {
  const [showMenu, setShowMenu] = useState(false);
  const isImage = post.source_type === 'standalone_image';
  const isVideo = post.source_type === 'video';
  const badge = getBadgeStyle(post.source_type);
  const mediaUrl = isVideo ? (post.video_thumbnail_url || post.video_url) : post.image_url;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#10101d] rounded-xl shadow-lg border border-gray-800 flex flex-col" style={{ aspectRatio: '4/5' }}>
      <div className="h-3/5 relative overflow-hidden rounded-t-xl">
        <img src={mediaUrl || 'https://placehold.co/400x500/10101d/5ccfa2?text=No+Media'} alt={badge.label} className="w-full h-full object-cover" />
        {isVideo && <div className="absolute inset-0 flex items-center justify-center"><Play className="w-16 h-16 text-white/80" /></div>}
        <div className="absolute top-3 right-3">
          <div className={`flex items-center px-3 py-1 text-xs rounded-full font-semibold ${badge.color}`}>{badge.icon}{badge.label}</div>
        </div>
        {post.category && post.category !== 'none' && (
          <div className="absolute top-3 left-3">
            <span className="bg-[#5ccfa2] text-black text-xs font-semibold px-3 py-1 rounded-full">{post.category}</span>
          </div>
        )}
      </div>
      <div className="h-2/5 p-4 flex flex-col justify-between">
        <div>
          <p className="text-xs text-gray-400 line-clamp-2 mb-2">{post.prompt_used ? truncateText(post.prompt_used, 100) : 'No description'}</p>
          {isVideo && post.orientation && <p className="text-xs text-gray-500">{post.orientation} • {post.duration}s</p>}
        </div>
        <div className="flex items-center space-x-2 mt-2">
          {isImage && (
            <>
              <button onClick={() => onViewDetails({ contentGroupId: post.id, posts: [post], primaryPost: post, platforms: [], allPublished: false })} className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors flex items-center justify-center"><Eye className="w-4 h-4 mr-1" />View</button>
              <button onClick={() => onConvertToPost(post)} className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors flex items-center justify-center"><Repeat className="w-4 h-4 mr-1" />Convert</button>
            </>
          )}
          {isVideo && (
            <>
              <button onClick={() => onViewDetails({ contentGroupId: post.id, posts: [post], primaryPost: post, platforms: [], allPublished: false })} className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors flex items-center justify-center"><Eye className="w-4 h-4 mr-1" />View</button>
              <button onClick={() => alert('Video publish modal - to be connected')} className="flex-1 px-3 py-2 bg-[#5ccfa2] hover:bg-[#45a881] text-black text-xs rounded-lg font-semibold transition-colors flex items-center justify-center"><Send className="w-4 h-4 mr-1" />Publish</button>
            </>
          )}
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"><MoreVertical className="w-4 h-4" /></button>
            {showMenu && (
              <div className="absolute right-0 bottom-full mb-2 w-40 bg-[#10101d] border border-gray-700 rounded-lg shadow-lg z-20">
                <button onClick={() => { onDelete(post.id); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-800 flex items-center text-sm rounded-lg"><Trash2 className="w-4 h-4 mr-2" />Delete</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ViewDetailsModal: React.FC<{ group: GroupedContent; onClose: () => void; }> = ({ group, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentPost = group.posts[currentIndex];

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-[#0b0b10] w-full max-w-4xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-[#0b0b10] z-10">
            <h2 className="text-lg font-bold text-white">View Content Details</h2>
            <button onClick={onClose} className="p-2 rounded-lg bg-transparent hover:bg-gray-800 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          {group.posts.length > 1 && (
            <div className="flex items-center space-x-2 p-4 border-b border-gray-800 overflow-x-auto">
              {group.posts.map((post, idx) => (
                <button key={post.id} onClick={() => setCurrentIndex(idx)} className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${currentIndex === idx ? 'bg-[#5ccfa2] text-black' : 'bg-gray-800 text-white hover:bg-gray-700'}`}>{PLATFORM_ICONS[post.platform]}<span>{PLATFORM_NAMES[post.platform]}</span></button>
              ))}
            </div>
          )}
          <div className="p-6">
            {currentPost.parent_post_id && (
              <div className="bg-blue-900/20 border border-blue-700 p-3 rounded-lg mb-4">
                <p className="text-sm text-blue-300 flex items-center"><Link2 className="w-4 h-4 mr-2" />Cross-posted from another platform</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                {currentPost.source_type === 'video' ? (
                  <div className="relative">
                    <img src={currentPost.video_thumbnail_url || 'https://placehold.co/400x400/10101d/5ccfa2?text=Video'} alt="Video thumbnail" className="w-full aspect-square object-cover rounded-lg" />
                    <div className="absolute inset-0 flex items-center justify-center"><Play className="w-16 h-16 text-white/80" /></div>
                  </div>
                ) : (
                  <img src={currentPost.image_url || 'https://placehold.co/400x400/10101d/5ccfa2?text=No+Image'} alt={PLATFORM_NAMES[currentPost.platform]} className="w-full aspect-square object-cover rounded-lg" />
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Caption</h3>
                  <p className="text-sm text-white whitespace-pre-wrap">{currentPost.caption || 'No caption'}</p>
                </div>
                {currentPost.category && currentPost.category !== 'none' && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Category</h3>
                    <span className="inline-block bg-[#5ccfa2] text-black text-xs px-3 py-1 rounded-full">{currentPost.category}</span>
                  </div>
                )}
                {currentPost.tags && currentPost.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {currentPost.tags.map((tag, idx) => (
                        <span key={idx} className="inline-block bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                {currentPost.source_type === 'video' && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Video Info</h3>
                    <p className="text-sm text-white">{currentPost.orientation} • {currentPost.duration}s</p>
                  </div>
                )}
                {currentPost.published && currentPost.platform_post_url && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Published</h3>
                    <a href={currentPost.platform_post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-[#5ccfa2] hover:text-[#45a881] transition-colors">{PLATFORM_ICONS[currentPost.platform]}<span className="ml-2">View on {PLATFORM_NAMES[currentPost.platform]}</span></a>
                    <p className="text-xs text-gray-500 mt-2">Published {formatDate(currentPost.published_at!)}</p>
                  </div>
                )}
                {!currentPost.published && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Created</h3>
                    <p className="text-sm text-white">{formatDate(currentPost.created_at)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const PublishModal: React.FC<{ group: GroupedContent; onClose: () => void; onPublish: () => void; }> = ({ group, onClose, onPublish }) => {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(group.posts.filter(p => !p.published).map(p => p.platform));
  const [loading, setLoading] = useState(false);

  const togglePlatform = (platform: Platform) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handlePublish = async () => {
    setLoading(true);
    try {
      const existingPlatforms = group.posts.map(p => p.platform);
      const newPlatforms = selectedPlatforms.filter(p => !existingPlatforms.includes(p));
      let allPostIds = group.posts.filter(p => selectedPlatforms.includes(p.platform)).map(p => p.id);

      if (newPlatforms.length > 0) {
        const response = await fetch('/api/posts/create-cross-post-rows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourcePostId: group.posts[0].id, platforms: newPlatforms }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        allPostIds = [...allPostIds, ...data.newPosts.map((p: any) => p.id)];
      }

      const payload: any = { ig_publish: null, fb_publish: null, li_publish: null, tt_publish: null, userId: group.posts[0].user_id };
      for (const post of group.posts) {
        if (allPostIds.includes(post.id)) {
          if (post.platform === 'instagram') payload.ig_publish = post.id;
          if (post.platform === 'facebook') payload.fb_publish = post.id;
          if (post.platform === 'linkedin') payload.li_publish = post.id;
          if (post.platform === 'tiktok') payload.tt_publish = post.id;
        }
      }

      const publishResponse = await fetch('/api/n8n/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!publishResponse.ok) throw new Error('Publishing failed');
      onPublish();
      onClose();
    } catch (error: any) {
      console.error('[Publish] Error:', error);
      alert(`Failed to publish: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-[#0b0b10] w-full max-w-2xl rounded-xl shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-bold text-white">Publish Content</h2>
            <button onClick={onClose} className="p-2 rounded-lg bg-transparent hover:bg-gray-800 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-400 mb-4">Select platforms to publish to:</p>
            {group.posts.map(post => {
              const isPublished = post.published;
              const isSelected = selectedPlatforms.includes(post.platform);
              return (
                <div key={post.id} className={`flex items-center justify-between p-4 rounded-lg border ${isPublished ? 'border-green-700 bg-green-900/20' : isSelected ? 'border-[#5ccfa2] bg-[#5ccfa2]/10' : 'border-gray-700 bg-gray-800/50'}`}>
                  <div className="flex items-center space-x-3">
                    {PLATFORM_ICONS[post.platform]}
                    <span className="text-white">{PLATFORM_NAMES[post.platform]}</span>
                    {isPublished && <span className="text-xs text-green-400">✓ Already published</span>}
                  </div>
                  {!isPublished && (
                    <input type="checkbox" checked={isSelected} onChange={() => togglePlatform(post.platform)} className="w-5 h-5 text-[#5ccfa2] bg-[#010112] border-gray-700 rounded focus:ring-[#5ccfa2]" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-800">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors">Cancel</button>
            <button onClick={handlePublish} disabled={loading || selectedPlatforms.length === 0} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${loading || selectedPlatforms.length === 0 ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-[#5ccfa2] text-black hover:bg-[#45a881]'}`}>
              {loading ? <span className="flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publishing...</span> : `Publish to ${selectedPlatforms.length} Platform${selectedPlatforms.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const ConvertToPostModal: React.FC<{ imageUrl: string; sourcePostId: string; onClose: () => void; onSuccess: () => void; }> = ({ imageUrl, sourcePostId, onClose, onSuccess }) => {
  const [caption, setCaption] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePlatform = (platform: Platform) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handleSubmit = async () => {
    if (selectedPlatforms.length === 0) {
      setError('Please select at least one platform');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/posts/convert-to-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePostId,
          caption: caption.trim() || null,
          platforms: selectedPlatforms,
          category: category || null,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to convert image');

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[ConvertToPost] Error:', err);
      setError(err.message || 'Failed to convert image');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-[#0b0b10] w-full max-w-2xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-[#0b0b10] z-10">
            <h2 className="text-lg font-bold text-white">Convert Image to Social Post</h2>
            <button onClick={onClose} className="p-2 rounded-lg bg-transparent hover:bg-gray-800 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Image Preview</label>
              <img src={imageUrl} alt="Preview" className="w-full max-w-sm aspect-square object-cover rounded-lg mx-auto" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Caption (Optional)</label>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption or leave blank for AI generation" rows={4} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2] resize-none" />
              <p className="text-xs text-gray-500 mt-1">Leave blank to let AI generate a caption based on the image</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-3">Select Platforms</label>
              <div className="grid grid-cols-2 gap-3">
                {(['facebook', 'instagram', 'linkedin', 'tiktok'] as Platform[]).map(platform => {
                  const isSelected = selectedPlatforms.includes(platform);
                  return (
                    <button key={platform} onClick={() => togglePlatform(platform)} className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all ${isSelected ? 'border-[#5ccfa2] bg-[#5ccfa2]/10' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}>
                      <div className={isSelected ? 'text-[#5ccfa2]' : 'text-gray-400'}>{PLATFORM_ICONS[platform]}</div>
                      <span className={isSelected ? 'text-white font-semibold' : 'text-gray-300'}>{PLATFORM_NAMES[platform]}</span>
                      {isSelected && <Check className="w-5 h-5 text-[#5ccfa2] ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Category (Optional)</label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., Marketing, Branding" className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Tags (Optional)</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="summer, promo, sale (comma-separated)" className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]" />
              <p className="text-xs text-gray-500 mt-1">Separate multiple tags with commas</p>
            </div>
            {error && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-800">
            <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors disabled:opacity-50">Cancel</button>
            <button onClick={handleSubmit} disabled={loading || selectedPlatforms.length === 0} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center ${loading || selectedPlatforms.length === 0 ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-[#5ccfa2] text-black hover:bg-[#45a881]'}`}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating Posts...</> : `Generate Posts for ${selectedPlatforms.length} Platform${selectedPlatforms.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const DashboardPage = () => {
  const router = useRouter();
  const { user, loading: sessionLoading } = useUserSession();
  const userId = user?.id;

  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({ isAdmin: false, hasV2: false, hasV3: false });
  const [filters, setFilters] = useState<FilterState>({
    sourceType: 'all',
    platform: 'all',
    status: 'all',
    category: 'all',
    fromDate: getSevenDaysAgo(),
    toDate: getToday(),
  });

  const { stats, posts, loading, error, refetch } = useDashboardData(userId, filters);
  const { grouped, standalone } = useMemo(() => groupPostsByContentGroup(posts), [posts]);

  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedContent | null>(null);
  const [selectedPost, setSelectedPost] = useState<DashboardPost | null>(null);

  useEffect(() => {
    if (userId) {
      const flags = getFeatureFlags(userId);
      setFeatureFlags(flags);
    }
  }, [userId]);

  const handleViewDetails = (group: GroupedContent) => {
    setSelectedGroup(group);
    setViewDetailsOpen(true);
  };

  const handleOpenPublish = (group: GroupedContent) => {
    setSelectedGroup(group);
    setPublishModalOpen(true);
  };

  const handleConvertToPost = (post: DashboardPost) => {
    setSelectedPost(post);
    setConvertModalOpen(true);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this content?')) return;

    try {
      const { error } = await supabase.from('posts').update({ discard: true }).eq('id', postId);
      if (error) throw error;
      refetch();
    } catch (error) {
      console.error('[Dashboard] Delete error:', error);
      alert('Failed to delete content');
    }
  };

  if (sessionLoading || !userId) {
    if (!sessionLoading && !userId) {
      router.push('/login');
      return null;
    }
    return (
      <div className="min-h-screen flex justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#5ccfa2]" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#5ccfa2]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="bg-red-900/20 border border-red-700 p-8 rounded-xl max-w-lg text-center">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-mono text-red-300 mb-3">Error</h2>
          <p className="text-sm text-red-200">{error}</p>
          <button onClick={refetch} className="mt-6 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 text-white transition-colors">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center pb-4 border-b border-gray-800">
        <h2 className="text-3xl font-mono text-white">Dashboard</h2>
        <button onClick={refetch} className="p-2 rounded-full text-gray-400 hover:text-[#5ccfa2] transition-colors">
          <RefreshCw className="w-6 h-6" />
        </button>
      </div>

      <SimpleStatCards stats={stats} />
      <FilterBar filters={filters} onFiltersChange={setFilters} />

      <div>
        <h3 className="text-2xl font-mono text-white mb-6">Your Content</h3>
        {grouped.length === 0 && standalone.length === 0 ? (
          <div className="bg-[#10101d] p-12 rounded-xl border border-gray-800 text-center">
            <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h4 className="text-xl font-mono text-gray-400 mb-2">No Content Found</h4>
            <p className="text-gray-500">Start creating content in the Content Studio</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {grouped.map(group => (
              <CarouselCard key={group.contentGroupId} group={group} onViewDetails={handleViewDetails} onPublish={handleOpenPublish} onDelete={handleDelete} />
            ))}
            {standalone.map(post => (
              <StandaloneCard key={post.id} post={post} onDelete={handleDelete} onConvertToPost={handleConvertToPost} onViewDetails={handleViewDetails} />
            ))}
          </div>
        )}
      </div>

      {viewDetailsOpen && selectedGroup && (
        <ViewDetailsModal group={selectedGroup} onClose={() => { setViewDetailsOpen(false); setSelectedGroup(null); }} />
      )}

      {publishModalOpen && selectedGroup && (
        <PublishModal group={selectedGroup} onClose={() => { setPublishModalOpen(false); setSelectedGroup(null); }} onPublish={refetch} />
      )}

      {convertModalOpen && selectedPost && (
        <ConvertToPostModal imageUrl={selectedPost.image_url!} sourcePostId={selectedPost.id} onClose={() => { setConvertModalOpen(false); setSelectedPost(null); }} onSuccess={refetch} />
      )}
    </div>
  );
};

export default DashboardPage;