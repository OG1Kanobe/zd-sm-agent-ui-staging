'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, RefreshCw, BookOpen, Send, CheckCircle, 
  XCircle, Filter, Eye, Trash2, MoreVertical, Grid3x3, 
  Play, X, Check, Image as ImageIcon, Video as VideoIcon, 
  Repeat, Link2, Edit, Save, MessageSquare, ChevronRight, ChevronDown
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
  feedback: boolean;
  feedback_comments: string | null;
  published_image_url: string | null;
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
      isCollapsed: false,
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


// MODALS

const FeedbackModal: React.FC<{
  postId: string;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ postId, onClose, onSuccess }) => {
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      alert('Please enter your feedback');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('posts')
        .update({
          feedback: true,
          feedback_comments: feedback.trim()
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
          <div className="p-6">
            <p className="text-sm text-gray-400 mb-4">Help us improve! Share your thoughts about this content.</p>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Enter your feedback..." rows={6} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2] resize-none" />
          </div>
          <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-800">
            <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors disabled:opacity-50">Cancel</button>
            <button onClick={handleSubmit} disabled={loading || !feedback.trim()} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center ${loading || !feedback.trim() ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-[#5ccfa2] text-black hover:bg-[#45a881]'}`}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : 'Submit Feedback'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const PublishModal: React.FC<{
  post: DashboardPost;
  allPlatforms: Platform[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ post, allPlatforms, onClose, onSuccess }) => {
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
      // Check if cross-post rows need to be created
      const selectedPlatforms = [post.platform, ...crossPostPlatforms];
      const newPlatforms = crossPostPlatforms.filter(p => !allPlatforms.includes(p));

      let allPostIds = [post.id];

      if (newPlatforms.length > 0) {
        const response = await fetch('/api/posts/create-cross-post-rows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourcePostId: post.id, platforms: newPlatforms }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        allPostIds = [...allPostIds, ...data.newPosts.map((p: any) => p.id)];
      }

      // Build n8n payload
      const payload: any = { ig_publish: null, fb_publish: null, li_publish: null, tt_publish: null, userId: post.user_id };
      
      if (selectedPlatforms.includes('facebook')) {
        const fbPost = post.platform === 'facebook' ? post.id : allPostIds.find(id => id !== post.id);
        payload.fb_publish = fbPost || null;
      }
      if (selectedPlatforms.includes('instagram')) {
        const igPost = post.platform === 'instagram' ? post.id : allPostIds.find(id => id !== post.id);
        payload.ig_publish = igPost || null;
      }
      if (selectedPlatforms.includes('linkedin')) {
        const liPost = post.platform === 'linkedin' ? post.id : allPostIds.find(id => id !== post.id);
        payload.li_publish = liPost || null;
      }
      if (selectedPlatforms.includes('tiktok')) {
        const ttPost = post.platform === 'tiktok' ? post.id : allPostIds.find(id => id !== post.id);
        payload.tt_publish = ttPost || null;
      }

      const publishResponse = await fetch('/api/n8n/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!publishResponse.ok) throw new Error('Publishing failed');
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
              <div className={`flex items-center justify-between p-4 rounded-lg border-2 border-[#5ccfa2] bg-[#5ccfa2]/10`}>
                <div className="flex items-center space-x-3">
                  {PLATFORM_ICONS[post.platform]}
                  <span className="text-white font-semibold">{PLATFORM_NAMES[post.platform]}</span>
                  <span className="text-xs text-gray-400">(Original platform)</span>
                </div>
                <Check className="w-5 h-5 text-[#5ccfa2]" />
              </div>
            </div>

            {availableCrossPosts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Cross-post to:</h3>
                <div className="space-y-3">
                  {availableCrossPosts.map(platform => {
                    const isSelected = crossPostPlatforms.includes(platform);
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

const ViewDetailsModal: React.FC<{
  post: DashboardPost;
  onClose: () => void;
  onUpdate: () => void;
}> = ({ post, onClose, onUpdate }) => {
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [editedCaption, setEditedCaption] = useState(post.caption || '');
  const [category, setCategory] = useState(post.category || '');
  const [saving, setSaving] = useState(false);

  const handleSaveCaption = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({ caption: editedCaption.trim() })
        .eq('id', post.id);

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
        .from('posts')
        .update({ category: category || null })
        .eq('id', post.id);

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

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-[#0b0b10] w-full max-w-4xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-[#0b0b10] z-10">
            <h2 className="text-lg font-bold text-white">View {PLATFORM_NAMES[post.platform]} Details</h2>
            <button onClick={onClose} className="p-2 rounded-lg bg-transparent hover:bg-gray-800 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                {post.source_type === 'video' ? (
                  <div className="relative">
                    <img src={post.video_thumbnail_url || 'https://placehold.co/400x400/10101d/5ccfa2?text=Video'} alt="Video thumbnail" className="w-full aspect-square object-cover rounded-lg" />
                    <div className="absolute inset-0 flex items-center justify-center"><Play className="w-16 h-16 text-white/80" /></div>
                  </div>
                ) : (
                  <img src={post.image_url || 'https://placehold.co/400x400/10101d/5ccfa2?text=No+Image'} alt={PLATFORM_NAMES[post.platform]} className="w-full aspect-square object-cover rounded-lg" />
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-400">Caption</h3>
                    {!post.published && !isEditingCaption && (
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
                        <button onClick={() => { setEditedCaption(post.caption || ''); setIsEditingCaption(false); }} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-white whitespace-pre-wrap">{post.caption || 'No caption'}</p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-400">Category</h3>
                  </div>
                  <div className="flex space-x-2">
                    <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Enter category..." className="flex-1 bg-[#010112] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]" />
                    <button onClick={handleSaveCategory} disabled={saving || category === post.category} className="px-4 py-2 bg-[#5ccfa2] hover:bg-[#45a881] text-black text-xs rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </button>
                  </div>
                </div>
                {post.tags && post.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {post.tags.map((tag, idx) => (
                        <span key={idx} className="inline-block bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                {post.published && post.platform_post_url && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Published</h3>
                    <a href={post.platform_post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-[#5ccfa2] hover:text-[#45a881] transition-colors">{PLATFORM_ICONS[post.platform]}<span className="ml-2">View on {PLATFORM_NAMES[post.platform]}</span></a>
                    <p className="text-xs text-gray-500 mt-2">Published {formatDate(post.published_at!)}</p>
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


// INDIVIDUAL SOCIAL POST CARD

const SocialPostCard: React.FC<{
  post: DashboardPost;
  allPlatforms: Platform[];
  onView: (post: DashboardPost) => void;
  onPublish: (post: DashboardPost) => void;
  onDelete: (postId: string) => void;
  onFeedback: (postId: string) => void;
}> = ({ post, allPlatforms, onView, onPublish, onDelete, onFeedback }) => {
  const [showMenu, setShowMenu] = useState(false);
  const badge = getBadgeStyle(post.source_type);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#10101d] rounded-xl shadow-lg border border-gray-800 flex flex-col" style={{ aspectRatio: '4/5', minWidth: '280px' }}>
      <div className="h-3/5 relative overflow-hidden rounded-t-xl">
        <img src={post.image_url || 'https://placehold.co/400x500/10101d/5ccfa2?text=No+Image'} alt={PLATFORM_NAMES[post.platform]} className="w-full h-full object-cover" />
        <div className="absolute top-3 right-3">
          <div className={`flex items-center px-3 py-1 text-xs rounded-full font-semibold ${badge.color}`}>{badge.icon}{badge.label}</div>
        </div>
        {post.category && post.category !== 'none' && (
          <div className="absolute top-3 left-3">
            <span className="bg-[#5ccfa2] text-black text-xs font-semibold px-3 py-1 rounded-full">{post.category}</span>
          </div>
        )}
        {post.published && (
          <div className="absolute bottom-3 right-3">
            <div className="bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center">
              <CheckCircle className="w-3 h-3 mr-1" />Published
            </div>
          </div>
        )}
      </div>
      <div className="h-2/5 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-mono text-white font-semibold flex items-center">
              {PLATFORM_ICONS[post.platform]}
              <span className="ml-2">{PLATFORM_NAMES[post.platform]}</span>
            </h4>
          </div>
          <button onClick={() => onView(post)} className="text-xs text-[#5ccfa2] hover:text-[#45a881] transition-colors mb-1 text-left">
            Click to view/edit details
          </button>
          {post.published && post.platform_post_url && (
            <a href={post.platform_post_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-[#5ccfa2] transition-colors block">
              View on {PLATFORM_NAMES[post.platform]} →
            </a>
          )}
        </div>
        <div className="flex items-center space-x-2 mt-2">
          <button onClick={() => onView(post)} className="flex-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors flex items-center justify-center">
            <Eye className="w-3 h-3 mr-1" />View
          </button>
          {!post.published && (
            <button onClick={() => onPublish(post)} className="flex-1 px-3 py-1.5 bg-[#5ccfa2] hover:bg-[#45a881] text-black text-xs rounded-lg font-semibold transition-colors flex items-center justify-center">
              <Send className="w-3 h-3 mr-1" />Publish
            </button>
          )}
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 bottom-full mb-2 w-40 bg-[#10101d] border border-gray-700 rounded-lg shadow-lg z-20">
                <button onClick={() => { onFeedback(post.id); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-800 flex items-center text-sm rounded-t-lg">
                  <MessageSquare className="w-4 h-4 mr-2" />Send Feedback
                </button>
                <button onClick={() => { onDelete(post.id); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-800 flex items-center text-sm rounded-b-lg">
                  <Trash2 className="w-4 h-4 mr-2" />Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// GROUPED CONTENT CONTAINER with collapse/expand

const GroupedContentContainer: React.FC<{
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
    // COLLAPSED STATE: Stacked cards
    return (
      <div className="relative" style={{ width: '280px' }}>
        {/* Stack effect - show 3 layers */}
        <div className="absolute top-2 left-2 right-2 h-full bg-[#10101d] rounded-xl border border-gray-700 opacity-30"></div>
        <div className="absolute top-1 left-1 right-1 h-full bg-[#10101d] rounded-xl border border-gray-700 opacity-60"></div>
        
        {/* Primary card */}
        <div className="relative">
          <SocialPostCard 
            post={group.primaryPost} 
            allPlatforms={allPlatforms}
            onView={onView} 
            onPublish={onPublish} 
            onDelete={onDelete} 
            onFeedback={onFeedback} 
          />
          
          {/* Expand button */}
          <button 
            onClick={onToggle}
            className="absolute -top-3 right-3 bg-[#5ccfa2] hover:bg-[#45a881] text-black text-xs font-semibold px-3 py-1 rounded-full shadow-lg transition-all flex items-center"
          >
            <ChevronRight className="w-3 h-3 mr-1" />
            Expand ({group.posts.length})
          </button>
        </div>

        {/* Count indicator */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-1 rounded-full shadow-lg">
          {group.posts.length} platforms
        </div>
      </div>
    );
  }

  // EXPANDED STATE: Side by side with border
  return (
    <div className="border-2 border-[#5ccfa2]/30 rounded-xl p-4 bg-[#5ccfa2]/5 relative">
      {/* Collapse button */}
      <button 
        onClick={onToggle}
        className="absolute -top-3 right-4 bg-[#5ccfa2] hover:bg-[#45a881] text-black text-xs font-semibold px-3 py-1 rounded-full shadow-lg transition-all flex items-center z-10"
      >
        <ChevronDown className="w-3 h-3 mr-1" />
        Collapse
      </button>

      {/* Cards side by side */}
      <div className="flex space-x-4 overflow-x-auto pb-2">
        {group.posts.map(post => (
          <SocialPostCard 
            key={post.id}
            post={post} 
            allPlatforms={allPlatforms}
            onView={onView} 
            onPublish={onPublish} 
            onDelete={onDelete} 
            onFeedback={onFeedback} 
          />
        ))}
      </div>
    </div>
  );
};

// STANDALONE CARDS (Image and Video)

const StandaloneCard: React.FC<{
  post: DashboardPost;
  onView: (post: DashboardPost) => void;
  onDelete: (postId: string) => void;
  onFeedback: (postId: string) => void;
}> = ({ post, onView, onDelete, onFeedback }) => {
  const [showMenu, setShowMenu] = useState(false);
  const isVideo = post.source_type === 'video';
  const badge = getBadgeStyle(post.source_type);
  const mediaUrl = isVideo ? (post.video_thumbnail_url || post.video_url) : post.image_url;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#10101d] rounded-xl shadow-lg border border-gray-800 flex flex-col" style={{ aspectRatio: '4/5', width: '280px' }}>
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
          <h4 className="text-sm font-mono text-white font-semibold mb-1">{isVideo ? 'Video' : 'Standalone Image'}</h4>
          <button onClick={() => onView(post)} className="text-xs text-[#5ccfa2] hover:text-[#45a881] transition-colors mb-1 text-left">
            Click to view details
          </button>
          {isVideo && post.orientation && <p className="text-xs text-gray-500">{post.orientation} • {post.duration}s</p>}
        </div>
        <div className="flex items-center space-x-2 mt-2">
          <button onClick={() => onView(post)} className="flex-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors flex items-center justify-center">
            <Eye className="w-3 h-3 mr-1" />View
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 bottom-full mb-2 w-40 bg-[#10101d] border border-gray-700 rounded-lg shadow-lg z-20">
                <button onClick={() => { onFeedback(post.id); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-800 flex items-center text-sm rounded-t-lg">
                  <MessageSquare className="w-4 h-4 mr-2" />Send Feedback
                </button>
                <button onClick={() => { onDelete(post.id); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-800 flex items-center text-sm rounded-b-lg">
                  <Trash2 className="w-4 h-4 mr-2" />Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};


// MAIN DASHBOARD PAGE

const DashboardAltPage = () => {
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
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
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
    setSelectedPost(post);
    setViewDetailsOpen(true);
  };

  const handlePublish = (post: DashboardPost) => {
    setSelectedPost(post);
    setPublishModalOpen(true);
  };

  const handleFeedback = (postId: string) => {
    setFeedbackPostId(postId);
    setFeedbackModalOpen(true);
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
        <h2 className="text-3xl font-mono text-white">Dashboard (Alternative View)</h2>
        <button onClick={refetch} className="p-2 rounded-full text-gray-400 hover:text-[#5ccfa2] transition-colors">
          <RefreshCw className="w-6 h-6" />
        </button>
      </div>

      <SimpleStatCards stats={stats} />
      <FilterBar filters={filters} onFiltersChange={setFilters} />

      <div>
        <h3 className="text-2xl font-mono text-white mb-6">Your Content</h3>
        {groupedContent.length === 0 && standaloneContent.length === 0 ? (
          <div className="bg-[#10101d] p-12 rounded-xl border border-gray-800 text-center">
            <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h4 className="text-xl font-mono text-gray-400 mb-2">No Content Found</h4>
            <p className="text-gray-500">Start creating content in the Content Studio</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Grouped Content */}
            {groupedContent.map(group => (
              <GroupedContentContainer
                key={group.contentGroupId}
                group={group}
                isCollapsed={group.isCollapsed}
                onToggle={() => toggleGroupCollapse(group.contentGroupId)}
                onView={handleView}
                onPublish={handlePublish}
                onDelete={handleDelete}
                onFeedback={handleFeedback}
              />
            ))}

            {/* Standalone Content */}
            {standaloneContent.length > 0 && (
              <div>
                <h4 className="text-lg font-mono text-gray-400 mb-4">Standalone Content</h4>
                <div className="flex flex-wrap gap-6">
                  {standaloneContent.map(post => (
                    <StandaloneCard
                      key={post.id}
                      post={post}
                      onView={handleView}
                      onDelete={handleDelete}
                      onFeedback={handleFeedback}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {viewDetailsOpen && selectedPost && (
        <ViewDetailsModal 
          post={selectedPost} 
          onClose={() => { setViewDetailsOpen(false); setSelectedPost(null); }} 
          onUpdate={refetch} 
        />
      )}

      {publishModalOpen && selectedPost && (
        <PublishModal 
          post={selectedPost}
          allPlatforms={groupedContent.find(g => g.posts.some(p => p.id === selectedPost.id))?.posts.map(p => p.platform) || []}
          onClose={() => { setPublishModalOpen(false); setSelectedPost(null); }} 
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

export default DashboardAltPage;