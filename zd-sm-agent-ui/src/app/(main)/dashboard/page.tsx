'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, RefreshCw, BookOpen, Send, CheckCircle, 
  XCircle, Filter, Eye, Trash2, MoreVertical, Grid3x3, 
  Play, X, Check, Image as ImageIcon, Video as VideoIcon,
  Edit, Save, MessageSquare, ChevronRight, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useUserSession } from '@/hooks/use-user-session';
import { FaFacebook, FaInstagram, FaLinkedin } from "react-icons/fa";

type Platform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'none';
type SourceType = 'social_post' | 'standalone_image' | 'video' | 'video_source';
type PostStatus = 'Draft' | 'Scheduled' | 'Published' | 'Failed' | 'In Progress';

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
  feedback_rating: number | null;
  feedback_comment: string | null;
  video_style: string | null;
  video_purpose: string | null;
  crossposted: boolean | null;
  fb_crosspost_id: string | null;
  fb_crosspost_url: string | null;
  ig_crosspost_id: string | null;
  ig_crosspost_url: string | null;
  li_crosspost_id: string | null;
  li_crosspost_url: string | null;
  tt_crosspost_id: string | null;
  tt_crosspost_url: string | null;
}

interface GroupedContent {
  contentGroupId: string;
  posts: DashboardPost[];
  primaryPost: DashboardPost;
  isCollapsed: boolean;
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

const VIDEO_STYLES = [
  { value: 'realism', label: 'Realism' },
  { value: 'anime', label: 'Anime' },
  { value: 'comic', label: 'Comic Book' },
  { value: '3d_animated', label: '3D Animated' },
  { value: 'cinematic', label: 'Cinematic' },
];

const VIDEO_PURPOSES = [
  { value: 'social_ad', label: 'Social Media Ad' },
  { value: 'product_demo', label: 'Product Demo' },
  { value: 'informative', label: 'Informative/Educational' },
  { value: 'promo', label: 'Promotional Video' },
  { value: 'tutorial', label: 'Tutorial/How-To' },
];

const getBadgeStyle = (sourceType: SourceType) => {
  switch (sourceType) {
    case 'social_post':
      return { color: 'bg-blue-700 text-white', icon: <Grid3x3 className="w-3 h-3 mr-1" />, label: 'Social Post' };
    case 'video_source':
      return { color: 'bg-orange-600 text-white', icon: <ImageIcon className="w-3 h-3 mr-1" />, label: 'Video Source' };
    case 'video':
      return { color: 'bg-purple-700 text-white', icon: <VideoIcon className="w-3 h-3 mr-1" />, label: 'Video' };
    case 'standalone_image':
      return { color: 'bg-orange-600 text-white', icon: <ImageIcon className="w-3 h-3 mr-1" />, label: 'Image' };
  }
};

const getSevenDaysAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().split('T')[0];
};

const getToday = () => new Date().toISOString().split('T')[0];

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
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
                         post.source_type === 'video' ||
                         post.source_type === 'video_source';
    
    if (isStandalone) {
      standalone.push(post);
    } else {
      const existing = groupMap.get(post.content_group_id!) || [];
      existing.push(post);
      groupMap.set(post.content_group_id!, existing);
    }
  });

  const grouped: GroupedContent[] = Array.from(groupMap.entries()).map(([contentGroupId, posts]) => {
    const primaryPost = posts.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    
    return {
      contentGroupId,
      posts: posts.sort((a, b) => {
        const order = { facebook: 0, instagram: 1, linkedin: 2, tiktok: 3, none: 4 };
        return order[a.platform] - order[b.platform];
      }),
      primaryPost,
      isCollapsed: true,
    };
  });

  // FILTER OUT single-item groups (they should be standalone)
  const filteredGrouped = grouped.filter(g => g.posts.length > 1);
  const singleItemGroups = grouped
    .filter(g => g.posts.length === 1)
    .map(g => g.primaryPost);
  
  // Add single-item groups to standalone
  const allStandalone = [...standalone, ...singleItemGroups];
  
  // Sort both arrays
  filteredGrouped.sort((a, b) => 
    new Date(b.primaryPost.created_at).getTime() - new Date(a.primaryPost.created_at).getTime()
  );
  
  allStandalone.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return { grouped: filteredGrouped, standalone: allStandalone };
};

