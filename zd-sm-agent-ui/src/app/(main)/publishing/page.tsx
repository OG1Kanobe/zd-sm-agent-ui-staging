'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Loader2, Zap, Link, Clock, Play, Facebook, Instagram, Linkedin, 
    LogIn, Check, FileText, Video, Image as ImageIcon, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient'; 
import { useUserSession } from '@/hooks/use-user-session'; 
import { DateTime } from 'luxon';
import { authenticatedFetch } from '@/lib/api-client';

type Config = {
    id: string | null; 
    clientConfigId: string | null;
    company_name: string;
    schedule_posts: boolean;
    schedule_time: string; 
    user_timezone: string; 
    linked_accounts: { fb: boolean; ig: boolean; li: boolean };
    qstash_message_id: string | null;
    linkedin_organization_urn?: string | null;
};

type SocialProfile = {
    connected: boolean;
    token_expiry: string | null;
};

type ReferenceType = 'none' | 'url' | 'video' | 'image' | 'article';
type ContentTab = 'social' | 'image' | 'video';
type VideoSource = 'text' | 'image';
type Orientation = '16:9' | '9:16' | '1:1';

// Custom TikTok Icon Component
const TikTokIcon = ({ className }: { className?: string }) => (
    <svg 
        viewBox="0 0 24 24" 
        className={className}
        fill="currentColor"
    >
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
);

const SOCIAL_PLATFORMS = [
    { name: 'Facebook', icon: Facebook, key: 'fb', color: 'bg-blue-600', loginUrl: '/api/facebook/login' },
    { name: 'Instagram', icon: Instagram, key: 'ig', color: 'bg-pink-600', loginUrl: '/api/instagram/login' },
    { name: 'LinkedIn', icon: Linkedin, key: 'li', color: 'bg-blue-800', loginUrl: '/api/linkedin/login' },
    { name: 'TikTok', icon: TikTokIcon, key: 'tt', color: 'bg-black', loginUrl: '/api/tiktok/login' },
];

