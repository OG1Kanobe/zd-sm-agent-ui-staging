'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, RefreshCw, Clock, BookOpen, Send, CheckCircle, Clock4, 
  XCircle, LucideIcon, Facebook, Instagram, Linkedin, ChevronLeft, ChevronRight, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase, Post as PostType } from '@/lib/supabaseClient';
import { useUserSession } from '@/hooks/use-user-session';
import { useHighlight } from '@/contexts/HighlightContext';
import { FaFacebook, FaInstagram, FaLinkedin } from "react-icons/fa";
import { authenticatedFetch } from '@/lib/api-client';

// TIRO-ONLY FEATURES - REMOVE THIS LINE WHEN GOING LIVE
const TIRO_USER_ID = 'b88432ba-e049-4360-96d6-8c248d7446dc';

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  facebook: <FaFacebook className="w-5 h-5" color="#5ccfa2" />,
  Facebook: <FaFacebook className="w-5 h-5" color="#5ccfa2" />,
  instagram: <FaInstagram className="w-5 h-5" color="#5ccfa2" />,
  Instagram: <FaInstagram className="w-5 h-5" color="#5ccfa2" />,
  linkedin: <FaLinkedin className="w-5 h-5" color="#5ccfa2" />,
  LinkedIn: <FaLinkedin className="w-5 h-5" color="#5ccfa2" />,
};

type Platform = 'Instagram' | 'Facebook' | 'LinkedIn' | 'Twitter' | 'None';
type PostStatus = 'In Progress' | 'Draft' | 'Scheduled' | 'Published' | 'Discarded';

interface DashboardPost {
  id: string;
  user_id: string;
  created_at: string;
  title: string;
  content: string;
  platforms: Platform[];
  status: PostStatus;
  image_url: string;
  scheduled_at: string | null;
  category?: string | null;
  content_type?: string | null;
  ig_image_link?: string | null;
  ig_caption?: string | null;
  ig_post_id?: string | null;
  ig_post_link?: string | null;
  fb_image_link?: string | null;
  fb_caption?: string | null;
  fb_post_id?: string | null;
  fb_post_link?: string | null;
  linkedin_image_link?: string | null;
  linkedin_caption?: string | null;
  linkedin_post_id?: string | null;
  linkedin_post_link?: string | null;
}

interface Metrics {
  scheduledTime: string;
  postsPublished: number;
  postsGenerated: number;
  postsPublishedBreakdown?: {
    fb: number;
    ig: number;
    li: number;
  };
  postsGeneratedBreakdown?: {
    fb: number;
    ig: number;
    li: number;
  };
}

interface FilterState {
  fromDate: string;
  toDate: string;
  category: string;
  platform: string[];
  contentType: string;
  status: string;
}

// Helper function to get date 7 days ago
const getSevenDaysAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().split('T')[0];
};

// Helper function to get today's date
const getToday = () => {
  return new Date().toISOString().split('T')[0];
};

