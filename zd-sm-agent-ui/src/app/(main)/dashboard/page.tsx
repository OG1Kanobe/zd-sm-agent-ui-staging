'use client';

/**
 * ========================================
 * ARCHITECT C - DASHBOARD PAGE
 * V3-Ready Implementation with Feature Flags
 * ========================================
 * 
 * V1 Features (All Users):
 * - Simple stat cards (Total Generated, Total Published)
 * - Content grid with filtering
 * - Carousel view for grouped content
 * - Platform icons with direct links
 * - Publish modal
 * - View details modal
 * - Delete functionality
 * 
 * V2 Features (Feature Flag Gated):
 * - Edit caption drawer
 * - Regenerate caption with AI
 * - Convert image → social post
 * - Convert image → video  
 * - Feedback collection
 * - Caption customization during cross-post
 * 
 * V3 Features (Admin Only):
 * - Cost tracking stats
 * - Stacked card animation
 * - Manual content grouping
 * - Advanced analytics
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, RefreshCw, Clock, BookOpen, Send, CheckCircle, 
  XCircle, ChevronLeft, ChevronRight, Filter, Eye,
  Edit3, Trash2, Play, MoreVertical, Star, MessageSquare,
  Zap, DollarSign, Image as ImageIcon, Video as VideoIcon,
  Repeat, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useUserSession } from '@/hooks/use-user-session';
import { FaFacebook, FaInstagram, FaLinkedin } from "react-icons/fa";
import { authenticatedFetch } from '@/lib/api-client';
import { getFeatureFlags, type FeatureFlags } from '@/lib/feature-flags';

// ========================================
// TYPES & INTERFACES
// ========================================

type Platform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'none';
type SourceType = 'social_post' | 'standalone_image' | 'video';
type PostStatus = 'Draft' | 'Scheduled' | 'Published' | 'Failed';
type Orientation = '16:9' | '9:16' | '1:1';
type Duration = '5' | '10' | '15' | '30';

interface DashboardPost {
  id: string;
  user_id: string;
  content_group_id: string | null;
  source_type: SourceType;
  platform: Platform;
  prompt_used: string | null;
  image_url: string | null;
  video_url: string | null;
  video_thumbnail_url: string | null;
  caption: string | null;
  orientation: Orientation | null;
  duration: Duration | null;
  category: string | null;
  tags: string[] | null;
  status: PostStatus;
  published: boolean;
  published_at: string | null;
  scheduled_at: string | null;
  platform_post_id: string | null;
  platform_post_url: string | null;
  created_at: string;
  updated_at: string;
  discard: boolean;
  feedback_rating: number | null;
  feedback_comment: string | null;
  version: number;
  parent_post_id: string | null;
}

interface GroupedContent {
  contentGroupId: string;
  posts: DashboardPost[];
  primaryPost: DashboardPost;
  platforms: Platform[];
  allPublished: boolean;
  anyPublished: boolean;
}

interface StandaloneContent {
  post: DashboardPost;
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

// ========================================
// CUSTOM TIKTOK ICON
// ========================================

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

// ========================================
// CONSTANTS & UTILITIES
// ========================================

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

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  social_post: 'Social Post',
  standalone_image: 'Image',
  video: 'Video',
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
  standalone: StandaloneContent[];
} => {
  const groupMap = new Map<string, DashboardPost[]>();
  const standalone: StandaloneContent[] = [];

  posts.forEach(post => {
    if (!post.content_group_id || post.source_type !== 'social_post') {
      standalone.push({ post });
    } else {
      const existing = groupMap.get(post.content_group_id) || [];
      existing.push(post);
      groupMap.set(post.content_group_id, existing);
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
      anyPublished: posts.some(p => p.published),
    };
  });

  grouped.sort((a, b) => 
    new Date(b.primaryPost.created_at).getTime() - new Date(a.primaryPost.created_at).getTime()
  );
  
  standalone.sort((a, b) => 
    new Date(b.post.created_at).getTime() - new Date(a.post.created_at).getTime()
  );

  return { grouped, standalone };
};

// ========================================
// DATA FETCHING HOOK
// ========================================

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
      let query = supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .eq('discard', false)
        .neq('status', 'In Progress');

      if (filters.fromDate) {
        query = query.gte('created_at', `${filters.fromDate}T00:00:00`);
      }
      if (filters.toDate) {
        query = query.lte('created_at', `${filters.toDate}T23:59:59`);
      }
      if (filters.sourceType !== 'all') {
        query = query.eq('source_type', filters.sourceType);
      }
      if (filters.platform !== 'all') {
        query = query.eq('platform', filters.platform);
      }
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const postsData = (data || []) as DashboardPost[];
      setPosts(postsData);

      // Calculate stats (all-time)
      const { data: allPosts } = await supabase
        .from('posts')
        .select('id, published, discard')
        .eq('user_id', userId)
        .eq('discard', false);

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { stats, posts, loading, error, refetch: fetchData };
};

// ========================================
// V1 COMPONENT: SIMPLE STAT CARDS
// ========================================

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

// ========================================
// V1 COMPONENT: FILTER BAR
// ========================================

const FilterBar: React.FC<{
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}> = ({ filters, onFiltersChange }) => {
  const [tempFilters, setTempFilters] = useState(filters);

  const handleApply = () => {
    onFiltersChange(tempFilters);
  };

  return (
    <div className="bg-[#10101d] p-6 rounded-xl shadow-lg border border-gray-800">
      <div className="flex items-center mb-4">
        <Filter className="w-5 h-5 text-[#5ccfa2] mr-2" />
        <h3 className="text-lg font-mono text-white">Filter Content</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">From Date</label>
          <input
            type="date"
            value={tempFilters.fromDate}
            onChange={(e) => setTempFilters({ ...tempFilters, fromDate: e.target.value })}
            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
            style={{ colorScheme: 'dark' }}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">To Date</label>
          <input
            type="date"
            value={tempFilters.toDate}
            onChange={(e) => setTempFilters({ ...tempFilters, toDate: e.target.value })}
            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
            style={{ colorScheme: 'dark' }}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Content Type</label>
          <select
            value={tempFilters.sourceType}
            onChange={(e) => setTempFilters({ ...tempFilters, sourceType: e.target.value as any })}
            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
          >
            <option value="all">All Types</option>
            <option value="social_post">Social Posts</option>
            <option value="standalone_image">Images</option>
            <option value="video">Videos</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Platform</label>
          <select
            value={tempFilters.platform}
            onChange={(e) => setTempFilters({ ...tempFilters, platform: e.target.value as any })}
            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
          >
            <option value="all">All Platforms</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="linkedin">LinkedIn</option>
            <option value="tiktok">TikTok</option>
            <option value="none">Standalone</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Status</label>
          <select
            value={tempFilters.status}
            onChange={(e) => setTempFilters({ ...tempFilters, status: e.target.value as any })}
            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
          >
            <option value="all">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Published">Published</option>
            <option value="Failed">Failed</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={handleApply}
          className="w-full md:w-auto bg-[#5ccfa2] text-black font-semibold py-2 px-6 rounded-lg hover:bg-[#45a881] transition-colors flex items-center justify-center"
        >
          <Filter className="w-4 h-4 mr-2" />
          Apply Filters
        </button>
      </div>
    </div>
  );
};

// ========================================
// V1 COMPONENT: CAROUSEL CARD (GROUPED CONTENT)
// ========================================

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

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + group.posts.length) % group.posts.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % group.posts.length);
  };

  const statusColor = 
    currentPost.status === 'Published' ? 'bg-green-700 text-white' :
    currentPost.status === 'Scheduled' ? 'bg-yellow-700 text-black' :
    currentPost.status === 'Failed' ? 'bg-red-700 text-white' :
    'bg-gray-700 text-gray-300';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#10101d] rounded-xl shadow-lg border border-gray-800 flex flex-col" //changed this 121225
      style={{ aspectRatio: '4/5' }}
    >
      {/* Image Section - Top 60% */}
      <div className="h-3/5 relative overflow-hidden rounded-t-xl"> {/* changed this 121225*/}
        <img
          src={currentPost.image_url || currentPost.video_thumbnail_url || 'https://placehold.co/400x500/10101d/5ccfa2?text=No+Image'}
          alt={PLATFORM_NAMES[currentPost.platform]}
          className="w-full h-full object-cover"
          onError={(e: any) => (e.target.src = 'https://placehold.co/400x500/10101d/5ccfa2?text=No+Image')}
        />

        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          <div className={`flex items-center px-3 py-1 text-xs rounded-full font-semibold ${statusColor}`}>
            {currentPost.status === 'Published' && <CheckCircle className="w-4 h-4 mr-1" />}
            {currentPost.status}
          </div>
        </div>

        {/* Category Badge */}
        {currentPost.category && (
          <div className="absolute top-3 left-3">
            <span className="bg-[#5ccfa2] text-black text-xs font-semibold px-3 py-1 rounded-full">
              {currentPost.category}
            </span>
          </div>
        )}

        {/* Carousel Navigation */}
        {hasMultiple && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full text-white text-xs">
              {currentIndex + 1} / {group.posts.length}
            </div>
          </>
        )}
      </div>

      {/* Content Section - Bottom 40% */}
      <div className="h-2/5 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-mono text-white">
              {PLATFORM_NAMES[currentPost.platform]}
            </h4>
            {hasMultiple && (
              <span className="text-xs text-gray-500">
                {group.platforms.length} platforms
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 line-clamp-2 mb-2">
            {truncateText(currentPost.caption || 'No caption', 100)}
          </p>
        </div>

        {/* Published Links or Actions */}
        {currentPost.published && currentPost.platform_post_url ? (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">Published:</p>
            <a
              href={currentPost.platform_post_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center text-[#5ccfa2] hover:text-[#45a881] text-sm"
            >
              {PLATFORM_ICONS[currentPost.platform]}
              <span className="ml-2">View on {PLATFORM_NAMES[currentPost.platform]}</span>
            </a>
          </div>
        ) : (
          <div className="flex items-center space-x-2 mt-2">
            <button
              onClick={() => onViewDetails(group)}
              className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors flex items-center justify-center"
            >
              <Eye className="w-4 h-4 mr-1" />
              View
            </button>
            <button
              onClick={() => onPublish(group)}
              className="flex-1 px-3 py-2 bg-[#5ccfa2] hover:bg-[#45a881] text-black text-sm rounded-lg font-semibold transition-colors flex items-center justify-center"
            >
              <Send className="w-4 h-4 mr-1" />
              Publish
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-[#10101d] border border-gray-700 rounded-lg shadow-lg z-10">
                  <button
                    onClick={() => {
                      onDelete(currentPost.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-800 flex items-center text-sm"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ========================================
// V1 COMPONENT: STANDALONE CONTENT CARD
// ========================================

const StandaloneCard: React.FC<{
  content: StandaloneContent;
  onDelete: (postId: string) => void;
  featureFlags: FeatureFlags;
}> = ({ content, onDelete, featureFlags }) => {
  const { post } = content;
  const [showMenu, setShowMenu] = useState(false);

  const isImage = post.source_type === 'standalone_image';
  const isVideo = post.source_type === 'video';

  const mediaUrl = isVideo 
    ? (post.video_thumbnail_url || post.video_url)
    : post.image_url;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#10101d] rounded-xl shadow-lg border border-gray-800 flex flex-col" // changed this 121225*
      style={{ aspectRatio: '4/5' }}
    >
      {/* Media Section */}
      <div className="h-3/5 relative overflow-hidden rounded-t-xl"> {/* changed this 121225*/}
        <img
          src={mediaUrl || 'https://placehold.co/400x500/10101d/5ccfa2?text=No+Media'}
          alt={SOURCE_TYPE_LABELS[post.source_type]}
          className="w-full h-full object-cover"
          onError={(e: any) => (e.target.src = 'https://placehold.co/400x500/10101d/5ccfa2?text=No+Media')}
        />

        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="w-16 h-16 text-white/80" />
          </div>
        )}

        {/* Type Badge */}
        <div className="absolute top-3 right-3">
          <div className="flex items-center px-3 py-1 text-xs rounded-full font-semibold bg-purple-700 text-white">
            {isImage ? <ImageIcon className="w-4 h-4 mr-1" /> : <VideoIcon className="w-4 h-4 mr-1" />}
            {SOURCE_TYPE_LABELS[post.source_type]}
          </div>
        </div>

        {/* Category */}
        {post.category && (
          <div className="absolute top-3 left-3">
            <span className="bg-[#5ccfa2] text-black text-xs font-semibold px-3 py-1 rounded-full">
              {post.category}
            </span>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="h-2/5 p-4 flex flex-col justify-between">
        <div>
          <p className="text-xs text-gray-400 line-clamp-2 mb-2">
            {post.prompt_used ? truncateText(post.prompt_used, 100) : 'No description'}
          </p>
          {isVideo && post.orientation && (
            <p className="text-xs text-gray-500">
              {post.orientation} • {post.duration}s
            </p>
          )}
        </div>

        <div className="flex items-center space-x-2 mt-2">
          {/* V2: Convert Actions */}
          {featureFlags.hasV2 && (
            <>
              {isImage && (
                <>
                  <button className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors">
                    To Post
                  </button>
                  <button className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-lg transition-colors">
                    To Video
                  </button>
                </>
              )}
              {isVideo && (
                <button className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors">
                  Publish
                </button>
              )}
            </>
          )}

          {/* V1: Just delete */}
          {!featureFlags.hasV2 && (
            <button
              onClick={() => onDelete(post.id)}
              className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition-colors flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-[#10101d] border border-gray-700 rounded-lg shadow-lg z-10">
                <button
                  onClick={() => {
                    onDelete(post.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-800 flex items-center text-sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ========================================
// V1 MODAL: VIEW DETAILS
// ========================================

const ViewDetailsModal: React.FC<{
  group: GroupedContent;
  onClose: () => void;
}> = ({ group, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentPost = group.posts[currentIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#0b0b10] w-full max-w-4xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-[#0b0b10] z-10">
            <h2 className="text-lg font-bold">View Content Details</h2>
            <button 
              onClick={onClose} 
              className="px-3 py-1 rounded bg-transparent hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>

          {/* Platform Tabs */}
          <div className="flex items-center space-x-2 p-4 border-b border-gray-800">
            {group.posts.map((post, idx) => (
              <button
                key={post.id}
                onClick={() => setCurrentIndex(idx)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  currentIndex === idx
                    ? 'bg-[#5ccfa2] text-black'
                    : 'bg-gray-800 text-white hover:bg-gray-700'
                }`}
              >
                {PLATFORM_ICONS[post.platform]}
                <span>{PLATFORM_NAMES[post.platform]}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Image */}
              <div>
                <img
                  src={currentPost.image_url || 'https://placehold.co/400x400/10101d/5ccfa2?text=No+Image'}
                  alt={PLATFORM_NAMES[currentPost.platform]}
                  className="w-full aspect-square object-cover rounded-lg"
                  onError={(e: any) => (e.target.src = 'https://placehold.co/400x400/10101d/5ccfa2?text=No+Image')}
                />
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Caption</h3>
                  <p className="text-sm text-white whitespace-pre-wrap">
                    {currentPost.caption || 'No caption'}
                  </p>
                </div>

                {currentPost.category && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Category</h3>
                    <span className="inline-block bg-[#5ccfa2] text-black text-xs px-3 py-1 rounded-full">
                      {currentPost.category}
                    </span>
                  </div>
                )}

                {currentPost.published && currentPost.platform_post_url && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Published</h3>
                    <a
                      href={currentPost.platform_post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-[#5ccfa2] hover:text-[#45a881]"
                    >
                      {PLATFORM_ICONS[currentPost.platform]}
                      <span className="ml-2">View on {PLATFORM_NAMES[currentPost.platform]}</span>
                    </a>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Created</h3>
                  <p className="text-sm text-white">{formatDate(currentPost.created_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ========================================
// V1 MODAL: PUBLISH
// ========================================

const PublishModal: React.FC<{
  group: GroupedContent;
  onClose: () => void;
  onPublish: (postIds: string[], platforms: Platform[]) => void;
}> = ({ group, onClose, onPublish }) => {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(
    group.posts.filter(p => !p.published).map(p => p.platform)
  );

  const togglePlatform = (platform: Platform) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handlePublish = () => {
    const postIds = group.posts
      .filter(p => selectedPlatforms.includes(p.platform))
      .map(p => p.id);
    
    onPublish(postIds, selectedPlatforms);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#0b0b10] w-full max-w-2xl rounded-xl shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-bold">Publish Content</h2>
            <button 
              onClick={onClose} 
              className="px-3 py-1 rounded bg-transparent hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>

          {/* Platform Selection */}
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-400 mb-4">Select platforms to publish to:</p>
            
            {group.posts.map(post => {
              const isPublished = post.published;
              const isSelected = selectedPlatforms.includes(post.platform);

              return (
                <div
                  key={post.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    isPublished
                      ? 'border-green-700 bg-green-900/20'
                      : isSelected
                      ? 'border-[#5ccfa2] bg-[#5ccfa2]/10'
                      : 'border-gray-700 bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {PLATFORM_ICONS[post.platform]}
                    <span className="text-white">{PLATFORM_NAMES[post.platform]}</span>
                    {isPublished && (
                      <span className="text-xs text-green-400">✓ Already published</span>
                    )}
                  </div>

                  {!isPublished && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePlatform(post.platform)}
                      className="w-5 h-5 text-[#5ccfa2] bg-[#010112] border-gray-700 rounded focus:ring-[#5ccfa2]"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-800">
            <button 
              onClick={onClose} 
              className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={selectedPlatforms.length === 0}
              className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                selectedPlatforms.length > 0
                  ? 'bg-[#5ccfa2] text-black hover:bg-[#45a881]'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              Publish to {selectedPlatforms.length} Platform{selectedPlatforms.length !== 1 ? 's' : ''}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ========================================
// V2 PLACEHOLDER: EDIT DRAWER
// ========================================

/* 
 * TODO V2: Edit Caption Drawer
 * - Manual caption editing
 * - AI regeneration button
 * - Category/tag editing
 * - Save functionality
 */

// ========================================
// V2 PLACEHOLDER: CONVERSION MODALS
// ========================================

/*
 * TODO V2: Convert Image → Social Post Modal
 * - Platform selection
 * - Caption customization option
 * - Creates new rows with same content_group_id
 * 
 * TODO V2: Convert Image → Video Modal
 * - Motion description input
 * - Orientation selection
 * - Duration selection
 * - Calls /api/n8n/video-gen
 */

// ========================================
// V2 PLACEHOLDER: FEEDBACK COLLECTION
// ========================================

/*
 * TODO V2: Feedback Drawer
 * - Rating (1-5 stars)
 * - Comment field
 * - Saves to feedback_rating, feedback_comment columns
 */

// ========================================
// V3 PLACEHOLDER: COST TRACKING STATS
// ========================================

/*
 * TODO V3: Cost Tracking Card
 * - Total cost USD/ZAR
 * - Expandable: Show by provider (OpenAI, Gemini, etc.)
 * - Expandable: Show by operation (Image, Video, Caption)
 * - Query from ai_costs table
 */

// ========================================
// V3 PLACEHOLDER: STACKED CARDS
// ========================================

/*
 * TODO V3: Stacked Card Component
 * - Multiple cards stacked with offset
 * - Hover to expand animation
 * - Active border around group
 * - Collapse on mouse leave
 * - Only render if content_group has 2+ posts
 */

// ========================================
// V3 PLACEHOLDER: MANUAL GROUPING
// ========================================

/*
 * TODO V3: Manual Content Grouping
 * - Dropdown to select existing content_group_id
 * - Or create new group
 * - Update post.content_group_id
 */

// ========================================
// MAIN DASHBOARD PAGE
// ========================================

const DashboardPage = () => {
  const router = useRouter();
  const { user, loading: sessionLoading, session } = useUserSession();
  const userId = user?.id;

  // Feature Flags
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
    isAdmin: false,
    hasV2: false,
    hasV3: false,
  });

  // Fetch feature flags on mount
  useEffect(() => {
    if (userId) {
      const flags = getFeatureFlags(userId);
      setFeatureFlags(flags);
      console.log('[Dashboard] Feature flags:', flags);
    }
  }, [userId]);

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    sourceType: 'all',
    platform: 'all',
    status: 'all',
    category: 'all',
    fromDate: getSevenDaysAgo(),
    toDate: getToday(),
  });

  // Data
  const { stats, posts, loading, error, refetch } = useDashboardData(userId, filters);

  // Grouped/Standalone content
  const { grouped, standalone } = useMemo(() => groupPostsByContentGroup(posts), [posts]);

  // Modals
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedContent | null>(null);

  // Handlers
  const handleViewDetails = (group: GroupedContent) => {
    setSelectedGroup(group);
    setViewDetailsOpen(true);
  };

  const handleOpenPublish = (group: GroupedContent) => {
    setSelectedGroup(group);
    setPublishModalOpen(true);
  };

  const handlePublish = async (postIds: string[], platforms: Platform[]) => {
    try {
      console.log('[Dashboard] Publishing:', postIds, platforms);
      
      // TODO: Call publishing API
      // await authenticatedFetch('/api/publish', {
      //   method: 'POST',
      //   body: JSON.stringify({ postIds, platforms }),
      // });

      alert('Publishing functionality coming soon!');
      setPublishModalOpen(false);
      refetch();
    } catch (error) {
      console.error('[Dashboard] Publish error:', error);
      alert('Failed to publish content');
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this content?')) return;

    try {
      const { error } = await supabase
        .from('posts')
        .update({ discard: true })
        .eq('id', postId);

      if (error) throw error;

      refetch();
    } catch (error) {
      console.error('[Dashboard] Delete error:', error);
      alert('Failed to delete content');
    }
  };

  // Loading/Error States
  if (sessionLoading || !userId) {
    if (!sessionLoading && !userId) {
      router.push('/login');
      return null;
    }
    return (
      <div className="min-h-screen flex justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#5ccfa2]" />
        <span className="ml-3 text-lg font-mono">Loading...</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#5ccfa2]" />
        <span className="ml-3 text-lg font-mono">Loading Dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="bg-red-900/20 border border-red-700 p-8 rounded-xl max-w-lg text-center">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-mono text-red-300 mb-3">Error Loading Dashboard</h2>
          <p className="text-sm text-red-200">{error}</p>
          <button 
            onClick={refetch} 
            className="mt-6 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 flex items-center mx-auto"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-800">
        <div>
          <h2 className="text-3xl font-mono text-white">Dashboard</h2>
          <p className="text-sm text-gray-400 mt-1">
            {featureFlags.hasV3 && '🚀 V3 Features Enabled'}
            {featureFlags.hasV2 && !featureFlags.hasV3 && '✨ V2 Features Enabled'}
            {!featureFlags.hasV2 && !featureFlags.hasV3 && 'Manage your content'}
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className={`p-2 rounded-full transition-colors ${
            loading ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-[#5ccfa2] hover:bg-[#10101d]'
          }`}
        >
          <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ========================================
          V1: SIMPLE STAT CARDS
          ======================================== */}
      <SimpleStatCards stats={stats} />

      {/* ========================================
          V3: COST TRACKING STATS (PLACEHOLDER)
          ======================================== */}
      {featureFlags.hasV3 && (
        <div className="bg-yellow-900/20 border border-yellow-700 p-6 rounded-xl">
          <h3 className="text-yellow-400 font-semibold mb-2">🚧 V3 Feature: Cost Tracking</h3>
          <p className="text-sm text-gray-300">
            Total AI costs, breakdown by provider (OpenAI, Gemini, etc.), breakdown by operation (Image, Video, Caption).
            Query from <code>ai_costs</code> table.
          </p>
        </div>
      )}

      {/* ========================================
          V1: FILTER BAR
          ======================================== */}
      <FilterBar filters={filters} onFiltersChange={setFilters} />

      {/* ========================================
          V1: CONTENT GRID
          ======================================== */}
      <div>
        <h3 className="text-2xl font-mono text-white mb-6">Your Content</h3>

        {grouped.length === 0 && standalone.length === 0 ? (
          <div className="bg-[#10101d] p-12 rounded-xl border border-gray-800 text-center">
            <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h4 className="text-xl font-mono text-gray-400 mb-2">No Content Found</h4>
            <p className="text-gray-500">
              {filters.sourceType !== 'all' || filters.platform !== 'all' || filters.status !== 'all'
                ? 'Try adjusting your filters'
                : 'Start creating content in the Content Studio'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Grouped Content (Social Posts) */}
            {grouped.map(group =>
              featureFlags.hasV3 ? (
                // V3: Stacked Card (TODO)
                <div key={group.contentGroupId} className="bg-yellow-900/20 border border-yellow-700 p-4 rounded-xl">
                  <p className="text-xs text-yellow-400 mb-2">🚧 V3: Stacked Card</p>
                  <CarouselCard
                    group={group}
                    onViewDetails={handleViewDetails}
                    onPublish={handleOpenPublish}
                    onDelete={handleDelete}
                  />
                </div>
              ) : (
                // V1: Carousel Card
                <CarouselCard
                  key={group.contentGroupId}
                  group={group}
                  onViewDetails={handleViewDetails}
                  onPublish={handleOpenPublish}
                  onDelete={handleDelete}
                />
              )
            )}

            {/* Standalone Content (Images/Videos) */}
            {standalone.map(content => (
              <StandaloneCard
                key={content.post.id}
                content={content}
                onDelete={handleDelete}
                featureFlags={featureFlags}
              />
            ))}
          </div>
        )}
      </div>

      {/* ========================================
          V2: PLACEHOLDER NOTICES
          ======================================== */}
      {featureFlags.hasV2 && (
        <div className="space-y-4">
          <div className="bg-blue-900/20 border border-blue-700 p-6 rounded-xl">
            <h3 className="text-blue-400 font-semibold mb-2">🚧 V2 Features (Coming Soon)</h3>
            <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
              <li>Edit Caption Drawer (manual edit + AI regeneration)</li>
              <li>Convert Image → Social Post (with caption customization)</li>
              <li>Convert Image → Video (motion description input)</li>
              <li>Feedback Collection (rating + comment)</li>
              <li>Caption customization during cross-post</li>
            </ul>
          </div>
        </div>
      )}

      {/* ========================================
          V1: MODALS
          ======================================== */}
      {viewDetailsOpen && selectedGroup && (
        <ViewDetailsModal
          group={selectedGroup}
          onClose={() => {
            setViewDetailsOpen(false);
            setSelectedGroup(null);
          }}
        />
      )}

      {publishModalOpen && selectedGroup && (
        <PublishModal
          group={selectedGroup}
          onClose={() => {
            setPublishModalOpen(false);
            setSelectedGroup(null);
          }}
          onPublish={handlePublish}
        />
      )}
    </div>
  );
};

export default DashboardPage;