const getPublishedPlatforms = (post: DashboardPost): Array<{ platform: Platform; url: string }> => {
  const platforms: Array<{ platform: Platform; url: string }> = [];
  
  if (post.platform_post_url && post.platform !== 'none') {
    platforms.push({ platform: post.platform, url: post.platform_post_url });
  }
  
  if (post.fb_crosspost_url) {
    platforms.push({ platform: 'facebook', url: post.fb_crosspost_url });
  }
  
  if (post.ig_crosspost_url) {
    platforms.push({ platform: 'instagram', url: post.ig_crosspost_url });
  }
  
  if (post.li_crosspost_url) {
    platforms.push({ platform: 'linkedin', url: post.li_crosspost_url });
  }
  
  if (post.tt_crosspost_url) {
    platforms.push({ platform: 'tiktok', url: post.tt_crosspost_url });
  }
  
  return platforms;
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
      let query = supabase
        .from('posts_v2')
        .select('*')
        .eq('user_id', userId)
        .eq('discard', false)
        .neq('status', 'In Progress');
        
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

      const { data: allPosts } = await supabase
        .from('posts_v2')
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
            <option value="all">All Types</option><option value="social_post">Social Posts</option><option value="video_source">Video Sources</option><option value="video">Videos</option>
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

// TAG INPUT COMPONENT (Press Enter to add, max 3)
const TagInput: React.FC<{
  tags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}> = ({ tags, onChange, maxTags = 3 }) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      if (tags.length < maxTags && !tags.includes(inputValue.trim())) {
        onChange([...tags, inputValue.trim()]);
        setInputValue('');
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, idx) => (
          <span key={idx} className="inline-flex items-center bg-[#5ccfa2] text-black text-xs px-3 py-1 rounded-full">
            {tag}
            <button onClick={() => removeTag(tag)} className="ml-2 hover:text-red-600">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length < maxTags ? "Type and press Enter to add tag..." : `Max ${maxTags} tags reached`}
        disabled={tags.length >= maxTags}
        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2] disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <p className="text-xs text-gray-500 mt-1">{tags.length}/{maxTags} tags used</p>
    </div>
  );
};


