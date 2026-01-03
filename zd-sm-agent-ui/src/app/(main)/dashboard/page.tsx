'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, RefreshCw, BookOpen, Send, XCircle, Filter, Eye, Trash2, 
  MoreVertical, Play, X, Check, Image as ImageIcon, Video as VideoIcon,
  Edit, Save, MessageSquare, Maximize2, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useUserSession } from '@/hooks/use-user-session';
import { FaFacebook, FaInstagram, FaLinkedin } from "react-icons/fa";
import { authenticatedFetch } from '@/lib/api-client';

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
  created_at: string;
  discard: boolean;
  parent_post_id: string | null;
  prompt_used: string | null;
  ai_enhanced_prompt: string | null;
  feedback_rating: number | null;
  feedback_comment: string | null;
  video_style: string | null;
  video_purpose: string | null;
  ig_post_id: string | null;
  ig_post_link: string | null;
  fb_post_id: string | null;
  fb_post_link: string | null;
  li_post_id: string | null;
  li_post_link: string | null;
  tt_post_id: string | null;
  tt_post_link: string | null;
  ai_models_used: any;
  cost_breakdown: any;
  animated_version_id: string | null;
  is_animated_version: boolean;
  form_id: string | null;
  form_name: string | null;
  form_url: string | null;
}

interface CardData {
  imagePost: DashboardPost;
  videoPost: DashboardPost | null;
  hasToggle: boolean;
}

interface PromptGroup {
  prompt: string;
  date: string;
  cards: CardData[];
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

const getPublishedPlatforms = (post: DashboardPost): Array<{ platform: Platform; url: string }> => {
  const platforms: Array<{ platform: Platform; url: string }> = [];
  if (post.ig_post_link) platforms.push({ platform: 'instagram', url: post.ig_post_link });
  if (post.fb_post_link) platforms.push({ platform: 'facebook', url: post.fb_post_link });
  if (post.li_post_link) platforms.push({ platform: 'linkedin', url: post.li_post_link });
  if (post.tt_post_link) platforms.push({ platform: 'tiktok', url: post.tt_post_link });
  return platforms;
};

const groupPostsByPrompt = (posts: DashboardPost[]): PromptGroup[] => {
  const groupMap = new Map<string, { posts: DashboardPost[]; date: string }>();

  posts.filter(p => !p.parent_post_id).forEach(post => {
    const key = post.content_group_id || post.id;
    const existing = groupMap.get(key);
    
    if (!existing) {
      groupMap.set(key, { posts: [post], date: post.created_at });
    } else {
      existing.posts.push(post);
    }
  });

  const groups: PromptGroup[] = [];

  groupMap.forEach(({ posts: groupPosts, date }) => {
    const cards: CardData[] = [];

    groupPosts.forEach(post => {
      if (post.animated_version_id) {
        const animatedPost = posts.find(p => p.id === post.animated_version_id);
        cards.push({
          imagePost: post,
          videoPost: animatedPost || null,
          hasToggle: !!animatedPost
        });
      } else {
        cards.push({
          imagePost: post,
          videoPost: null,
          hasToggle: false
        });
      }
    });

    groups.push({
      prompt: groupPosts[0].prompt_used || 'No prompt',
      date,
      cards
    });
  });

  return groups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
      <div className="bg-[#10101d] p-6 rounded-xl shadow-lg border border-gray-800">
        <h3 className="text-sm font-mono uppercase text-gray-400 mb-2">Content Generated</h3>
        <p className="text-4xl font-bold text-white">{stats.totalGenerated}</p>
      </div>
      <div className="bg-[#10101d] p-6 rounded-xl shadow-lg border border-gray-800">
        <h3 className="text-sm font-mono uppercase text-gray-400 mb-2">Posts Published</h3>
        <p className="text-4xl font-bold text-white">{stats.totalPublished}</p>
      </div>
    </div>
  );
};