const ContentStudioPage = () => {
    const router = useRouter();
    const { user, loading: sessionLoading, session } = useUserSession(); 
    const userId = user?.id;
    const jwtToken = session?.access_token || '';

    const [configs, setConfigs] = useState<Config | null>(null);
    const [userSocialProfiles, setUserSocialProfiles] = useState<Record<string, SocialProfile>>({});
    const [isLoading, setIsLoading] = useState(true);
    
    // Tab State
    const [activeTab, setActiveTab] = useState<ContentTab>('social');
    
    // Social Post Fields
    const [socialPrompt, setSocialPrompt] = useState('');
    const [socialReferenceType, setSocialReferenceType] = useState<ReferenceType>('none');
    const [socialReferenceUrl, setSocialReferenceUrl] = useState('');
    const [socialReferenceVideo, setSocialReferenceVideo] = useState('');
    const [socialReferenceImage, setSocialReferenceImage] = useState('');
    const [socialReferenceArticle, setSocialReferenceArticle] = useState('');
    const [socialCategory, setSocialCategory] = useState('');
    const [socialTags, setSocialTags] = useState<string[]>([]);
    const [socialTagInput, setSocialTagInput] = useState('');
    const [socialContentType, setSocialContentType] = useState<'organic' | 'paid'>('organic');
    const [generateFB, setGenerateFB] = useState(false);
    const [generateIG, setGenerateIG] = useState(false);
    const [generateLI, setGenerateLI] = useState(false);
    const [socialLoading, setSocialLoading] = useState(false);
    
    // Image Only Fields
    const [imagePrompt, setImagePrompt] = useState('');
    const [imageReferenceType, setImageReferenceType] = useState<ReferenceType>('none');
    const [imageReferenceUrl, setImageReferenceUrl] = useState('');
    const [imageReferenceVideo, setImageReferenceVideo] = useState('');
    const [imageReferenceImage, setImageReferenceImage] = useState('');
    const [imageReferenceArticle, setImageReferenceArticle] = useState('');
    const [imageCategory, setImageCategory] = useState('');
    const [imageTags, setImageTags] = useState<string[]>([]);
    const [imageTagInput, setImageTagInput] = useState('');
    const [imageLoading, setImageLoading] = useState(false);
    
    // Video Fields
    const [videoSource, setVideoSource] = useState<VideoSource>('text');
    const [videoPrompt, setVideoPrompt] = useState('');
    const [videoReferenceType, setVideoReferenceType] = useState<ReferenceType>('none');
    const [videoReferenceUrl, setVideoReferenceUrl] = useState('');
    const [videoReferenceVideo, setVideoReferenceVideo] = useState('');
    const [videoReferenceImage, setVideoReferenceImage] = useState('');
    const [videoReferenceArticle, setVideoReferenceArticle] = useState('');
    const [videoImagePrompt, setVideoImagePrompt] = useState('');
    const [selectedImageForVideo, setSelectedImageForVideo] = useState('');
    const [videoOrientation, setVideoOrientation] = useState<Orientation>('16:9');
    const [videoDuration, setVideoDuration] = useState<'5' | '10' | '15' | '30'>('10');
    const [videoCategory, setVideoCategory] = useState('');
    const [videoTags, setVideoTags] = useState<string[]>([]);
    const [videoTagInput, setVideoTagInput] = useState('');
    const [videoLoading, setVideoLoading] = useState(false);
    
    const [clientConfigId, setClientConfigId] = useState<string | null>(null);
    
    const [linkedinOrgs, setLinkedinOrgs] = useState<Array<{
        id: string;
        urn: string;
        name: string;
        vanityName: string | null;
    }>>([]);
    const [selectedLinkedinOrg, setSelectedLinkedinOrg] = useState<string | null>(null);

    const handleLinkedinOrgChange = async (orgUrn: string) => {
        setSelectedLinkedinOrg(orgUrn);
        
        if (!userId) return;
        
        let selectedOrgData = null;
        
        if (orgUrn && orgUrn !== 'personal') {
            selectedOrgData = linkedinOrgs.find(org => org.urn === orgUrn);
        }
        
        const { error: profileError } = await supabase
            .from('user_social_profiles')
            .update({ 
                linkedin_organizations: selectedOrgData ? [selectedOrgData] : null 
            })
            .eq('client_id', userId);
        
        if (profileError) {
            console.error('Failed to update user_social_profiles:', profileError);
        }
        
        if (configs?.id) {
            const valueToSave = orgUrn === 'personal' ? null : orgUrn;
            
            const { error } = await supabase
                .from('client_configs')
                .update({ linkedin_organization_urn: valueToSave })
                .eq('id', configs.id);
            
            if (error) {
                console.error('Failed to save LinkedIn org selection:', error);
            }
        }
    };

    const fetchSocialProfiles = async () => {
    if (!userId) return;

    try {
        const { data: socialProfile, error: socialError } = await supabase
            .from('user_social_profiles')
            .select('facebook_connected, instagram_connected, linkedin_connected, tiktok_connected, fb_token_expires_at, ig_token_expires_at, li_token_expires_at, tt_token_expires_at, linkedin_organizations')
            .eq('client_id', userId)
            .single();

        if (socialError && socialError.code !== 'PGRST116') {
            console.error('Error fetching social profiles:', socialError);
            return;
        }

        const profiles: Record<string, SocialProfile> = {
            fb: {
                connected: socialProfile?.facebook_connected || false,
                token_expiry: socialProfile?.fb_token_expires_at || null
            },
            ig: {
                connected: socialProfile?.instagram_connected || false,
                token_expiry: socialProfile?.ig_token_expires_at || null
            },
            li: {
                connected: socialProfile?.linkedin_connected || false,
                token_expiry: socialProfile?.li_token_expires_at || null
            },
            tt: {
                connected: socialProfile?.tiktok_connected || false,
                token_expiry: socialProfile?.tt_token_expires_at || null
            }
        };

        setUserSocialProfiles(profiles);
        
        const orgsData = (socialProfile as any)?.linkedin_organizations;
        if (orgsData && Array.isArray(orgsData) && orgsData.length > 0) {
            setLinkedinOrgs(orgsData);
        }
    } catch (err) {
        console.error('[Content Studio] Failed to fetch social profiles:', err);
    }
};

    useEffect(() => {
        if (sessionLoading || !userId) return;

        const fetchData = async () => {
            setIsLoading(true);

            const { data: configData, error: configError } = await supabase
                .from('client_configs')
                .select('id, company_name, schedule_posts, schedule_time, user_timezone, linked_accounts, qstash_message_id, linkedin_organization_urn') 
                .eq('client_id', userId)
                .single();

            if (configError && configError.code !== 'PGRST116') {
                console.error("Error fetching configs:", configError);
            }

            const fetchedConfig: Config = {
                id: configData?.id || null,
                clientConfigId: configData?.id || null,
                company_name: configData?.company_name || '',
                schedule_posts: configData?.schedule_posts || false,
                schedule_time: configData?.schedule_time || '10:00',
                user_timezone: configData?.user_timezone || 'Africa/Johannesburg',
                linked_accounts: configData?.linked_accounts || { fb: false, ig: false, li: false },
                qstash_message_id: configData?.qstash_message_id || null,
            };

            setConfigs(fetchedConfig);
            setClientConfigId(fetchedConfig.clientConfigId);

            await fetchSocialProfiles();

            if (configData?.linkedin_organization_urn) {
                setSelectedLinkedinOrg(configData.linkedin_organization_urn);
            } 

            setIsLoading(false);
        };

        fetchData();
    }, [userId, sessionLoading]);

    const handleSocialLogin = (platformKey: string, loginUrl: string) => {
        if (!userId) return;

        const urlWithUser = `${loginUrl}?userId=${encodeURIComponent(userId)}`;
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
            urlWithUser, 
            'SocialLoginPopup', 
            `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
        );

        const listener = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            
            if (event.data.success && event.data.platform === platformKey) {
                fetchSocialProfiles();
                popup?.close();
                window.removeEventListener('message', listener);
            }
        };

        window.addEventListener('message', listener);

        const checkPopupClosed = setInterval(() => {
            if (popup?.closed) {
                clearInterval(checkPopupClosed);
                window.removeEventListener('message', listener);
            }
        }, 500);
    };

    // Tag handlers for Social Post
    const handleAddSocialTag = () => {
        if (socialTagInput.trim() && socialTags.length < 3 && !socialTags.includes(socialTagInput.trim())) {
            setSocialTags([...socialTags, socialTagInput.trim()]);
            setSocialTagInput('');
        }
    };

    const handleRemoveSocialTag = (tagToRemove: string) => {
        setSocialTags(socialTags.filter(tag => tag !== tagToRemove));
    };

    // Tag handlers for Image Only
    const handleAddImageTag = () => {
        if (imageTagInput.trim() && imageTags.length < 3 && !imageTags.includes(imageTagInput.trim())) {
            setImageTags([...imageTags, imageTagInput.trim()]);
            setImageTagInput('');
        }
    };

    const handleRemoveImageTag = (tagToRemove: string) => {
        setImageTags(imageTags.filter(tag => tag !== tagToRemove));
    };

    // Tag handlers for Video
    const handleAddVideoTag = () => {
        if (videoTagInput.trim() && videoTags.length < 3 && !videoTags.includes(videoTagInput.trim())) {
            setVideoTags([...videoTags, videoTagInput.trim()]);
            setVideoTagInput('');
        }
    };

    const handleRemoveVideoTag = (tagToRemove: string) => {
        setVideoTags(videoTags.filter(tag => tag !== tagToRemove));
    };

    const handleSocialPostGeneration = async () => {
        if (!clientConfigId) {
            alert("Client Config ID is missing.");
            return;
        }

        if (!socialPrompt.trim()) {
            alert("Prompt is required.");
            return;
        }

        if (!generateFB && !generateIG && !generateLI) {
            alert("Please select at least one platform.");
            return;
        }

        setSocialLoading(true);

        try {
            const payload = {
                clientConfigId,
                prompt: socialPrompt.trim(),
                referenceType: socialReferenceType,
                referenceUrl: socialReferenceType === 'url' ? socialReferenceUrl.trim() || null : null,
                referenceVideo: socialReferenceType === 'video' ? socialReferenceVideo.trim() || null : null,
                referenceImage: socialReferenceType === 'image' ? socialReferenceImage.trim() || null : null,
                referenceArticle: socialReferenceType === 'article' ? socialReferenceArticle.trim() || null : null,
                category: socialCategory.trim() || null,
                tags: socialTags,
                generate_FB: generateFB,
                generate_IG: generateIG,
                generate_LI: generateLI,
                organic: socialContentType === 'organic',
                paid: socialContentType === 'paid',
            };

            console.log('[Content Studio] Social Post payload:', payload);

            const response = await authenticatedFetch('/api/n8n/post-now', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Social post generation failed");
            }

            alert('Social post generation request sent successfully!');
            
            // Reset form
            setSocialPrompt('');
            setSocialReferenceType('none');
            setSocialReferenceUrl('');
            setSocialReferenceVideo('');
            setSocialReferenceImage('');
            setSocialReferenceArticle('');
            setSocialCategory('');
            setSocialTags([]);
            setGenerateFB(false);
            setGenerateIG(false);
            setGenerateLI(false);
        } catch (error) {
            console.error("Social Post Generation Error:", error);
            alert('Failed to send social post generation request.');
        } finally {
            setSocialLoading(false);
        }
    };

    const handleImageOnlyGeneration = async () => {
        if (!clientConfigId) {
            alert("Client Config ID is missing.");
            return;
        }

        if (!imagePrompt.trim()) {
            alert("Prompt is required.");
            return;
        }

        setImageLoading(true);

        try {
            const payload = {
                clientConfigId,
                prompt: imagePrompt.trim(),
                referenceType: imageReferenceType,
                referenceUrl: imageReferenceType === 'url' ? imageReferenceUrl.trim() || null : null,
                referenceVideo: imageReferenceType === 'video' ? imageReferenceVideo.trim() || null : null,
                referenceImage: imageReferenceType === 'image' ? imageReferenceImage.trim() || null : null,
                referenceArticle: imageReferenceType === 'article' ? imageReferenceArticle.trim() || null : null,
                category: imageCategory.trim() || null,
                tags: imageTags,
            };

            console.log('[Content Studio] Image Only payload:', payload);

            const response = await authenticatedFetch('/api/n8n/image-only', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Image generation failed");
            }

            alert('Image generation request sent successfully!');
            
            // Reset form
            setImagePrompt('');
            setImageReferenceType('none');
            setImageReferenceUrl('');
            setImageReferenceVideo('');
            setImageReferenceImage('');
            setImageReferenceArticle('');
            setImageCategory('');
            setImageTags([]);
        } catch (error) {
            console.error("Image Only Generation Error:", error);
            alert('Failed to send image generation request.');
        } finally {
            setImageLoading(false);
        }
    };

    const handleVideoGeneration = async () => {
        if (!clientConfigId) {
            alert("Client Config ID is missing.");
            return;
        }

        if (videoSource === 'text' && !videoPrompt.trim()) {
            alert("Video prompt is required.");
            return;
        }

        if (videoSource === 'image' && !videoImagePrompt.trim()) {
            alert("Video description is required.");
            return;
        }

        setVideoLoading(true);

        try {
            const payload = {
                clientConfigId,
                videoSource,
                prompt: videoSource === 'text' ? videoPrompt.trim() : videoImagePrompt.trim(),
                referenceType: videoSource === 'text' ? videoReferenceType : 'none',
                referenceUrl: videoSource === 'text' && videoReferenceType === 'url' ? videoReferenceUrl.trim() || null : null,
                referenceVideo: videoSource === 'text' && videoReferenceType === 'video' ? videoReferenceVideo.trim() || null : null,
                referenceImage: videoSource === 'text' && videoReferenceType === 'image' ? videoReferenceImage.trim() || null : null,
                referenceArticle: videoSource === 'text' && videoReferenceType === 'article' ? videoReferenceArticle.trim() || null : null,
                sourceImage: videoSource === 'image' ? selectedImageForVideo || null : null,
                orientation: videoOrientation,
                duration: videoDuration,
                category: videoCategory.trim() || null,
                tags: videoTags,
            };

            console.log('[Content Studio] Video payload:', payload);

            const response = await authenticatedFetch('/api/n8n/video-gen', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Video generation failed");
            }

            alert('Video generation request sent successfully!');
            
            // Reset form
            setVideoPrompt('');
            setVideoImagePrompt('');
            setVideoReferenceType('none');
            setVideoReferenceUrl('');
            setVideoReferenceVideo('');
            setVideoReferenceImage('');
            setVideoReferenceArticle('');
            setSelectedImageForVideo('');
            setVideoCategory('');
            setVideoTags([]);
        } catch (error) {
            console.error("Video Generation Error:", error);
            alert('Failed to send video generation request.');
        } finally {
            setVideoLoading(false);
        }
    };

    const scrollToImageTab = () => {
        setActiveTab('image');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (sessionLoading || isLoading || !configs) {
        return (
            <div className="min-h-screen flex justify-center items-center">
                <Loader2 className="w-10 h-10 animate-spin text-[#5ccfa2]" />
                <span className="ml-3 text-lg font-mono">Loading...</span> 
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-gray-800">
                    <div>
                        <h2 className="text-3xl font-mono text-white">Content Studio</h2>
                        <p className="text-sm text-gray-400 mt-1">Create social posts, images, and videos for your brand.</p>
                    </div>
                </div>

                <div className="space-y-10">
{/* SOCIAL MEDIA CONNECTIONS */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="bg-[#10101d] p-8 rounded-xl shadow-2xl border border-gray-800 space-y-6"
                    >
                        <h2 className="text-2xl font-mono text-white border-b border-gray-700 pb-3 flex items-center">
                            <Link className="w-6 h-6 mr-3 text-[#5ccfa2]" /> Social Account Connections
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {SOCIAL_PLATFORMS.map((platform) => {
                                const profile = userSocialProfiles[platform.key];
                                const isConnected = profile?.connected || false;
                                
                                const tokenExpiry = profile?.token_expiry 
                                    ? DateTime.fromISO(profile.token_expiry).minus({ days: 5 })
                                    : null;
                                const expiryDate = tokenExpiry?.toLocaleString(DateTime.DATETIME_SHORT);

                                return (
                                    <div 
                                        key={platform.key} 
                                        className={`p-4 rounded-xl border-2 ${isConnected ? 'border-green-500' : 'border-gray-700'} flex flex-col items-center justify-between text-center ${platform.color} bg-opacity-20`}
                                    >
                                        <platform.icon className={`w-10 h-10 ${isConnected ? 'text-green-400' : 'text-gray-400'}`} />
                                        <h3 className="text-xl font-bold mt-2 text-white">{platform.name}</h3>

                                        {isConnected ? (
                                            <>
                                                <button
                                                    disabled
                                                    className="mt-4 w-full py-2 rounded-lg font-semibold bg-green-500 text-black cursor-default"
                                                >
                                                    Connected <Check className="w-4 h-4 inline-block ml-2" />
                                                </button>
                                                <div className="flex justify-between w-full mt-2 text-xs text-gray-300 px-1">
                                                    <span className="text-left">
                                                        {expiryDate ? `Token expires: ${expiryDate}` : 'No expiry data'}
                                                    </span>
                                                    <span 
                                                        onClick={() => handleSocialLogin(platform.key, platform.loginUrl)} 
                                                        className="underline cursor-pointer hover:text-[#5ccfa2] text-right"
                                                    >
                                                        Reconnect Now
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleSocialLogin(platform.key, platform.loginUrl)}
                                                className="mt-4 w-full py-2 rounded-lg font-semibold transition-colors flex items-center justify-center bg-[#5ccfa2] text-black hover:bg-[#45a881]"
                                            >
                                                <LogIn className="w-5 h-5 mr-2" /> Login
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* LinkedIn Organization Selector */}
                    {userSocialProfiles.li?.connected && linkedinOrgs.length > 0 && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="bg-[#10101d] p-8 rounded-xl shadow-2xl border border-gray-800 space-y-6"
                        >
                            <h2 className="text-2xl font-mono text-white border-b border-gray-700 pb-3 flex items-center">
                                <Linkedin className="w-6 h-6 mr-3 text-[#5ccfa2]" /> LinkedIn Organization
                            </h2>

                            <div className="flex flex-col space-y-2">
                                <label className="text-sm text-gray-400">
                                    Select which LinkedIn page to post to:
                                </label>
                                <select
                                    value={selectedLinkedinOrg || ''}
                                    onChange={(e) => handleLinkedinOrgChange(e.target.value)}
                                    className="bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                >
                                    <option value="">-- Select where to post --</option>
                                    <option value="personal">Personal Profile</option>
                                    {linkedinOrgs.map((org) => (
                                        <option key={org.id} value={org.urn}>
                                            {org.name} {org.vanityName ? `(@${org.vanityName})` : ''}
                                        </option>
                                    ))}
                                </select>
                                
                                {selectedLinkedinOrg && selectedLinkedinOrg !== 'personal' && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Posts will be published to: <span className="text-[#5ccfa2] font-semibold">
                                            {linkedinOrgs.find(o => o.urn === selectedLinkedinOrg)?.name || 'Organization'}
                                        </span>
                                    </p>
                                )}

                                {selectedLinkedinOrg === 'personal' && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Posts will be published to: <span className="text-[#5ccfa2] font-semibold">Your Personal Profile</span>
                                    </p>
                                )}

                                {!selectedLinkedinOrg && linkedinOrgs.length > 0 && (
                                    <p className="text-xs text-yellow-500 mt-2">
                                        ⚠️ Please select where you want to post before creating content
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}
                    
                    {/* CONTENT STUDIO TABS */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                        className="bg-[#10101d] p-8 rounded-xl shadow-2xl border border-gray-800 space-y-6"
                    >
                        <h2 className="text-2xl font-mono text-white border-b border-gray-700 pb-3">
                            What do you want to create?
                        </h2>

                        {/* Tab Buttons */}
                        <div className="flex space-x-4">
                            <button
                                onClick={() => setActiveTab('social')}
                                className={`flex-1 py-4 px-6 rounded-lg font-semibold transition-all flex items-center justify-center ${
                                    activeTab === 'social'
                                        ? 'bg-[#5ccfa2] text-black'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                            >
                                <Play className="w-5 h-5 mr-2" />
                                Social Post Generation
                            </button>

                            <button
                                onClick={() => setActiveTab('image')}
                                className={`flex-1 py-4 px-6 rounded-lg font-semibold transition-all flex items-center justify-center ${
                                    activeTab === 'image'
                                        ? 'bg-[#5ccfa2] text-black'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                            >
                                <ImageIcon className="w-5 h-5 mr-2" />
                                Image Only Generation
                            </button>

                            <button
                                onClick={() => setActiveTab('video')}
                                className={`flex-1 py-4 px-6 rounded-lg font-semibold transition-all flex items-center justify-center ${
                                    activeTab === 'video'
                                        ? 'bg-[#5ccfa2] text-black'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                            >
                                <Video className="w-5 h-5 mr-2" />
                                Video Generation
                            </button>
                        </div>

                        {/* Tab Content */}
                        <AnimatePresence mode="wait">
                            {activeTab === 'social' && (
                                <motion.div
                                    key="social"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="space-y-6 pt-4"
                                >
                                    <p className="text-sm text-gray-400 italic">
                                        Generate an image + caption tailored to a specific platform
                                    </p>

                                    {/* Prompt */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400 flex items-center">
                                            <Zap className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Prompt <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={socialPrompt}
                                            onChange={(e) => setSocialPrompt(e.target.value)}
                                            placeholder="Describe what you want to create..."
                                            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                            required
                                        />
                                    </div>

                                    {/* Platform Selection */}
                                    <div className="flex flex-col space-y-3">
                                        <label className="text-sm text-gray-400 font-semibold">
                                            Select platforms: <span className="text-red-500">*</span>
                                        </label>
                                        <div className="flex items-center space-x-6">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={generateFB}
                                                    onChange={(e) => setGenerateFB(e.target.checked)}
                                                    className="w-5 h-5 text-[#5ccfa2] bg-[#010112] border-gray-700 rounded focus:ring-[#5ccfa2]"
                                                />
                                                <Facebook className="w-6 h-6 text-blue-500" />
                                                <span className="text-white">Facebook</span>
                                            </label>

                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={generateIG}
                                                    onChange={(e) => setGenerateIG(e.target.checked)}
                                                    className="w-5 h-5 text-[#5ccfa2] bg-[#010112] border-gray-700 rounded focus:ring-[#5ccfa2]"
                                                />
                                                <Instagram className="w-6 h-6 text-pink-500" />
                                                <span className="text-white">Instagram</span>
                                            </label>

                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={generateLI}
                                                    onChange={(e) => setGenerateLI(e.target.checked)}
                                                    className="w-5 h-5 text-[#5ccfa2] bg-[#010112] border-gray-700 rounded focus:ring-[#5ccfa2]"
                                                />
                                                <Linkedin className="w-6 h-6 text-blue-700" />
                                                <span className="text-white">LinkedIn</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Reference Type Dropdown */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400 flex items-center">
                                            Reference (Optional)
                                        </label>
                                        <select
                                            value={socialReferenceType}
                                            onChange={(e) => {
                                                setSocialReferenceType(e.target.value as ReferenceType);
                                                setSocialReferenceUrl('');
                                                setSocialReferenceVideo('');
                                                setSocialReferenceImage('');
                                                setSocialReferenceArticle('');
                                            }}
                                            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                        >
                                            <option value="none">None</option>
                                            <option value="url">URL</option>
                                            <option value="video">Video</option>
                                            <option value="image">Image</option>
                                            <option value="article">Article Content</option>
                                        </select>
                                    </div>

                                    {/* Conditional Reference Input Fields */}
                                    {socialReferenceType === 'url' && (
                                        <div className="flex flex-col space-y-2">
                                            <label className="text-sm text-gray-400 flex items-center">
                                                <Link className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Website URL
                                            </label>
                                            <input
                                                type="url"
                                                value={socialReferenceUrl}
                                                onChange={(e) => setSocialReferenceUrl(e.target.value)}
                                                placeholder="https://example.com"
                                                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                            />
                                        </div>
                                    )}

                                    {socialReferenceType === 'video' && (
                                        <div className="flex flex-col space-y-2">
                                            <label className="text-sm text-gray-400 flex items-center">
                                                <Video className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Video URL
                                            </label>
                                            <input
                                                type="url"
                                                value={socialReferenceVideo}
                                                onChange={(e) => setSocialReferenceVideo(e.target.value)}
                                                placeholder="Only video URL supported"
                                                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                            />
                                        </div>
                                    )}

                                    {socialReferenceType === 'image' && (
                                        <div className="flex flex-col space-y-2">
                                            <label className="text-sm text-gray-400 flex items-center">
                                                <ImageIcon className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Image URL
                                            </label>
                                            <input
                                                type="url"
                                                value={socialReferenceImage}
                                                onChange={(e) => setSocialReferenceImage(e.target.value)}
                                                placeholder="https://example.com/image.jpg"
                                                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                            />
                                        </div>
                                    )}

                                    {socialReferenceType === 'article' && (
                                        <div className="flex flex-col space-y-2">
                                            <label className="text-sm text-gray-400 flex items-center">
                                                <FileText className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Article Content
                                            </label>
                                            <textarea
                                                value={socialReferenceArticle}
                                                onChange={(e) => setSocialReferenceArticle(e.target.value)}
                                                placeholder="Paste your article here"
                                                rows={6}
                                                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2] resize-none"
                                            />
                                        </div>
                                    )}

                                    {/* Category */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400">Category (Optional)</label>
                                        <input
                                            type="text"
                                            value={socialCategory}
                                            onChange={(e) => setSocialCategory(e.target.value)}
                                            placeholder="e.g., Marketing, Product, Announcement"
                                            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                        />
                                    </div>

                                    {/* Tags */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400">Tags (Optional, max 3)</label>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="text"
                                                value={socialTagInput}
                                                onChange={(e) => setSocialTagInput(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSocialTag())}
                                                placeholder="Add a tag and press Enter"
                                                disabled={socialTags.length >= 3}
                                                className="flex-1 bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2] disabled:opacity-50"
                                            />
                                            <button
                                                onClick={handleAddSocialTag}
                                                disabled={socialTags.length >= 3 || !socialTagInput.trim()}
                                                className="px-4 py-3 bg-[#5ccfa2] text-black rounded-lg hover:bg-[#45a881] disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                                            >
                                                Add
                                            </button>
                                        </div>
                                        {socialTags.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {socialTags.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="bg-[#5ccfa2] text-black px-3 py-1 rounded-full text-sm font-semibold flex items-center space-x-2"
                                                    >
                                                        <span>{tag}</span>
                                                        <X
                                                            className="w-4 h-4 cursor-pointer hover:text-red-600"
                                                            onClick={() => handleRemoveSocialTag(tag)}
                                                        />
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Content Type */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400">Content Type</label>
                                        <div className="flex items-center space-x-4">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="socialContentType"
                                                    checked={socialContentType === 'organic'}
                                                    onChange={() => setSocialContentType('organic')}
                                                    className="w-4 h-4 text-[#5ccfa2] bg-[#010112] border-gray-700 focus:ring-[#5ccfa2]"
                                                />
                                                <span className="text-white">Organic</span>
                                            </label>

                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="socialContentType"
                                                    checked={socialContentType === 'paid'}
                                                    onChange={() => setSocialContentType('paid')}
                                                    className="w-4 h-4 text-[#5ccfa2] bg-[#010112] border-gray-700 focus:ring-[#5ccfa2]"
                                                />
                                                <span className="text-white">Paid</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        onClick={handleSocialPostGeneration}
                                        disabled={socialLoading}
                                        className={`w-full px-8 py-3 rounded-xl font-bold transition-all flex items-center justify-center ${
                                            socialLoading
                                                ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                                                : 'bg-[#5ccfa2] text-black hover:bg-[#45a881]'
                                        }`}
                                    >
                                        {socialLoading ? (
                                            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                        ) : (
                                            <Zap className="w-5 h-5 mr-3" />
                                        )}
                                        {socialLoading ? 'Generating...' : 'Generate Social Post'}
                                    </button>
                                </motion.div>
                            )}

                            {activeTab === 'image' && (
                                <motion.div
                                    key="image"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="space-y-6 pt-4"
                                >
                                    <p className="text-sm text-gray-400 italic">
                                        Not sure if you want an image or video yet? Generate a standalone image and you can convert it into a social media image or video post later
                                    </p>

                                    {/* Prompt */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400 flex items-center">
                                            <Zap className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Prompt <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={imagePrompt}
                                            onChange={(e) => setImagePrompt(e.target.value)}
                                            placeholder="Describe the image you want to create..."
                                            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                            required
                                        />
                                    </div>

                                    {/* Reference Type Dropdown */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400 flex items-center">
                                            Reference (Optional)
                                        </label>
                                        <select
                                            value={imageReferenceType}
                                            onChange={(e) => {
                                                setImageReferenceType(e.target.value as ReferenceType);
                                                setImageReferenceUrl('');
                                                setImageReferenceVideo('');
                                                setImageReferenceImage('');
                                                setImageReferenceArticle('');
                                            }}
                                            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                        >
                                            <option value="none">None</option>
                                            <option value="url">URL</option>
                                            <option value="video">Video</option>
                                            <option value="image">Image</option>
                                            <option value="article">Article Content</option>
                                        </select>
                                    </div>

                                    {/* Conditional Reference Input Fields */}
                                    {imageReferenceType === 'url' && (
                                        <div className="flex flex-col space-y-2">
                                            <label className="text-sm text-gray-400 flex items-center">
                                                <Link className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Website URL
                                            </label>
                                            <input
                                                type="url"
                                                value={imageReferenceUrl}
                                                onChange={(e) => setImageReferenceUrl(e.target.value)}
                                                placeholder="https://example.com"
                                                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                            />
                                        </div>
                                    )}

                                    {imageReferenceType === 'video' && (
                                        <div className="flex flex-col space-y-2">
                                            <label className="text-sm text-gray-400 flex items-center">
                                                <Video className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Video URL
                                            </label>
                                            <input
                                                type="url"
                                                value={imageReferenceVideo}
                                                onChange={(e) => setImageReferenceVideo(e.target.value)}
                                                placeholder="Only video URL supported"
                                                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                            />
                                        </div>
                                    )}

                                    {imageReferenceType === 'image' && (
                                        <div className="flex flex-col space-y-2">
                                            <label className="text-sm text-gray-400 flex items-center">
                                                <ImageIcon className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Image URL
                                            </label>
                                            <input
                                                type="url"
                                                value={imageReferenceImage}
                                                onChange={(e) => setImageReferenceImage(e.target.value)}
                                                placeholder="https://example.com/image.jpg"
                                                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                            />
                                        </div>
                                    )}

                                    {imageReferenceType === 'article' && (
                                        <div className="flex flex-col space-y-2">
                                            <label className="text-sm text-gray-400 flex items-center">
                                                <FileText className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Article Content
                                            </label>
                                            <textarea
                                                value={imageReferenceArticle}
                                                onChange={(e) => setImageReferenceArticle(e.target.value)}
                                                placeholder="Paste your article here"
                                                rows={6}
                                                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2] resize-none"
                                            />
                                        </div>
                                    )}

                                    {/* Category */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400">Category (Optional)</label>
                                        <input
                                            type="text"
                                            value={imageCategory}
                                            onChange={(e) => setImageCategory(e.target.value)}
                                            placeholder="e.g., Marketing, Product, Announcement"
                                            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                        />
                                    </div>

                                    {/* Tags */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400">Tags (Optional, max 3)</label>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="text"
                                                value={imageTagInput}
                                                onChange={(e) => setImageTagInput(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddImageTag())}
                                                placeholder="Add a tag and press Enter"
                                                disabled={imageTags.length >= 3}
                                                className="flex-1 bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2] disabled:opacity-50"
                                            />
                                            <button
                                                onClick={handleAddImageTag}
                                                disabled={imageTags.length >= 3 || !imageTagInput.trim()}
                                                className="px-4 py-3 bg-[#5ccfa2] text-black rounded-lg hover:bg-[#45a881] disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                                            >
                                                Add
                                            </button>
                                        </div>
                                        {imageTags.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {imageTags.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="bg-[#5ccfa2] text-black px-3 py-1 rounded-full text-sm font-semibold flex items-center space-x-2"
                                                    >
                                                        <span>{tag}</span>
                                                        <X
                                                            className="w-4 h-4 cursor-pointer hover:text-red-600"
                                                            onClick={() => handleRemoveImageTag(tag)}
                                                        />
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        onClick={handleImageOnlyGeneration}
                                        disabled={imageLoading}
                                        className={`w-full px-8 py-3 rounded-xl font-bold transition-all flex items-center justify-center ${
                                            imageLoading
                                                ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                                                : 'bg-[#5ccfa2] text-black hover:bg-[#45a881]'
                                        }`}
                                    >
                                        {imageLoading ? (
                                            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                        ) : (
                                            <ImageIcon className="w-5 h-5 mr-3" />
                                        )}
                                        {imageLoading ? 'Generating...' : 'Generate Image'}
                                    </button>
                                </motion.div>
                            )}

                            {activeTab === 'video' && (
                                <motion.div
                                    key="video"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="space-y-6 pt-4"
                                >
                                    <p className="text-sm text-gray-400 italic">
                                        Generate a video for social media
                                    </p>

                                    {/* Video Source Selection */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400 font-semibold">Video Source</label>
                                        <div className="flex items-center space-x-4">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="videoSource"
                                                    checked={videoSource === 'text'}
                                                    onChange={() => setVideoSource('text')}
                                                    className="w-4 h-4 text-[#5ccfa2] bg-[#010112] border-gray-700 focus:ring-[#5ccfa2]"
                                                />
                                                <span className="text-white">Text-to-video</span>
                                            </label>

                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="videoSource"
                                                    checked={videoSource === 'image'}
                                                    onChange={() => setVideoSource('image')}
                                                    className="w-4 h-4 text-[#5ccfa2] bg-[#010112] border-gray-700 focus:ring-[#5ccfa2]"
                                                />
                                                <span className="text-white">Image-to-video</span>
                                            </label>
                                        </div>
                                    </div>

                                    {videoSource === 'text' ? (
                                        <>
                                            {/* Text-to-Video Prompt */}
                                            <div className="flex flex-col space-y-2">
                                                <label className="text-sm text-gray-400 flex items-center">
                                                    <Zap className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Prompt <span className="text-red-500 ml-1">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={videoPrompt}
                                                    onChange={(e) => setVideoPrompt(e.target.value)}
                                                    placeholder="Describe the video you want to create..."
                                                    className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                                    required
                                                />
                                            </div>

                                            {/* Reference Type Dropdown */}
                                            <div className="flex flex-col space-y-2">
                                                <label className="text-sm text-gray-400 flex items-center">
                                                    Reference (Optional)
                                                </label>
                                                <select
                                                    value={videoReferenceType}
                                                    onChange={(e) => {
                                                        setVideoReferenceType(e.target.value as ReferenceType);
                                                        setVideoReferenceUrl('');
                                                        setVideoReferenceVideo('');
                                                        setVideoReferenceImage('');
                                                        setVideoReferenceArticle('');
                                                    }}
                                                    className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                                >
                                                    <option value="none">None</option>
                                                    <option value="url">URL</option>
                                                    <option value="video">Video</option>
                                                    <option value="image">Image</option>
                                                    <option value="article">Article Content</option>
                                                </select>
                                            </div>

                                            {/* Conditional Reference Input Fields */}
                                            {videoReferenceType === 'url' && (
                                                <div className="flex flex-col space-y-2">
                                                    <label className="text-sm text-gray-400 flex items-center">
                                                        <Link className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Website URL
                                                    </label>
                                                    <input
                                                        type="url"
                                                        value={videoReferenceUrl}
                                                        onChange={(e) => setVideoReferenceUrl(e.target.value)}
                                                        placeholder="https://example.com"
                                                        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                                    />
                                                </div>
                                            )}

                                            {videoReferenceType === 'video' && (
                                                <div className="flex flex-col space-y-2">
                                                    <label className="text-sm text-gray-400 flex items-center">
                                                        <Video className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Video URL
                                                    </label>
                                                    <input
                                                        type="url"
                                                        value={videoReferenceVideo}
                                                        onChange={(e) => setVideoReferenceVideo(e.target.value)}
                                                        placeholder="Only video URL supported"
                                                        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                                    />
                                                </div>
                                            )}

                                            {videoReferenceType === 'image' && (
                                                <div className="flex flex-col space-y-2">
                                                    <label className="text-sm text-gray-400 flex items-center">
                                                        <ImageIcon className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Image URL
                                                    </label>
                                                    <input
                                                        type="url"
                                                        value={videoReferenceImage}
                                                        onChange={(e) => setVideoReferenceImage(e.target.value)}
                                                        placeholder="https://example.com/image.jpg"
                                                        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                                    />
                                                </div>
                                            )}

                                            {videoReferenceType === 'article' && (
                                                <div className="flex flex-col space-y-2">
                                                    <label className="text-sm text-gray-400 flex items-center">
                                                        <FileText className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Article Content
                                                    </label>
                                                    <textarea
                                                        value={videoReferenceArticle}
                                                        onChange={(e) => setVideoReferenceArticle(e.target.value)}
                                                        placeholder="Paste your article here"
                                                        rows={6}
                                                        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2] resize-none"
                                                    />
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {/* Image-to-Video */}
                                            <div className="flex flex-col space-y-2">
                                                <label className="text-sm text-gray-400">
                                                    Select Image Source
                                                </label>
                                                <input
                                                    type="text"
                                                    value={selectedImageForVideo}
                                                    onChange={(e) => setSelectedImageForVideo(e.target.value)}
                                                    placeholder="Paste image URL or upload"
                                                    className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                                />
                                                <p className="text-xs text-gray-500">
                                                    Don't have an image?{' '}
                                                    <span
                                                        onClick={scrollToImageTab}
                                                        className="text-[#5ccfa2] underline cursor-pointer hover:text-[#45a881]"
                                                    >
                                                        Generate one
                                                    </span>
                                                </p>
                                            </div>

                                            {/* Video Description */}
                                            <div className="flex flex-col space-y-2">
                                                <label className="text-sm text-gray-400 flex items-center">
                                                    <Zap className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Describe your video <span className="text-red-500 ml-1">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={videoImagePrompt}
                                                    onChange={(e) => setVideoImagePrompt(e.target.value)}
                                                    placeholder="e.g., Camera pans left to right, zoom into product"
                                                    className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                                    required
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* Orientation */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400 font-semibold">Orientation</label>
                                        <div className="flex items-center space-x-4">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="orientation"
                                                    checked={videoOrientation === '16:9'}
                                                    onChange={() => setVideoOrientation('16:9')}
                                                    className="w-4 h-4 text-[#5ccfa2] bg-[#010112] border-gray-700 focus:ring-[#5ccfa2]"
                                                />
                                                <span className="text-white">16:9 (Landscape)</span>
                                            </label>

                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="orientation"
                                                    checked={videoOrientation === '9:16'}
                                                    onChange={() => setVideoOrientation('9:16')}
                                                    className="w-4 h-4 text-[#5ccfa2] bg-[#010112] border-gray-700 focus:ring-[#5ccfa2]"
                                                />
                                                <span className="text-white">9:16 (Portrait)</span>
                                            </label>

                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="orientation"
                                                    checked={videoOrientation === '1:1'}
                                                    onChange={() => setVideoOrientation('1:1')}
                                                    className="w-4 h-4 text-[#5ccfa2] bg-[#010112] border-gray-700 focus:ring-[#5ccfa2]"
                                                />
                                                <span className="text-white">1:1 (Square)</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Duration */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400 font-semibold">Duration</label>
                                        <div className="flex items-center space-x-4">
                                            {(['5', '10', '15', '30'] as const).map((duration) => (
                                                <label key={duration} className="flex items-center space-x-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="duration"
                                                        checked={videoDuration === duration}
                                                        onChange={() => setVideoDuration(duration)}
                                                        className="w-4 h-4 text-[#5ccfa2] bg-[#010112] border-gray-700 focus:ring-[#5ccfa2]"
                                                    />
                                                    <span className="text-white">{duration}s</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Category */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400">Category (Optional)</label>
                                        <input
                                            type="text"
                                            value={videoCategory}
                                            onChange={(e) => setVideoCategory(e.target.value)}
                                            placeholder="e.g., Marketing, Product, Announcement"
                                            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                        />
                                    </div>

                                    {/* Tags */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400">Tags (Optional, max 3)</label>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="text"
                                                value={videoTagInput}
                                                onChange={(e) => setVideoTagInput(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVideoTag())}
                                                placeholder="Add a tag and press Enter"
                                                disabled={videoTags.length >= 3}
                                                className="flex-1 bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2] disabled:opacity-50"
                                            />
                                            <button
                                                onClick={handleAddVideoTag}
                                                disabled={videoTags.length >= 3 || !videoTagInput.trim()}
                                                className="px-4 py-3 bg-[#5ccfa2] text-black rounded-lg hover:bg-[#45a881] disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                                            >
                                                Add
                                            </button>
                                        </div>
                                        {videoTags.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {videoTags.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="bg-[#5ccfa2] text-black px-3 py-1 rounded-full text-sm font-semibold flex items-center space-x-2"
                                                    >
                                                        <span>{tag}</span>
                                                        <X
                                                            className="w-4 h-4 cursor-pointer hover:text-red-600"
                                                            onClick={() => handleRemoveVideoTag(tag)}
                                                        />
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        onClick={handleVideoGeneration}
                                        disabled={videoLoading}
                                        className={`w-full px-8 py-3 rounded-xl font-bold transition-all flex items-center justify-center ${
                                            videoLoading
                                                ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                                                : 'bg-[#5ccfa2] text-black hover:bg-[#45a881]'
                                        }`}
                                    >
                                        {videoLoading ? (
                                            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                        ) : (
                                            <Video className="w-5 h-5 mr-3" />
                                        )}
                                        {videoLoading ? 'Generating...' : 'Generate Video'}
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>
        </>
    );
};

export default ContentStudioPage;