// FEEDBACK MODAL
const FeedbackModal: React.FC<{
  postId: string;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ postId, onClose, onSuccess }) => {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      alert('Please select a rating');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('posts_v2')
        .update({
          feedback_rating: rating,
          feedback_comment: comment.trim() || null
        })
        .eq('id', postId);

      if (error) throw error;

      alert('Thank you for your feedback!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[Feedback] Error:', error);
      alert(`Failed to submit feedback: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-[#0b0b10] w-full max-w-lg rounded-xl shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-bold text-white">Send Feedback</h2>
            <button onClick={onClose} className="p-2 rounded-lg bg-transparent hover:bg-gray-800 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Rating *</label>
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`text-3xl transition-colors ${rating >= star ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-200'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Comments (Optional)</label>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share your thoughts..." rows={4} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2] resize-none" />
            </div>
          </div>
          <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-800">
            <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors disabled:opacity-50">Cancel</button>
            <button onClick={handleSubmit} disabled={loading || rating === 0} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center ${loading || rating === 0 ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-[#5ccfa2] text-black hover:bg-[#45a881]'}`}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : 'Submit Feedback'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// CONVERT TO VIDEO MODAL (for video_source posts)
const ConvertToVideoModal: React.FC<{
  post: DashboardPost;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ post, onClose, onSuccess }) => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('realism');
  const [purpose, setPurpose] = useState('social_ad');
  const [orientation, setOrientation] = useState('9:16');
  const [duration, setDuration] = useState('5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/posts/convert-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePostId: post.id,
          prompt: prompt.trim(),
          style,
          purpose,
          orientation,
          duration,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to convert to video');

      alert('Your video is being generated! It will appear in the dashboard in 2-3 minutes.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[ConvertToVideo] Error:', err);
      setError(err.message || 'Failed to convert to video');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-[#0b0b10] w-full max-w-2xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-[#0b0b10] z-10">
            <h2 className="text-lg font-bold text-white">Convert to Video</h2>
            <button onClick={onClose} className="p-2 rounded-lg bg-transparent hover:bg-gray-800 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Source Image</label>
              <img src={post.image_url || ''} alt="Source" className="w-full max-w-md aspect-square object-cover rounded-lg mx-auto" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2">Style *</label>
                <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]">
                  {VIDEO_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2">Purpose *</label>
                <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]">
                  {VIDEO_PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Video Prompt *</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the motion/animation you want..." rows={4} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2] resize-none" />
              <p className="text-xs text-gray-500 mt-1">Example: "Camera slowly zooms in while gentle wind blows"</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2">Orientation</label>
                <select value={orientation} onChange={(e) => setOrientation(e.target.value)} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]">
                  <option value="9:16">9:16 (Vertical)</option>
                  <option value="16:9">16:9 (Horizontal)</option>
                  <option value="1:1">1:1 (Square)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2">Duration</label>
                <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]">
                  <option value="5">5 seconds</option>
                  <option value="10">10 seconds</option>
                  <option value="15">15 seconds</option>
                  <option value="30">30 seconds</option>
                </select>
              </div>
            </div>
            {error && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-800">
            <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors disabled:opacity-50">Cancel</button>
            <button onClick={handleSubmit} disabled={loading || !prompt.trim()} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center ${loading || !prompt.trim() ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Converting...</> : 'Convert to Video'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};


// PUBLISH MODAL with cross-post checkboxes
const PublishModal: React.FC<{
  post: DashboardPost;
  allGroupPlatforms: Platform[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ post, allGroupPlatforms, onClose, onSuccess }) => {
  const isVideo = post.source_type === 'video';
  const availableCrossPosts: Platform[] = (isVideo 
    ? (['facebook', 'instagram', 'linkedin', 'tiktok'] as Platform[]).filter(p => p !== post.platform)
    : (['facebook', 'instagram', 'linkedin'] as Platform[]).filter(p => p !== post.platform));

  const [crossPostPlatforms, setCrossPostPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleCrossPost = (platform: Platform) => {
    if (crossPostPlatforms.includes(platform)) {
      setCrossPostPlatforms(crossPostPlatforms.filter(p => p !== platform));
    } else {
      setCrossPostPlatforms([...crossPostPlatforms, platform]);
    }
  };

  const handlePublish = async () => {
    setLoading(true);
    try {
      const selectedPlatforms = [post.platform, ...crossPostPlatforms];
      
      const payload: any = { 
        ig_publish: null, 
        fb_publish: null, 
        li_publish: null, 
        tt_publish: null, 
        userId: post.user_id 
      };
      
      if (selectedPlatforms.includes('facebook')) payload.fb_publish = post.id;
      if (selectedPlatforms.includes('instagram')) payload.ig_publish = post.id;
      if (selectedPlatforms.includes('linkedin')) payload.li_publish = post.id;
      if (selectedPlatforms.includes('tiktok')) payload.tt_publish = post.id;

      const publishResponse = await fetch('/api/n8n/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!publishResponse.ok) throw new Error('Publishing failed');
      
      alert(`Successfully published to ${selectedPlatforms.length} platform${selectedPlatforms.length > 1 ? 's' : ''}!`);
      onSuccess();
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
            <h2 className="text-lg font-bold text-white">Publish {PLATFORM_NAMES[post.platform]} Content</h2>
            <button onClick={onClose} className="p-2 rounded-lg bg-transparent hover:bg-gray-800 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="p-6 space-y-6">
           <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Post to:</h3>
              <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${post.platform_post_url ? 'border-green-600 bg-green-600/10 opacity-60' : 'border-[#5ccfa2] bg-[#5ccfa2]/10'}`}>
                <div className="flex items-center space-x-3">
                  {PLATFORM_ICONS[post.platform]}
                  <span className="text-white font-semibold">{PLATFORM_NAMES[post.platform]}</span>
                  <span className="text-xs text-gray-400">
                    {post.platform_post_url ? '(Already published)' : '(Original platform)'}
                  </span>
                </div>
                <Check className="w-5 h-5 text-[#5ccfa2]" />
              </div>
            </div>

            {availableCrossPosts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Cross-post to:</h3>
                <div className="space-y-3">
                 {availableCrossPosts.map(platform => {
                    const alreadyPublished = 
                      (platform === 'facebook' && post.fb_crosspost_url) ||
                      (platform === 'instagram' && post.ig_crosspost_url) ||
                      (platform === 'linkedin' && post.li_crosspost_url) ||
                      (platform === 'tiktok' && post.tt_crosspost_url);
                    const isSelected = crossPostPlatforms.includes(platform);
                    
                    if (alreadyPublished) {
                      return (
                        <div key={platform} className="w-full flex items-center justify-between p-4 rounded-lg border-2 border-green-600 bg-green-600/10 opacity-60">
                          <div className="flex items-center space-x-3">
                            <div className="text-green-400">{PLATFORM_ICONS[platform]}</div>
                            <span className="text-white font-semibold">{PLATFORM_NAMES[platform]}</span>
                            <span className="text-xs text-gray-400">(Already published)</span>
                          </div>
                          <Check className="w-5 h-5 text-green-400" />
                        </div>
                      );
                    }
                    
                    return (
                      <button key={platform} onClick={() => toggleCrossPost(platform)} className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${isSelected ? 'border-[#5ccfa2] bg-[#5ccfa2]/10' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}>
                        <div className="flex items-center space-x-3">
                          <div className={isSelected ? 'text-[#5ccfa2]' : 'text-gray-400'}>{PLATFORM_ICONS[platform]}</div>
                          <span className={isSelected ? 'text-white font-semibold' : 'text-gray-300'}>{PLATFORM_NAMES[platform]}</span>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-[#5ccfa2]" />}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  ⚠️ Cross-posting will use {PLATFORM_NAMES[post.platform]}'s image and caption
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-800">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors">Cancel</button>
            <button onClick={handlePublish} disabled={loading} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${loading ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-[#5ccfa2] text-black hover:bg-[#45a881]'}`}>
              {loading ? <span className="flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publishing...</span> : `Publish to ${1 + crossPostPlatforms.length} Platform${1 + crossPostPlatforms.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};


// VIEW DETAILS MODAL with multi-tab navigation for grouped content
const ViewDetailsModal: React.FC<{
  posts: DashboardPost[];
  initialPostId?: string;
  onClose: () => void;
  onUpdate: () => void;
}> = ({ posts, initialPostId, onClose, onUpdate }) => {
  const [currentIndex, setCurrentIndex] = useState(
    initialPostId ? posts.findIndex(p => p.id === initialPostId) : 0
  );
  const currentPost = posts[currentIndex];
  
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [editedCaption, setEditedCaption] = useState(currentPost.caption || '');
  const [category, setCategory] = useState(currentPost.category || '');
  const [tags, setTags] = useState<string[]>(currentPost.tags || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditedCaption(currentPost.caption || '');
    setCategory(currentPost.category || '');
    setTags(currentPost.tags || []);
    setIsEditingCaption(false);
  }, [currentIndex, currentPost]);

  const handleSaveCaption = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('posts_v2')
        .update({ caption: editedCaption.trim() })
        .eq('id', currentPost.id);

      if (error) throw error;

      setIsEditingCaption(false);
      onUpdate();
      alert('Caption saved successfully!');
    } catch (error: any) {
      console.error('[SaveCaption] Error:', error);
      alert(`Failed to save caption: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCategory = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('posts_v2')
        .update({ category: category || null })
        .eq('id', currentPost.id);

      if (error) throw error;

      onUpdate();
      alert('Category saved successfully!');
    } catch (error: any) {
      console.error('[SaveCategory] Error:', error);
      alert(`Failed to save category: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTags = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('posts_v2')
        .update({ tags: tags.length > 0 ? tags : null })
        .eq('id', currentPost.id);

      if (error) throw error;

      onUpdate();
      alert('Tags saved successfully!');
    } catch (error: any) {
      console.error('[SaveTags] Error:', error);
      alert(`Failed to save tags: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const publishedPlatforms = getPublishedPlatforms(currentPost);

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-[#0b0b10] w-full max-w-4xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-[#0b0b10] z-10">
            <h2 className="text-lg font-bold text-white">View Content Details</h2>
            <button onClick={onClose} className="p-2 rounded-lg bg-transparent hover:bg-gray-800 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          
          {posts.length > 1 && (
            <div className="flex items-center space-x-2 p-4 border-b border-gray-800 overflow-x-auto">
              {posts.map((post, idx) => (
                <button key={post.id} onClick={() => setCurrentIndex(idx)} className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${currentIndex === idx ? 'bg-[#5ccfa2] text-black' : 'bg-gray-800 text-white hover:bg-gray-700'}`}>
                  {PLATFORM_ICONS[post.platform]}
                  <span>{PLATFORM_NAMES[post.platform]}</span>
                </button>
              ))}
            </div>
          )}
          
          <div className="p-6">
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
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-400">Caption</h3>
                    {!currentPost.published && !isEditingCaption && (
                      <button onClick={() => setIsEditingCaption(true)} className="text-xs text-[#5ccfa2] hover:text-[#45a881] flex items-center"><Edit className="w-3 h-3 mr-1" />Edit</button>
                    )}
                  </div>
                  {isEditingCaption ? (
                    <div className="space-y-2">
                      <textarea value={editedCaption} onChange={(e) => setEditedCaption(e.target.value)} rows={6} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2] resize-none" />
                      <div className="flex space-x-2">
                        <button onClick={handleSaveCaption} disabled={saving} className="flex-1 px-3 py-1.5 bg-[#5ccfa2] hover:bg-[#45a881] text-black text-xs rounded-lg font-semibold transition-colors flex items-center justify-center disabled:opacity-50">
                          {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                          Save
                        </button>
                        <button onClick={() => { setEditedCaption(currentPost.caption || ''); setIsEditingCaption(false); }} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-white whitespace-pre-wrap">{currentPost.caption || 'No caption'}</p>
                  )}
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-400">Category</h3>
                  </div>
                  <div className="flex space-x-2">
                    <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Enter category..." className="flex-1 bg-[#010112] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]" />
                    <button onClick={handleSaveCategory} disabled={saving || category === currentPost.category} className="px-4 py-2 bg-[#5ccfa2] hover:bg-[#45a881] text-black text-xs rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </button>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-400">Tags (Max 3)</h3>
                  </div>
                  <TagInput tags={tags} onChange={setTags} maxTags={3} />
                  <button onClick={handleSaveTags} disabled={saving || JSON.stringify(tags) === JSON.stringify(currentPost.tags || [])} className="mt-2 w-full px-4 py-2 bg-[#5ccfa2] hover:bg-[#45a881] text-black text-xs rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Saving...</> : 'Save Tags'}
                  </button>
                </div>
                
                {currentPost.source_type === 'video' && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Video Info</h3>
                    <div className="space-y-1 text-sm text-white">
                      <p>Orientation: {currentPost.orientation}</p>
                      <p>Duration: {currentPost.duration}s</p>
                      {currentPost.video_style && <p>Style: {VIDEO_STYLES.find(s => s.value === currentPost.video_style)?.label}</p>}
                      {currentPost.video_purpose && <p>Purpose: {VIDEO_PURPOSES.find(p => p.value === currentPost.video_purpose)?.label}</p>}
                    </div>
                  </div>
                )}
                
                {publishedPlatforms.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Published To</h3>
                    <div className="space-y-2">
                      {publishedPlatforms.map(({ platform, url }) => (
                        <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 text-[#5ccfa2] hover:text-[#45a881] transition-colors">
                          {PLATFORM_ICONS[platform]}
                          <span className="text-sm">View on {PLATFORM_NAMES[platform]}</span>
                        </a>
                      ))}
                    </div>
                    {currentPost.published_at && (
                      <p className="text-xs text-gray-500 mt-2">Published {formatDate(currentPost.published_at)}</p>
                    )}
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


// SINGLE CARD COMPONENT (350px width, new design)
const SingleCard: React.FC<{
  post: DashboardPost;
  allGroupPlatforms: Platform[];
  onView: (post: DashboardPost) => void;
  onPublish: (post: DashboardPost) => void;
  onConvertToVideo?: (post: DashboardPost) => void;
  onDelete: (postId: string) => void;
  onFeedback: (postId: string) => void;
}> = ({ post, allGroupPlatforms, onView, onPublish, onConvertToVideo, onDelete, onFeedback }) => {
  const [showMenu, setShowMenu] = useState(false);
  const badge = getBadgeStyle(post.source_type);
  const isVideo = post.source_type === 'video';
  const isVideoSource = post.source_type === 'video_source';
  const mediaUrl = isVideo ? (post.video_thumbnail_url || post.video_url) : post.image_url;
  const publishedPlatforms = getPublishedPlatforms(post);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }}
      layout
      className="bg-[#10101d] rounded-xl shadow-lg border border-gray-800 flex flex-col overflow-hidden"
      style={{ width: '350px' }}
    >
      {/* Image Section - Square */}
      <div className="relative w-full aspect-square overflow-hidden">
        <img 
          src={mediaUrl || 'https://placehold.co/350x350/10101d/5ccfa2?text=No+Image'} 
          alt={PLATFORM_NAMES[post.platform]} 
          className="w-full h-full object-cover" 
        />
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="w-16 h-16 text-white/80" />
          </div>
        )}
        
        {/* Badge - Top Right Only */}
        <div className="absolute top-3 right-3">
          <div className={`flex items-center px-3 py-1 text-xs rounded-full font-semibold ${badge.color}`}>
            {badge.icon}
            {badge.label}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 flex flex-col space-y-3">
        {/* Platform Name (No Icon) */}
        <h4 className="text-base font-mono text-white font-semibold">
          {post.platform !== 'none' ? PLATFORM_NAMES[post.platform] : badge.label}
        </h4>
        
        {/* View/Edit Link */}
        <button 
          onClick={() => onView(post)} 
          className="text-sm text-[#5ccfa2] hover:text-[#45a881] transition-colors text-left"
        >
          Click to view/edit caption & details
        </button>
        
        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => onView(post)} 
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors flex items-center justify-center"
          >
            <Eye className="w-4 h-4 mr-2" />
            View
          </button>
          
         {isVideoSource && onConvertToVideo ? (
            <button 
              onClick={() => onConvertToVideo(post)} 
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg font-semibold transition-colors flex items-center justify-center"
            >
              <VideoIcon className="w-4 h-4 mr-2" />
              Convert
            </button>
          ) : (() => {
              const maxPlatforms = isVideo ? 4 : 3;
              const canPublishMore = publishedPlatforms.length < maxPlatforms;
              return canPublishMore ? (
                <button 
                  onClick={() => onPublish(post)} 
                  className="flex-1 px-4 py-2 bg-[#5ccfa2] hover:bg-[#45a881] text-black text-sm rounded-lg font-semibold transition-colors flex items-center justify-center"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {post.published ? 'Publish +' : 'Publish'}
                </button>
              ) : null;
            })()}
          
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)} 
              className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 bottom-full mb-2 w-40 bg-[#10101d] border border-gray-700 rounded-lg shadow-lg z-20">
                <button 
                  onClick={() => { onFeedback(post.id); setShowMenu(false); }} 
                  className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-800 flex items-center text-sm rounded-t-lg"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Feedback
                </button>
                <button 
                  onClick={() => { onDelete(post.id); setShowMenu(false); }} 
                  className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-800 flex items-center text-sm rounded-b-lg"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Status Bar - NEW */}
        <div className="border-t border-gray-700 pt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Status: <span className={post.published ? 'text-green-400' : 'text-yellow-400'}>{post.published ? 'Published' : 'Draft'}</span>
          </span>
          {publishedPlatforms.length > 0 && (
            <div className="flex items-center space-x-1">
              {publishedPlatforms.map(({ platform, url }) => (
                <a 
                  key={platform} 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                  title={`View on ${PLATFORM_NAMES[platform]}`}
                >
                  {PLATFORM_ICONS[platform]}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// GROUPED CARDS CONTAINER
const GroupedCards: React.FC<{
  group: GroupedContent;
  isCollapsed: boolean;
  onToggle: () => void;
  onView: (post: DashboardPost) => void;
  onPublish: (post: DashboardPost) => void;
  onDelete: (postId: string) => void;
  onFeedback: (postId: string) => void;
}> = ({ group, isCollapsed, onToggle, onView, onPublish, onDelete, onFeedback }) => {
  const allPlatforms = group.posts.map(p => p.platform);

  if (isCollapsed) {
    return (
      <div className="relative" style={{ width: '350px' }}>
        <SingleCard 
          post={group.primaryPost} 
          allGroupPlatforms={allPlatforms}
          onView={onView} 
          onPublish={onPublish} 
          onDelete={onDelete} 
          onFeedback={onFeedback} 
        />
        
        <button 
          onClick={onToggle}
          className="absolute -top-2 -right-2 bg-[#5ccfa2] hover:bg-[#45a881] text-black text-xs font-semibold px-3 py-1 rounded-full shadow-lg transition-all flex items-center z-10"
        >
          <span className="underline mr-1">Expand ({group.posts.length})</span>
          <ChevronRight className="w-3 h-3" />
        </button>

        {/* Visual depth - cards behind */}
        <div className="absolute -bottom-1 -right-1 w-full h-full bg-gray-800/30 rounded-xl -z-10"></div>
        <div className="absolute -bottom-2 -right-2 w-full h-full bg-gray-800/15 rounded-xl -z-20"></div>
        
        {/* Platform count tag */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-1 rounded-full shadow-lg whitespace-nowrap z-10">
          {group.posts.length} platform{group.posts.length > 1 ? 's' : ''}
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      layout
      className="relative border-2 border-[#5ccfa2]/40 rounded-xl p-4 bg-[#5ccfa2]/5"
      style={{ width: `${350 * group.posts.length + (group.posts.length - 1) * 16 + 32}px` }}
    >
      <button 
        onClick={onToggle}
        className="absolute -top-2 right-4 bg-[#5ccfa2] hover:bg-[#45a881] text-black text-xs font-semibold px-3 py-1 rounded-full shadow-lg transition-all flex items-center z-10"
      >
        <span className="underline mr-1">Collapse</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      <div className="flex space-x-4">
        {group.posts.map(post => (
          <SingleCard 
            key={post.id}
            post={post} 
            allGroupPlatforms={allPlatforms}
            onView={onView} 
            onPublish={onPublish} 
            onDelete={onDelete} 
            onFeedback={onFeedback} 
          />
        ))}
      </div>
    </motion.div>
  );
};


// MAIN DASHBOARD PAGE
const DashboardPage = () => {
  const router = useRouter();
  const { user, loading: sessionLoading } = useUserSession();
  const userId = user?.id;

  const [filters, setFilters] = useState<FilterState>({
    sourceType: 'all',
    platform: 'all',
    status: 'all',
    category: 'all',
    fromDate: getSevenDaysAgo(),
    toDate: getToday(),
  });

  const { stats, posts, loading, error, refetch } = useDashboardData(userId, filters);
  
  const [groupedContent, setGroupedContent] = useState<GroupedContent[]>([]);
  const [standaloneContent, setStandaloneContent] = useState<DashboardPost[]>([]);

  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [convertToVideoOpen, setConvertToVideoOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState<DashboardPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<DashboardPost | null>(null);
  const [feedbackPostId, setFeedbackPostId] = useState<string | null>(null);

  useEffect(() => {
    const { grouped, standalone } = groupPostsByContentGroup(posts);
    setGroupedContent(grouped);
    setStandaloneContent(standalone);
  }, [posts]);

  const toggleGroupCollapse = (groupId: string) => {
    setGroupedContent(prev => prev.map(g => 
      g.contentGroupId === groupId ? { ...g, isCollapsed: !g.isCollapsed } : g
    ));
  };

  const handleView = (post: DashboardPost) => {
    const group = groupedContent.find(g => g.posts.some(p => p.id === post.id));
    if (group) {
      setSelectedPosts(group.posts);
    } else {
      setSelectedPosts([post]);
    }
    setViewDetailsOpen(true);
  };

  const handlePublish = (post: DashboardPost) => {
    setSelectedPost(post);
    setPublishModalOpen(true);
  };

  const handleConvertToVideo = (post: DashboardPost) => {
    setSelectedPost(post);
    setConvertToVideoOpen(true);
  };

  const handleFeedback = (postId: string) => {
    setFeedbackPostId(postId);
    setFeedbackModalOpen(true);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this content?')) return;

    try {
      const { error } = await supabase.from('posts_v2').update({ discard: true }).eq('id', postId);
      if (error) throw error;
      refetch();
    } catch (error) {
      console.error('[Dashboard] Delete error:', error);
      alert('Failed to delete content');
    }
  };

  const allContentItems = useMemo(() => {
    const items: Array<{ type: 'group' | 'standalone'; data: GroupedContent | DashboardPost; date: Date }> = [];
    
    groupedContent.forEach(group => {
      items.push({ 
        type: 'group', 
        data: group, 
        date: new Date(group.primaryPost.created_at) 
      });
    });
    
    standaloneContent.forEach(post => {
      items.push({ 
        type: 'standalone', 
        data: post, 
        date: new Date(post.created_at) 
      });
    });
    
    // Sort by date (newest first)
    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    return items;
  }, [groupedContent, standaloneContent]);

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
        {allContentItems.length === 0 ? (
          <div className="bg-[#10101d] p-12 rounded-xl border border-gray-800 text-center">
            <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h4 className="text-xl font-mono text-gray-400 mb-2">No Content Found</h4>
            <p className="text-gray-500">Start creating content in the Content Studio</p>
          </div>
        ) : (
          <motion.div 
            layout
            className="flex flex-wrap gap-6"
          >
            {allContentItems.map((item, index) => (
              <motion.div key={index} layout>
                {item.type === 'group' ? (
                  <GroupedCards
                    group={item.data as GroupedContent}
                    isCollapsed={(item.data as GroupedContent).isCollapsed}
                    onToggle={() => toggleGroupCollapse((item.data as GroupedContent).contentGroupId)}
                    onView={handleView}
                    onPublish={handlePublish}
                    onDelete={handleDelete}
                    onFeedback={handleFeedback}
                  />
                ) : (
                  <SingleCard
                    post={item.data as DashboardPost}
                    allGroupPlatforms={[]}
                    onView={handleView}
                    onPublish={handlePublish}
                    onConvertToVideo={(item.data as DashboardPost).source_type === 'video_source' ? handleConvertToVideo : undefined}
                    onDelete={handleDelete}
                    onFeedback={handleFeedback}
                  />
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {viewDetailsOpen && selectedPosts.length > 0 && (
        <ViewDetailsModal 
          posts={selectedPosts}
          onClose={() => { setViewDetailsOpen(false); setSelectedPosts([]); }} 
          onUpdate={refetch} 
        />
      )}

      {publishModalOpen && selectedPost && (
        <PublishModal 
          post={selectedPost}
          allGroupPlatforms={groupedContent.find(g => g.posts.some(p => p.id === selectedPost.id))?.posts.map(p => p.platform) || []}
          onClose={() => { setPublishModalOpen(false); setSelectedPost(null); }} 
          onSuccess={refetch} 
        />
      )}

      {convertToVideoOpen && selectedPost && (
        <ConvertToVideoModal 
          post={selectedPost}
          onClose={() => { setConvertToVideoOpen(false); setSelectedPost(null); }} 
          onSuccess={refetch} 
        />
      )}

      {feedbackModalOpen && feedbackPostId && (
        <FeedbackModal 
          postId={feedbackPostId} 
          onClose={() => { setFeedbackModalOpen(false); setFeedbackPostId(null); }} 
          onSuccess={refetch} 
        />
      )}
    </div>
  );
};

export default DashboardPage;