const FilterBar: React.FC<{ filters: FilterState; onFiltersChange: (filters: FilterState) => void; }> = ({ filters, onFiltersChange }) => {
  const [tempFilters, setTempFilters] = useState(filters);
  return (
    <div className="bg-[#10101d] p-4 rounded-xl border border-gray-800">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <input type="date" value={tempFilters.fromDate} onChange={(e) => setTempFilters({ ...tempFilters, fromDate: e.target.value })} className="bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm" style={{ colorScheme: 'dark' }} />
        <input type="date" value={tempFilters.toDate} onChange={(e) => setTempFilters({ ...tempFilters, toDate: e.target.value })} className="bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm" style={{ colorScheme: 'dark' }} />
        <select value={tempFilters.sourceType} onChange={(e) => setTempFilters({ ...tempFilters, sourceType: e.target.value as any })} className="bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm">
          <option value="all">All Types</option><option value="social_post">Social Posts</option><option value="video">Videos</option>
        </select>
        <select value={tempFilters.status} onChange={(e) => setTempFilters({ ...tempFilters, status: e.target.value as any })} className="bg-[#010112] border border-gray-700 text-white rounded-lg p-2 text-sm">
          <option value="all">All Status</option><option value="Draft">Draft</option><option value="Published">Published</option>
        </select>
        <button onClick={() => onFiltersChange(tempFilters)} className="bg-[#5ccfa2] text-black font-semibold py-2 rounded-lg hover:bg-[#45a881] flex items-center justify-center text-sm">
          <Filter className="w-4 h-4 mr-1" />Apply
        </button>
      </div>
    </div>
  );
};