const useDashboardData = (userId: string | undefined, filters: FilterState, currentPage: number) => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [allPosts, setAllPosts] = useState<DashboardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  
  const POSTS_PER_PAGE = 12;

  const computeMetrics = useCallback(async (userId: string) => {
    try {
      // Fetch ALL posts for this user (all-time stats)
      const { data: allUserPosts, error: statsError } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId);

      if (statsError) throw statsError;

      const postsArray = allUserPosts as DashboardPost[];

      // Posts Published: Total published links
      const fbPublished = postsArray.filter(p => p.fb_post_link).length;
      const igPublished = postsArray.filter(p => p.ig_post_link).length;
      const liPublished = postsArray.filter(p => p.linkedin_post_link).length;
      const totalPublished = fbPublished + igPublished + liPublished;

      // Posts Generated: Unique posts with at least one caption
      const fbGenerated = postsArray.filter(p => p.fb_caption).length;
      const igGenerated = postsArray.filter(p => p.ig_caption).length;
      const liGenerated = postsArray.filter(p => p.linkedin_caption).length;
      const uniquePostsWithCaptions = new Set<string>();
      postsArray.forEach(p => {
        if (p.fb_caption || p.ig_caption || p.linkedin_caption) {
          uniquePostsWithCaptions.add(p.id);
        }
      });
      const totalGenerated = uniquePostsWithCaptions.size;

      // Scheduled Time
      const nextScheduledPost = postsArray.find(p => p.status === 'Scheduled');

      setMetrics({
        scheduledTime: nextScheduledPost?.scheduled_at
          ? new Date(nextScheduledPost.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : 'Not Set',
        postsPublished: totalPublished,
        postsGenerated: totalGenerated,
        postsPublishedBreakdown: {
          fb: fbPublished,
          ig: igPublished,
          li: liPublished,
        },
        postsGeneratedBreakdown: {
          fb: fbGenerated,
          ig: igGenerated,
          li: liGenerated,
        },
      });
    } catch (e: any) {
      console.error("Metrics computation failed:", e);
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    if (!userId) {
      setError("No user ID available for data fetching.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build query with filters
      let query = supabase
        .from('posts')
        .select(`
          id, user_id, title, content, created_at, scheduled_at, platforms, status, image_url, category, content_type,
          ig_image_link, ig_caption, ig_post_id, ig_post_link,
          fb_image_link, fb_caption, fb_post_id, fb_post_link,
          linkedin_image_link, linkedin_caption, linkedin_post_id, linkedin_post_link
        `, { count: 'exact' })
        .eq('user_id', userId)
        .neq('status', 'In Progress'); // HIDE IN PROGRESS POSTS

      // Apply date range filter
      if (filters.fromDate) {
        query = query.gte('created_at', `${filters.fromDate}T00:00:00`);
      }
      if (filters.toDate) {
        query = query.lte('created_at', `${filters.toDate}T23:59:59`);
      }

      // Apply category filter
      if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }

      // Apply status filter
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Apply content type filter (Tiro-only)
      if (filters.contentType && filters.contentType !== 'all') {
        query = query.eq('content_type', filters.contentType);
      }

      // Apply ordering and pagination
      const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
      query = query
        .order('created_at', { ascending: false })
        .range(startIndex, startIndex + POSTS_PER_PAGE - 1);

      const { data: postsData, error: postsError, count } = await query;

      if (postsError) throw postsError;

      let filteredPosts = postsData as DashboardPost[];

      // Apply platform filter (client-side because of OR logic)
      if (filters.platform && filters.platform.length > 0) {
        filteredPosts = filteredPosts.filter(post => {
          return filters.platform.some(platform => {
            if (platform === 'facebook' && post.fb_caption) return true;
            if (platform === 'instagram' && post.ig_caption) return true;
            if (platform === 'linkedin' && post.linkedin_caption) return true;
            return false;
          });
        });
      }

      setAllPosts(filteredPosts);
      setTotalPages(Math.ceil((count || 0) / POSTS_PER_PAGE));
      
      // Compute all-time metrics
      await computeMetrics(userId);
    } catch (e: any) {
      console.error("Dashboard initial fetch failed:", e);
      setError(e.message || "Failed to fetch dashboard data.");
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [userId, filters, currentPage, computeMetrics]);

  useEffect(() => {
    if (!userId) return;
    fetchInitialData();

    const channel = supabase.channel('dashboard-feed')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'posts',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('[Dashboard] Real-time event:', payload);
        fetchInitialData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchInitialData]);

  return { 
    metrics, 
    activity: allPosts, 
    loading, 
    fetchData: fetchInitialData, 
    error,
    totalPages,
    currentPage
  };
};

const ActivityCard: React.FC<{
  post: DashboardPost;
  onOpen: (post: DashboardPost) => void;
  isPublishing?: boolean;
  isHighlighted?: boolean;
}> = ({ post, onOpen, isPublishing = false, isHighlighted = false }) => {
  const [localStatus, setLocalStatus] = useState<PostStatus>(post.status);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setLocalStatus(post.status);
  }, [post.status]);

  const handleDiscard = async () => {
    if (!window.confirm(`Are you sure you want to DISCARD "${post.title}"?`)) return;
    try {
      const { error } = await supabase.from('posts').update({ status: 'Discarded' }).eq('id', post.id);
      if (error) throw error;
      setLocalStatus('Discarded');
    } catch (e) {
      console.error('Failed to discard post:', e);
      window.alert('Failed to discard post — see console.');
    }
  };

  let statusClass = 'bg-gray-700 text-gray-300';
  let StatusIcon: LucideIcon = Clock4;

  switch (localStatus) {
    case 'Published':
      statusClass = 'bg-green-700 text-white cursor-default';
      StatusIcon = CheckCircle;
      break;
    case 'Scheduled':
      statusClass = 'bg-yellow-700 text-black cursor-default';
      StatusIcon = Clock;
      break;
    case 'Discarded':
      statusClass = 'bg-red-900/50 text-red-300 cursor-default';
      StatusIcon = XCircle;
      break;
  }

  const showMenu = localStatus === 'Draft' || localStatus === 'Scheduled';

  // Determine which platforms have content generated
  const generatedPlatforms: string[] = [];
  if (post.fb_caption) generatedPlatforms.push('Facebook');
  if (post.ig_caption) generatedPlatforms.push('Instagram');
  if (post.linkedin_caption) generatedPlatforms.push('LinkedIn');

  return (
    <motion.div
      id={`post-${post.id}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        borderColor: isHighlighted ? '#5ccfa2' : undefined
      }}
      transition={{ duration: 0.3 }}
      className={`activity-card bg-[#10101d] rounded-xl shadow-lg border flex flex-col overflow-hidden relative cursor-pointer ${
        isHighlighted ? 'border-[#5ccfa2] border-2' : 'border-gray-800'
      }`}
      style={{ aspectRatio: '4/5' }}
      onClick={() => onOpen(post)}
    >
      <div className="h-3/5 relative">
        <img
          src={post.image_url || `https://placehold.co/400x500/10101d/5ccfa2?text=${encodeURIComponent(post.title)}`}
          alt={post.title}
          className="w-full h-full object-cover"
          onError={(e: any) => (e.target.src = 'https://placehold.co/400x500/10101d/5ccfa2?text=No+Image')}
        />
      </div>

      {/* STATUS TAG - Z-INDEX: Change this value if needed (currently z-10, your top bar should be higher) */}
      <div className="absolute top-3 right-3 z-[5]">
        <div className={`flex items-center px-3 py-1 text-xs rounded-full font-semibold transition-colors shadow-md ${statusClass}`}>
          {isPublishing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <StatusIcon className="w-4 h-4 mr-1" />}
          {isPublishing ? 'Publishing...' : localStatus}
        </div>

        {showMenu && (
          <div className="mt-2 flex justify-end pr-1">
            <button
              onClick={(e) => { e.stopPropagation(); setIsMenuOpen(prev => !prev); }}
              className="text-xs text-gray-400 hover:text-red-400"
              title="More"
            >
              ...
            </button>
            {isMenuOpen && (
              <div className="absolute right-3 mt-8 w-40 origin-top-right rounded-md shadow-lg bg-[#10101d] border border-gray-700 p-1 z-20">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDiscard(); setIsMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center"
                >
                  <XCircle className="w-4 h-4 mr-2" /> Discard
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CATEGORY TAG */}
      {post.category && (
        <div className="absolute top-3 left-3 z-[5]">
          <span className="bg-[#5ccfa2] text-black text-xs font-semibold px-3 py-1 rounded-full">
            {post.category}
          </span>
        </div>
      )}

      <div className="h-2/5 p-4 flex flex-col justify-between">
        <div>
          <h4 className="text-base font-mono text-white truncate mb-1">{post.title}</h4>
          <p className="text-xs text-gray-400 line-clamp-2">{post.content}</p>
        </div>

        <div className="mt-3">
          {/* Show "Content generated for" text when NOT published */}
          {localStatus !== 'Published' && generatedPlatforms.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-gray-500">Content generated for: <span className="text-gray-400">{generatedPlatforms.join(', ')}</span></p>
            </div>
          )}

          {/* Show platform icons ONLY when published */}
          {localStatus === 'Published' && (
            <>
              <p className="text-xs font-semibold text-gray-500 mb-1">Posted to:</p>
              <div className="flex items-center space-x-2">
                {post.platforms && post.platforms.length > 0 ? (
                  post.platforms.map((p: string, idx: number) => (
                    <a
                      key={idx}
                      href={
                        p.toLowerCase() === "facebook" ? post.fb_post_link ?? "#" :
                        p.toLowerCase() === "instagram" ? post.ig_post_link ?? "#" :
                        p.toLowerCase() === "linkedin" ? post.linkedin_post_link ?? "#" : "#"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {PLATFORM_ICONS[p.toLowerCase()] || null}
                    </a>
                  ))
                ) : (
                  <span className="text-gray-500 text-xs">None</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const DashboardPage = () => {
  const router = useRouter();
  const { user, loading: sessionLoading } = useUserSession();
  const userId = user?.id;
  
  const { highlightedPostId } = useHighlight();

  // Filter state with defaults (last 7 days)
  const [filters, setFilters] = useState<FilterState>({
    fromDate: getSevenDaysAgo(),
    toDate: getToday(),
    category: 'all',
    platform: [],
    contentType: 'all',
    status: 'all',
  });

  // Temporary filter state (before applying)
  const [tempFilters, setTempFilters] = useState<FilterState>(filters);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Stats toggle states
  const [showPublishedBreakdown, setShowPublishedBreakdown] = useState(false);
  const [showGeneratedBreakdown, setShowGeneratedBreakdown] = useState(false);

  const { metrics, activity, loading: dataLoading, fetchData, error, totalPages } = useDashboardData(userId, filters, currentPage);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<DashboardPost | null>(null);
  const [publishingSet, setPublishingSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPublishingSet(prev => {
      const newSet = new Set(prev);
      activity.forEach(post => {
        if (newSet.has(post.id) && post.platforms && post.platforms.length > 0) {
          newSet.delete(post.id);
        }
      });
      return newSet;
    });
  }, [activity]);

  const openModal = (post: DashboardPost) => {
    // Check if post has any content
    const hasContent = post.fb_caption || post.ig_caption || post.linkedin_caption;
    
    if (!hasContent) {
      alert('No content available for this post yet. Content generation may still be in progress.');
      return;
    }

    setSelectedPost(post);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedPost(null);
  };

  const handleApplyFilters = () => {
    setFilters(tempFilters);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleModalPublish = async (
    postId: string,
    userIdPayload: string,
    platformFlags: {
      fb_publish: boolean;
      ig_publish: boolean;
      linkedin_publish: boolean;
    }
  ) => {
    if (!platformFlags.fb_publish && !platformFlags.ig_publish && !platformFlags.linkedin_publish) {
      window.alert('Please select at least one platform to publish to.');
      return;
    }

    setPublishingSet(prev => new Set(prev).add(postId));

    try {
      console.log('[Dashboard] Publishing post:', postId, platformFlags);

      const response = await authenticatedFetch('/api/n8n/publish', {
        method: 'POST',
        body: JSON.stringify({ 
          postId, 
          user_id: userIdPayload, 
          ...platformFlags 
        }),
      });

      const data = await response.json();
      console.log('[Dashboard] Response:', response.status, data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Webhook failed');
      }

      console.log('[Dashboard] Publish success');
      closeModal();

    } catch (err: any) {
      console.error('[Dashboard] Publish action failed:', err);
      window.alert(`Failed to publish post: ${err.message}`);
      setPublishingSet(prev => {
        const copy = new Set(prev);
        copy.delete(postId);
        return copy;
      });
    }
  };

  const handlePlatformFilterChange = (platform: string) => {
    setTempFilters(prev => ({
      ...prev,
      platform: prev.platform.includes(platform)
        ? prev.platform.filter(p => p !== platform)
        : [...prev.platform, platform]
    }));
  };

  if (sessionLoading || !userId) {
    if (!sessionLoading && !userId) {
      router.push('/login');
      return null;
    }
    return (
      <div className="min-h-screen flex justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#5ccfa2]" />
        <span className="ml-3 text-lg font-mono">Checking Authentication Status...</span>
      </div>
    );
  }

  if (dataLoading && !error) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#5ccfa2]" />
        <span className="ml-3 text-lg font-mono">Loading System Configuration...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="bg-red-900/20 border border-red-700 p-8 rounded-xl max-w-lg text-center">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-mono text-red-300 mb-3">Data Fetch Error</h2>
          <p className="text-sm text-red-200">{error}</p>
          <button onClick={fetchData} className="mt-6 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 flex items-center mx-auto">
            <RefreshCw className="w-4 h-4 mr-2" /> Retry Fetch
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#5ccfa2]" />
        <span className="ml-3 text-lg font-mono">Finalizing Configuration...</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-10">
        <div className="flex justify-between items-center pb-4 border-b border-gray-800">
          <h2 className="text-3xl font-mono text-white">Dashboard Overview</h2>
          <button
            onClick={fetchData}
            disabled={dataLoading}
            className={`p-2 rounded-full transition-colors ${dataLoading ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-[#5ccfa2] hover:bg-[#10101d]'}`}
            title="Refresh Data"
          >
            <RefreshCw className={`w-6 h-6 ${dataLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Scheduled Time */}
          <div className="bg-[#10101d] p-6 rounded-xl shadow-lg border border-gray-800 transition-all hover:border-[#5ccfa2]">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-mono uppercase text-gray-400">Scheduled Time</h3>
              <Clock className="w-6 h-6 text-[#5ccfa2]" />
            </div>
            <p className="text-4xl font-bold text-white mb-1">{metrics.scheduledTime}</p>
            <p className="text-xs text-gray-500">Time until next scheduled post</p>
          </div>

          {/* Posts Published - Toggleable */}
          <div 
            className="bg-[#10101d] p-6 rounded-xl shadow-lg border border-gray-800 transition-all hover:border-[#5ccfa2] cursor-pointer"
            onClick={() => setShowPublishedBreakdown(!showPublishedBreakdown)}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-mono uppercase text-gray-400">Posts Published</h3>
              <Send className="w-6 h-6 text-[#5ccfa2]" />
            </div>
            {!showPublishedBreakdown ? (
              <>
                <p className="text-4xl font-bold text-white mb-1">{metrics.postsPublished}</p>
                <p className="text-xs text-gray-500">Total published links (all platforms)</p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-lg font-semibold text-white mb-1">
                  <span>FB: {metrics.postsPublishedBreakdown?.fb || 0}</span>
                  <span>IG: {metrics.postsPublishedBreakdown?.ig || 0}</span>
                  <span>LI: {metrics.postsPublishedBreakdown?.li || 0}</span>
                </div>
                <p className="text-xs text-gray-500">Breakdown by platform</p>
              </>
            )}
          </div>

          {/* Content Generated - Toggleable */}
          <div 
            className="bg-[#10101d] p-6 rounded-xl shadow-lg border border-gray-800 transition-all hover:border-[#5ccfa2] cursor-pointer"
            onClick={() => setShowGeneratedBreakdown(!showGeneratedBreakdown)}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-mono uppercase text-gray-400">Content Generated</h3>
              <BookOpen className="w-6 h-6 text-[#5ccfa2]" />
            </div>
            {!showGeneratedBreakdown ? (
              <>
                <p className="text-4xl font-bold text-white mb-1">{metrics.postsGenerated}</p>
                <p className="text-xs text-gray-500">Unique posts with content</p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-lg font-semibold text-white mb-1">
                  <span>FB: {metrics.postsGeneratedBreakdown?.fb || 0}</span>
                  <span>IG: {metrics.postsGeneratedBreakdown?.ig || 0}</span>
                  <span>LI: {metrics.postsGeneratedBreakdown?.li || 0}</span>
                </div>
                <p className="text-xs text-gray-500">Captions by platform</p>
              </>
            )}
          </div>
        </div>

        {/* FILTERS SECTION */}
        <div className="bg-[#10101d] p-6 rounded-xl shadow-lg border border-gray-800">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-[#5ccfa2] mr-2" />
            <h3 className="text-lg font-mono text-white">Filter Posts</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* From Date */}
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

            {/* To Date */}
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

            {/* Category */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Category</label>
              <select
                value={tempFilters.category}
                onChange={(e) => setTempFilters({ ...tempFilters, category: e.target.value })}
                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
              >
                <option value="all">All Categories</option>
                <option value="Microsoft">Microsoft</option>
                {/* ADD MORE CATEGORIES HERE */}
              </select>
            </div>

            {/* Platform Filter */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Platform</label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempFilters.platform.includes('facebook')}
                    onChange={() => handlePlatformFilterChange('facebook')}
                    className="w-4 h-4 text-[#5ccfa2] bg-[#010112] border-gray-700 rounded focus:ring-[#5ccfa2]"
                  />
                  <span className="text-white text-sm">FB</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempFilters.platform.includes('instagram')}
                    onChange={() => handlePlatformFilterChange('instagram')}
                    className="w-4 h-4 text-[#5ccfa2] bg-[#010112] border-gray-700 rounded focus:ring-[#5ccfa2]"
                  />
                  <span className="text-white text-sm">IG</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempFilters.platform.includes('linkedin')}
                    onChange={() => handlePlatformFilterChange('linkedin')}
                    className="w-4 h-4 text-[#5ccfa2] bg-[#010112] border-gray-700 rounded focus:ring-[#5ccfa2]"
                  />
                  <span className="text-white text-sm">LI</span>
                </label>
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Status</label>
              <select
                value={tempFilters.status}
                onChange={(e) => setTempFilters({ ...tempFilters, status: e.target.value })}
                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
              >
                <option value="all">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Scheduled">Scheduled</option>
              </select>
            </div>

            {/* TIRO-ONLY: Content Type Filter */}
            {userId === TIRO_USER_ID && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Content Type (Tiro Only)</label>
                <select
                  value={tempFilters.contentType}
                  onChange={(e) => setTempFilters({ ...tempFilters, contentType: e.target.value })}
                  className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                >
                  <option value="all">All Types</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </div>
            )}
          </div>

          {/* Apply Button */}
          <div className="mt-4">
            <button
              onClick={handleApplyFilters}
              className="w-full md:w-auto bg-[#5ccfa2] text-black font-semibold py-2 px-6 rounded-lg hover:bg-[#45a881] transition-colors flex items-center justify-center"
            >
              <Filter className="w-4 h-4 mr-2" />
              Apply Filters
            </button>
          </div>
        </div>

        {/* POSTS SECTION */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-mono text-white">Latest Agent Activity</h3>
            {totalPages > 1 && (
              <p className="text-sm text-gray-400">
                Page {currentPage} of {totalPages}
              </p>
            )}
          </div>

          {activity.length === 0 ? (
            <div className="bg-[#10101d] p-12 rounded-xl border border-gray-800 text-center">
              <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h4 className="text-xl font-mono text-gray-400 mb-2">No Posts Found</h4>
              <p className="text-gray-500">No posts match your current filters. Try adjusting the date range or filters.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {activity.map(post => (
                  <ActivityCard
                    key={post.id}
                    post={post}
                    onOpen={openModal}
                    isPublishing={publishingSet.has(post.id)}
                    isHighlighted={highlightedPostId === post.id}
                  />
                ))}
              </div>

              {/* PAGINATION */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center mt-8 space-x-4">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`flex items-center px-4 py-2 rounded-lg font-semibold transition-colors ${
                      currentPage === 1
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-[#10101d] text-white hover:bg-gray-700 border border-gray-800'
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    Previous
                  </button>

                  <span className="text-gray-400 font-mono">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`flex items-center px-4 py-2 rounded-lg font-semibold transition-colors ${
                      currentPage === totalPages
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-[#10101d] text-white hover:bg-gray-700 border border-gray-800'
                    }`}
                  >
                    Next
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {modalOpen && selectedPost && (
        <PublishModalComponent 
          post={selectedPost} 
          onClose={closeModal}
          onPublish={handleModalPublish}
        />
      )}
    </>
  );
};

const PublishModalComponent: React.FC<{
  post: DashboardPost;
  onClose: () => void;
  onPublish: (postId: string, userId: string, flags: any) => void;
}> = ({ post, onClose, onPublish }) => {
  const [fbChecked, setFbChecked] = useState(!!post.fb_post_link);
  const [igChecked, setIgChecked] = useState(!!post.ig_post_link);
  const [lnChecked, setLnChecked] = useState(!!post.linkedin_post_link);

  useEffect(() => {
    setFbChecked(!!post.fb_post_link);
    setIgChecked(!!post.ig_post_link);
    setLnChecked(!!post.linkedin_post_link);
  }, [post]);

  const fbAlreadyPublished = !!post.fb_post_link;
  const igAlreadyPublished = !!post.ig_post_link;
  const lnAlreadyPublished = !!post.linkedin_post_link;

  // Only show columns with content
  const showFB = post.fb_image_link && post.fb_caption;
  const showIG = post.ig_image_link && post.ig_caption;
  const showLI = post.linkedin_image_link && post.linkedin_caption;

  const canPublish = (fbChecked && !fbAlreadyPublished && showFB) || 
                     (igChecked && !igAlreadyPublished && showIG) || 
                     (lnChecked && !lnAlreadyPublished && showLI);

  const selectedPlatforms: string[] = [];
  if (fbChecked && !fbAlreadyPublished && showFB) selectedPlatforms.push('facebook');
  if (igChecked && !igAlreadyPublished && showIG) selectedPlatforms.push('instagram');
  if (lnChecked && !lnAlreadyPublished && showLI) selectedPlatforms.push('linkedin');

  // Calculate grid columns based on visible platforms
  const visibleCount = [showFB, showIG, showLI].filter(Boolean).length;
  const gridClass = visibleCount === 1 ? 'md:grid-cols-1' : visibleCount === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';

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
          className="bg-[#0b0b10] w-full max-w-6xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col"
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-[#0b0b10] z-10">
            <h2 className="text-lg font-bold">Publish Post — "{post.title}"</h2>
            <button 
              onClick={onClose} 
              className="px-3 py-1 rounded bg-transparent hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>

          <div className={`grid grid-cols-1 ${gridClass} gap-4 p-6 overflow-y-auto`}>
            {/* FACEBOOK COLUMN */}
            {showFB && (
              <div className="bg-[#10101d] p-4 rounded-lg border border-gray-800 flex flex-col items-stretch">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">Facebook</h3>
                  <input 
                    type="checkbox" 
                    checked={fbChecked} 
                    onChange={(e) => !fbAlreadyPublished && setFbChecked(e.target.checked)}
                    disabled={fbAlreadyPublished}
                    className={fbAlreadyPublished ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                  />
                </div>
                {fbAlreadyPublished && <p className="text-xs text-green-500 mb-2">✓ Already published</p>}
                <div className="mb-3">
                  <img 
                    src={post.fb_image_link || post.image_url || ''} 
                    alt="fb" 
                    className="w-full aspect-square object-cover rounded" 
                    onError={(e:any)=>e.target.src='https://placehold.co/300x300/10101d/5ccfa2?text=No+Image'}
                  />
                </div>
                <div className="text-sm text-gray-300 flex-1 overflow-auto">
                  <p className="font-mono text-xs text-gray-400 mb-2">Post</p>
                  <div className="text-sm text-gray-200 whitespace-pre-wrap">{post.fb_caption || 'No Facebook caption available.'}</div>
                </div>
              </div>
            )}

            {/* INSTAGRAM COLUMN */}
            {showIG && (
              <div className="bg-[#10101d] p-4 rounded-lg border border-gray-800 flex flex-col items-stretch">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">Instagram</h3>
                  <input 
                    type="checkbox" 
                    checked={igChecked} 
                    onChange={(e) => !igAlreadyPublished && setIgChecked(e.target.checked)}
                    disabled={igAlreadyPublished}
                    className={igAlreadyPublished ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                  />
                </div>
                {igAlreadyPublished && <p className="text-xs text-green-500 mb-2">✓ Already published</p>}
                <div className="mb-3">
                  <img 
                    src={post.ig_image_link || post.image_url || ''} 
                    alt="ig" 
                    className="w-full aspect-square object-cover rounded" 
                    onError={(e:any)=>e.target.src='https://placehold.co/300x300/10101d/5ccfa2?text=No+Image'}
                  />
                </div>
                <div className="text-sm text-gray-300 flex-1 overflow-auto">
                  <p className="font-mono text-xs text-gray-400 mb-2">Post</p>
                  <div className="text-sm text-gray-200 whitespace-pre-wrap">{post.ig_caption || 'No Instagram caption available.'}</div>
                </div>
              </div>
            )}

            {/* LINKEDIN COLUMN */}
            {showLI && (
              <div className="bg-[#10101d] p-4 rounded-lg border border-gray-800 flex flex-col items-stretch">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">LinkedIn</h3>
                  <input 
                    type="checkbox" 
                    checked={lnChecked} 
                    onChange={(e) => !lnAlreadyPublished && setLnChecked(e.target.checked)}
                    disabled={lnAlreadyPublished}
                    className={lnAlreadyPublished ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                  />
                </div>
                {lnAlreadyPublished && <p className="text-xs text-green-500 mb-2">✓ Already published</p>}
                <div className="mb-3">
                  <img 
                    src={post.linkedin_image_link || post.image_url || ''} 
                    alt="li" 
                    className="w-full aspect-square object-cover rounded" 
                    onError={(e:any)=>e.target.src='https://placehold.co/300x300/10101d/5ccfa2?text=No+Image'}
                  />
                </div>
                <div className="text-sm text-gray-300 flex-1 overflow-auto">
                  <p className="font-mono text-xs text-gray-400 mb-2">Post</p>
                  <div className="text-sm text-gray-200 whitespace-pre-wrap">{post.linkedin_caption || 'No LinkedIn caption available.'}</div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-800 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              <span>Selected platforms: </span>
              <span className="font-mono text-gray-200">{selectedPlatforms.join(', ') || 'None (all already published)'}</span>
            </div>

            <div className="flex items-center space-x-3">
              <button 
                onClick={onClose} 
                className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!canPublish}
                onClick={() => onPublish(post.id, `${post.user_id}`, {
                  fb_publish: fbChecked && !fbAlreadyPublished && showFB,
                  ig_publish: igChecked && !igAlreadyPublished && showIG,
                  linkedin_publish: lnChecked && !lnAlreadyPublished && showLI,
                })}
                className={`px-4 py-2 rounded text-sm font-semibold transition-colors cursor-pointer ${canPublish ? 'bg-[#5ccfa2] text-black hover:bg-[#45a881]' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
              >
                Publish
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DashboardPage;