// TAG INPUT COMPONENT
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
        placeholder={tags.length < maxTags ? "Type and press Enter..." : `Max ${maxTags} tags`}
        disabled={tags.length >= maxTags}
        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2] disabled:opacity-50"
      />
      <p className="text-xs text-gray-500 mt-1">{tags.length}/{maxTags} tags</p>
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
        .update({ feedback_rating: rating, feedback_comment: comment.trim() || null })
        .eq('id', postId);

      if (error) throw error;
      alert('Thank you for your feedback!');
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()} className="bg-[#0b0b10] w-full max-w-lg rounded-xl shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-bold text-white">Send Feedback</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800"><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Rating *</label>
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRating(star)} className={`text-3xl ${rating >= star ? 'text-yellow-400' : 'text-gray-600'}`}>★</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Comments (Optional)</label>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share your thoughts..." rows={4} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm resize-none" />
            </div>
          </div>
          <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-800">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-800 text-white">Cancel</button>
            <button onClick={handleSubmit} disabled={loading || rating === 0} className="px-6 py-2 rounded-lg bg-[#5ccfa2] text-black font-semibold disabled:opacity-50">
              {loading ? 'Sending...' : 'Submit'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// VIEW PROMPTS MODAL
const ViewPromptsModal: React.FC<{
  userPrompt: string;
  aiPrompt: string | null;
  onClose: () => void;
}> = ({ userPrompt, aiPrompt, onClose }) => (
  <AnimatePresence>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()} className="bg-[#0b0b10] w-full max-w-2xl rounded-xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Prompts</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">User Prompt:</h3>
            <p className="text-white bg-[#010112] p-3 rounded-lg text-sm">{userPrompt}</p>
          </div>
          {aiPrompt && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">AI Enhanced Prompt:</h3>
              <p className="text-white bg-[#010112] p-3 rounded-lg text-sm whitespace-pre-wrap">{aiPrompt}</p>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-[#5ccfa2] text-black rounded-lg font-semibold">Close</button>
        </div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

// FULLSCREEN LIGHTBOX
const FullscreenLightbox: React.FC<{
  type: 'image' | 'video';
  src: string;
  onClose: () => void;
}> = ({ type, src, onClose }) => (
  <AnimatePresence>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black z-[300] flex items-center justify-center p-6">
      <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20">
        <X className="w-6 h-6 text-white" />
      </button>
      {type === 'image' ? (
        <img src={src} alt="Fullscreen" className="max-w-full max-h-full object-contain" />
      ) : (
        <video src={src} controls autoPlay className="max-w-full max-h-full object-contain" />
      )}
    </motion.div>
  </AnimatePresence>
);

// PUBLISH BOTTOM DRAWER
const PublishBottomDrawer: React.FC<{
  post: DashboardPost;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ post, onClose, onSuccess }) => {
  const isVideo = post.source_type === 'video';
  const availablePlatforms: Platform[] = isVideo 
    ? ['facebook', 'instagram', 'linkedin', 'tiktok']
    : ['facebook', 'instagram', 'linkedin'];

  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(() => {
    return availablePlatforms.filter(platform => {
      switch(platform) {
        case 'instagram': return !post.ig_post_link;
        case 'facebook': return !post.fb_post_link;
        case 'linkedin': return !post.li_post_link;
        case 'tiktok': return !post.tt_post_link;
        default: return false;
      }
    });
  });
  
  const [loading, setLoading] = useState(false);

  const togglePlatform = (platform: Platform) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handlePublish = async () => {
    if (selectedPlatforms.length === 0) {
      alert('Please select at least one platform');
      return;
    }

    setLoading(true);
    try {
      const response = await authenticatedFetch('/api/n8n/publish', {
        method: 'POST',
        body: JSON.stringify({ 
          postId: post.id,
          platforms: selectedPlatforms,
          userId: post.user_id 
        }),
      });

      if (!response.ok) throw new Error('Publishing failed');
      
      alert(`Published to ${selectedPlatforms.length} platform(s)!`);
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }} className="fixed bottom-0 left-0 right-0 bg-[#0b0b10] border-t-2 border-[#5ccfa2] z-[150] shadow-2xl">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Publish Content</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {availablePlatforms.map(platform => {
            const alreadyPublished = 
              (platform === 'facebook' && post.fb_post_link) ||
              (platform === 'instagram' && post.ig_post_link) ||
              (platform === 'linkedin' && post.li_post_link) ||
              (platform === 'tiktok' && post.tt_post_link);
            const isSelected = selectedPlatforms.includes(platform);
            
            if (alreadyPublished) {
              return (
                <div key={platform} className="flex items-center justify-between p-3 rounded-lg border-2 border-green-600 bg-green-600/10 opacity-60">
                  <div className="flex items-center space-x-2">
                    <div className="text-green-400">{PLATFORM_ICONS[platform]}</div>
                    <span className="text-white text-sm">{PLATFORM_NAMES[platform]}</span>
                  </div>
                  <Check className="w-4 h-4 text-green-400" />
                </div>
              );
            }
            
            return (
              <button key={platform} onClick={() => togglePlatform(platform)} className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${isSelected ? 'border-[#5ccfa2] bg-[#5ccfa2]/10' : 'border-gray-700 bg-gray-800/50'}`}>
                <div className="flex items-center space-x-2">
                  {PLATFORM_ICONS[platform]}
                  <span className="text-white text-sm">{PLATFORM_NAMES[platform]}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-[#5ccfa2]" />}
              </button>
            );
          })}
        </div>
        <button onClick={handlePublish} disabled={loading || selectedPlatforms.length === 0} className="w-full py-3 bg-[#5ccfa2] text-black font-bold rounded-lg hover:bg-[#45a881] disabled:opacity-50">
          {loading ? 'Publishing...' : `Publish to ${selectedPlatforms.length} Platform(s)`}
        </button>
      </div>
    </motion.div>
  );
};

// RIGHT DRAWER (COMPLETE WITH ALL FEATURES)
const RightDrawer: React.FC<{
  card: CardData;
  onClose: () => void;
  onUpdate: () => void;
}> = ({ card, onClose, onUpdate }) => {
  const { user } = useUserSession();
  const [width, setWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [fullscreen, setFullscreen] = useState<{ type: 'image' | 'video'; src: string } | null>(null);
  
  const currentPost = showVideo && card.videoPost ? card.videoPost : card.imagePost;
  
  // Caption editing
  const [caption, setCaption] = useState(currentPost.caption || '');
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  
  // Category and Tags
  const [category, setCategory] = useState(currentPost.category || '');
  const [tags, setTags] = useState<string[]>(currentPost.tags || []);
  
  const [saving, setSaving] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [creatingForm, setCreatingForm] = useState(false);

  useEffect(() => {
    setCaption(currentPost.caption || '');
    setCategory(currentPost.category || '');
    setTags(currentPost.tags || []);
    setIsEditingCaption(false);
  }, [showVideo, currentPost]);

  const handleMouseDown = useCallback(() => setIsResizing(true), []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.max(400, Math.min(newWidth, window.innerWidth * 0.8)));
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleSaveCaption = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('posts_v2').update({ caption }).eq('id', currentPost.id);
      if (error) throw error;
      setIsEditingCaption(false);
      onUpdate();
      alert('Caption saved!');
    } catch (error: any) {
      alert(`Failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCategory = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('posts_v2').update({ category: category || null }).eq('id', currentPost.id);
      if (error) throw error;
      onUpdate();
      alert('Category saved!');
    } catch (error: any) {
      alert(`Failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTags = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('posts_v2').update({ tags: tags.length > 0 ? tags : null }).eq('id', currentPost.id);
      if (error) throw error;
      onUpdate();
      alert('Tags saved!');
    } catch (error: any) {
      alert(`Failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAnimateImage = async () => {
    setAnimating(true);
    try {
      const response = await authenticatedFetch('/api/n8n/animate-image', {
        method: 'POST',
        body: JSON.stringify({
          sourcePostId: currentPost.id,
          sourceImageUrl: currentPost.image_url,
          duration: '5',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      alert('Image queued for animation!');
      onUpdate();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setAnimating(false);
    }
  };

  const handleCreateForm = async () => {
    setCreatingForm(true);
    try {
      const response = await authenticatedFetch('/api/forms/generate', {
        method: 'POST',
        body: JSON.stringify({
          postId: currentPost.id,
          contentGroupId: currentPost.content_group_id,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      alert(`Form created: ${data.formName}`);
      onUpdate();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setCreatingForm(false);
    }
  };

  const publishedPlatforms = getPublishedPlatforms(currentPost);

  return (
    <>
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }} className="fixed top-0 right-0 h-full bg-[#0b0b10] border-l border-gray-800 z-[100] overflow-y-auto shadow-2xl" style={{ width: `${width}px` }}>
        
        {/* Resize Handle */}
        <div onMouseDown={handleMouseDown} className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-[#5ccfa2] transition-colors" />
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-[#0b0b10] z-10">
          <button onClick={() => setShowPrompts(true)} className="text-sm text-[#5ccfa2] hover:text-[#45a881]">View Prompts</button>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Toggle */}
          {card.hasToggle && card.videoPost && (
            <div className="flex border border-gray-700 rounded-lg overflow-hidden">
              <button onClick={() => setShowVideo(false)} className={`flex-1 py-2 px-4 text-sm font-semibold transition-colors ${!showVideo ? 'bg-[#5ccfa2] text-black' : 'bg-transparent text-gray-400'}`}>
                <ImageIcon className="w-4 h-4 inline mr-1" />Image
              </button>
              <button onClick={() => setShowVideo(true)} className={`flex-1 py-2 px-4 text-sm font-semibold transition-colors ${showVideo ? 'bg-[#5ccfa2] text-black' : 'bg-transparent text-gray-400'}`}>
                <VideoIcon className="w-4 h-4 inline mr-1" />Video
              </button>
            </div>
          )}
          
          {/* Preview */}
          <div className="relative">
            {currentPost.source_type === 'video' ? (
              <div className="relative">
                <video src={currentPost.video_url || ''} poster={currentPost.video_thumbnail_url || ''} controls className="w-full rounded-lg" />
                <button onClick={() => setFullscreen({ type: 'video', src: currentPost.video_url || '' })} className="absolute top-2 right-2 p-2 bg-black/50 rounded-full hover:bg-black/70">
                  <Maximize2 className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <img src={currentPost.image_url || ''} alt="Preview" className="w-full rounded-lg" />
                <button onClick={() => setFullscreen({ type: 'image', src: currentPost.image_url || '' })} className="absolute top-2 right-2 p-2 bg-black/50 rounded-full hover:bg-black/70">
                  <Maximize2 className="w-4 h-4 text-white" />
                </button>
              </div>
            )}
          </div>
          
          {/* Caption */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-400">Caption</h3>
              {!isEditingCaption && (
                <button onClick={() => setIsEditingCaption(true)} className="text-xs text-[#5ccfa2]"><Edit className="w-3 h-3 inline mr-1" />Edit</button>
              )}
            </div>
            {isEditingCaption ? (
              <div className="space-y-2">
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm resize-none" />
                <div className="flex space-x-2">
                  <button onClick={handleSaveCaption} disabled={saving} className="flex-1 px-3 py-2 bg-[#5ccfa2] text-black rounded-lg font-semibold">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : <><Save className="w-4 h-4 inline mr-1" />Save</>}
                  </button>
                  <button onClick={() => { setCaption(currentPost.caption || ''); setIsEditingCaption(false); }} className="px-3 py-2 bg-gray-800 text-white rounded-lg">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white whitespace-pre-wrap bg-[#010112] p-3 rounded-lg">{currentPost.caption || 'No caption'}</p>
            )}
          </div>
          
          {/* Category */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Category</h3>
            <div className="flex space-x-2">
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Enter category..." className="flex-1 bg-[#010112] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm" />
              <button onClick={handleSaveCategory} disabled={saving || category === currentPost.category} className="px-4 py-2 bg-[#5ccfa2] text-black rounded-lg font-semibold text-xs disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
          
          {/* Tags */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Tags (Max 3)</h3>
            <TagInput tags={tags} onChange={setTags} maxTags={3} />
            <button onClick={handleSaveTags} disabled={saving || JSON.stringify(tags) === JSON.stringify(currentPost.tags || [])} className="mt-2 w-full px-4 py-2 bg-[#5ccfa2] text-black rounded-lg font-semibold text-xs disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Tags'}
            </button>
          </div>
          
          {/* Video Info */}
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
          
          {/* Published Platforms */}
          {publishedPlatforms.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Published To</h3>
              <div className="space-y-2">
                {publishedPlatforms.map(({ platform, url }) => (
                  <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 text-[#5ccfa2] hover:text-[#45a881]">
                    {PLATFORM_ICONS[platform]}
                    <span className="text-sm">{PLATFORM_NAMES[platform]}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Admin Cost Breakdown */}
          {user?.id === 'a1bb9dc6-09bf-4952-bbb2-4248a4e8f544' && currentPost.cost_breakdown && (
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Generation Cost (Admin)</h3>
              <div className="text-xs text-gray-300 space-y-1">
                {currentPost.ai_models_used && <p>Models: {JSON.stringify(currentPost.ai_models_used)}</p>}
                <p className="font-semibold text-[#5ccfa2]">
                  Total: ${typeof currentPost.cost_breakdown === 'object' ? currentPost.cost_breakdown.total : currentPost.cost_breakdown}
                </p>
              </div>
            </div>
          )}

          {/* Actions Section */}
          <div className="border-t border-gray-700 pt-4 space-y-3">
            {/* Animate Image */}
            {currentPost.source_type === 'social_post' && currentPost.image_url && !currentPost.animated_version_id && (
              <button onClick={handleAnimateImage} disabled={animating} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-semibold disabled:opacity-50">
                {animating ? <><Loader2 className="w-4 h-4 inline mr-2 animate-spin" />Animating...</> : <><Play className="w-4 h-4 inline mr-2" />Animate Image</>}
              </button>
            )}
            
            {currentPost.animated_version_id && (
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                <p className="text-sm text-green-300">✓ Animated version available</p>
              </div>
            )}
            
            {/* Lead Form */}
            <div className="border-t border-gray-700 pt-3">
              <h4 className="text-xs font-semibold text-gray-400 mb-2">LEAD FORM</h4>
              {currentPost.form_id ? (
                <div className="space-y-2">
                  <p className="text-sm text-white">Form: {currentPost.form_name}</p>
                  <a href={currentPost.form_url || '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-[#5ccfa2] hover:text-[#45a881]">View Form →</a>
                </div>
              ) : (
                <button onClick={handleCreateForm} disabled={creatingForm} className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg font-semibold disabled:opacity-50">
                  {creatingForm ? 'Creating...' : 'Create Lead Form'}
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Publish Button */}
        <div className="sticky bottom-0 p-4 border-t border-gray-800 bg-[#0b0b10]">
          <button onClick={() => setShowPublish(true)} className="w-full py-3 bg-[#5ccfa2] text-black font-bold rounded-lg hover:bg-[#45a881]">
            <Send className="w-4 h-4 inline mr-2" />Publish
          </button>
        </div>
      </motion.div>
      
      {showPrompts && (
        <ViewPromptsModal userPrompt={card.imagePost.prompt_used || 'No prompt'} aiPrompt={card.imagePost.ai_enhanced_prompt} onClose={() => setShowPrompts(false)} />
      )}
      
      {showPublish && (
        <PublishBottomDrawer post={currentPost} onClose={() => setShowPublish(false)} onSuccess={onUpdate} />
      )}
      
      {fullscreen && (
        <FullscreenLightbox type={fullscreen.type} src={fullscreen.src} onClose={() => setFullscreen(null)} />
      )}
    </>
  );
};

// CARD COMPONENT
const Card: React.FC<{
  card: CardData;
  onView: (card: CardData) => void;
  onPublish: (post: DashboardPost) => void;
  onDelete: (postId: string) => void;
  onFeedback: (postId: string) => void;
}> = ({ card, onView, onPublish, onDelete, onFeedback }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const currentPost = showVideo && card.videoPost ? card.videoPost : card.imagePost;
  const mediaUrl = currentPost.source_type === 'video' ? (currentPost.video_thumbnail_url || currentPost.video_url) : currentPost.image_url;
  const publishedPlatforms = getPublishedPlatforms(currentPost);

  return (
    <div className="bg-[#10101d] rounded-xl border border-gray-800 overflow-hidden" style={{ width: '350px' }}>
      {/* Toggle */}
      {card.hasToggle && card.videoPost && (
        <div className="flex border-b border-gray-700">
          <button onClick={() => setShowVideo(false)} className={`flex-1 py-2 text-xs font-semibold ${!showVideo ? 'bg-[#5ccfa2] text-black' : 'text-gray-400'}`}>Image</button>
          <button onClick={() => setShowVideo(true)} className={`flex-1 py-2 text-xs font-semibold ${showVideo ? 'bg-[#5ccfa2] text-black' : 'text-gray-400'}`}>Video</button>
        </div>
      )}
      
      {/* Preview */}
      <div className="relative aspect-square">
        <img src={mediaUrl || ''} alt="Preview" className="w-full h-full object-cover" />
        {currentPost.source_type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="w-16 h-16 text-white/80" />
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-3">
        <h4 className="text-base font-semibold text-white">{PLATFORM_NAMES[currentPost.platform]}</h4>
        <button onClick={() => onView(card)} className="text-sm text-[#5ccfa2] hover:text-[#45a881] text-left">Click to view/edit caption & details</button>
        
        {/* Actions */}
        <div className="flex items-center space-x-2">
          <button onClick={() => onView(card)} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg flex items-center justify-center">
            <Eye className="w-4 h-4 mr-2" />View
          </button>
          <button onClick={() => onPublish(currentPost)} className="flex-1 px-4 py-2 bg-[#5ccfa2] hover:bg-[#45a881] text-black text-sm rounded-lg font-semibold flex items-center justify-center">
            <Send className="w-4 h-4 mr-2" />Publish
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg">
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 bottom-full mb-2 w-40 bg-[#10101d] border border-gray-700 rounded-lg shadow-lg z-20">
                <button onClick={() => { onFeedback(currentPost.id); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-800 text-sm rounded-t-lg flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2" />Feedback
                </button>
                <button onClick={() => { onDelete(currentPost.id); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-800 text-sm rounded-b-lg flex items-center">
                  <Trash2 className="w-4 h-4 mr-2" />Delete
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Status */}
        <div className="border-t border-gray-700 pt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">Status: <span className={currentPost.published ? 'text-green-400' : 'text-yellow-400'}>{currentPost.published ? 'Published' : 'Draft'}</span></span>
          {publishedPlatforms.length > 0 && (
            <div className="flex items-center space-x-1">
              {publishedPlatforms.map(({ platform, url }) => (
                <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">{PLATFORM_ICONS[platform]}</a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// PROMPT GROUP COMPONENT
const PromptGroupSection: React.FC<{
  group: PromptGroup;
  onViewCard: (card: CardData) => void;
  onPublish: (post: DashboardPost) => void;
  onDelete: (postId: string) => void;
  onFeedback: (postId: string) => void;
}> = ({ group, onViewCard, onPublish, onDelete, onFeedback }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-white font-semibold">User Prompt: {group.prompt}</h3>
      <span className="text-sm text-gray-400">Date: {formatDate(group.date)}</span>
    </div>
    <div className="flex flex-wrap gap-6">
      {group.cards.map((card, idx) => (
        <Card key={idx} card={card} onView={onViewCard} onPublish={onPublish} onDelete={onDelete} onFeedback={onFeedback} />
      ))}
    </div>
  </div>
);

// MAIN DASHBOARD
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
  const [promptGroups, setPromptGroups] = useState<PromptGroup[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [publishPost, setPublishPost] = useState<DashboardPost | null>(null);
  const [feedbackPostId, setFeedbackPostId] = useState<string | null>(null);

  useEffect(() => {
    setPromptGroups(groupPostsByPrompt(posts));
  }, [posts]);

  const handleDelete = async (postId: string) => {
    if (!confirm('Delete this content?')) return;
    try {
      const { error } = await supabase.from('posts_v2').update({ discard: true }).eq('id', postId);
      if (error) throw error;
      refetch();
    } catch (error) {
      alert('Failed to delete');
    }
  };

  if (sessionLoading || !userId) {
    if (!sessionLoading && !userId) {
      router.push('/login');
      return null;
    }
    return <div className="min-h-screen flex justify-center items-center"><Loader2 className="w-10 h-10 animate-spin text-[#5ccfa2]" /></div>;
  }

  if (loading) return <div className="min-h-screen flex justify-center items-center"><Loader2 className="w-10 h-10 animate-spin text-[#5ccfa2]" /></div>;

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="bg-red-900/20 border border-red-700 p-8 rounded-xl text-center">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <p className="text-red-200">{error}</p>
          <button onClick={refetch} className="mt-4 px-4 py-2 bg-red-600 rounded-lg text-white">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-gray-800">
        <h2 className="text-3xl font-mono text-white">Dashboard</h2>
        <button onClick={refetch} className="p-2 rounded-full hover:text-[#5ccfa2]"><RefreshCw className="w-6 h-6" /></button>
      </div>

      <SimpleStatCards stats={stats} />
      <FilterBar filters={filters} onFiltersChange={setFilters} />

      <div>
        <h3 className="text-2xl font-mono text-white mb-6">Your Content</h3>
        {promptGroups.length === 0 ? (
          <div className="bg-[#10101d] p-12 rounded-xl border border-gray-800 text-center">
            <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h4 className="text-xl font-mono text-gray-400 mb-2">No Content Found</h4>
            <p className="text-gray-500">Start creating in Content Studio</p>
          </div>
        ) : (
          <div className="space-y-8">
            {promptGroups.map((group, idx) => (
              <PromptGroupSection key={idx} group={group} onViewCard={setSelectedCard} onPublish={setPublishPost} onDelete={handleDelete} onFeedback={setFeedbackPostId} />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedCard && (
          <RightDrawer card={selectedCard} onClose={() => setSelectedCard(null)} onUpdate={refetch} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {publishPost && (
          <PublishBottomDrawer post={publishPost} onClose={() => setPublishPost(null)} onSuccess={refetch} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {feedbackPostId && (
          <FeedbackModal postId={feedbackPostId} onClose={() => setFeedbackPostId(null)} onSuccess={refetch} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default DashboardPage;