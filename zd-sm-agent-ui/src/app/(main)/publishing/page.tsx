'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Loader2, Zap, Link, Clock, Play, Facebook, Instagram, Linkedin, 
    LogIn, Check, FileText, Video, Image as ImageIcon, X, Upload, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient'; 
import { useUserSession } from '@/hooks/use-user-session'; 
import { DateTime } from 'luxon';
import { authenticatedFetch } from '@/lib/api-client';
import { isAdmin } from '@/lib/adminCheck';

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
type ContentTab = 'social' | 'video';
type VideoSource = 'text' | 'image';
type Orientation = '16:9' | '9:16' | '1:1';
type VideoStyle = 'realism' | 'anime' | 'comic' | '3d_animated' | 'cinematic';
type VideoPurpose = 'social_ad' | 'product_demo' | 'informative' | 'promo' | 'tutorial';

const TikTokIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
);

const SOCIAL_PLATFORMS = [
    { name: 'Facebook', icon: Facebook, key: 'fb', color: 'bg-blue-600', loginUrl: '/api/facebook/login' },
    { name: 'Instagram', icon: Instagram, key: 'ig', color: 'bg-pink-600', loginUrl: '/api/instagram/login' },
    { name: 'LinkedIn', icon: Linkedin, key: 'li', color: 'bg-blue-800', loginUrl: '/api/linkedin/login' },
    { name: 'TikTok', icon: TikTokIcon, key: 'tt', color: 'bg-black', loginUrl: '/api/tiktok/login' },
];

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


// FILE UPLOAD OR URL COMPONENT
const FileUploadOrUrl: React.FC<{
    label: string;
    onUrl: (url: string) => void;
    acceptedTypes?: string;
    currentValue?: string;
}> = ({ label, onUrl, acceptedTypes = 'image/*,video/*', currentValue = '' }) => {
    const { user } = useUserSession();
    const [uploadType, setUploadType] = useState<'upload' | 'url'>('url');
    const [urlInput, setUrlInput] = useState(currentValue);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleFileUpload = async (file: File) => {
        if (!user?.id) {
            alert('User not authenticated');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            const timestamp = Date.now();
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
            const filePath = `${user.id}/${timestamp}-${sanitizedName}`;

            const { data, error } = await supabase.storage
                .from('reference-uploads')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            setUploadProgress(100);

            const { data: urlData } = supabase.storage
                .from('reference-uploads')
                .getPublicUrl(filePath);

            onUrl(urlData.publicUrl);
            alert('File uploaded successfully!');
        } catch (error: any) {
            console.error('[FileUpload] Error:', error);
            alert(`Upload failed: ${error.message}`);
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleUrlSubmit = () => {
        if (urlInput.trim()) {
            onUrl(urlInput.trim());
        }
    };

    return (
        <div className="flex flex-col space-y-3">
            <label className="text-sm text-gray-400">{label}</label>
            
            <div className="flex items-center space-x-4 mb-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                        type="radio"
                        checked={uploadType === 'upload'}
                        onChange={() => setUploadType('upload')}
                        className="w-4 h-4 text-[#5ccfa2] bg-[#010112] border-gray-700 focus:ring-[#5ccfa2]"
                    />
                    <span className="text-white text-sm">Upload File</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                        type="radio"
                        checked={uploadType === 'url'}
                        onChange={() => setUploadType('url')}
                        className="w-4 h-4 text-[#5ccfa2] bg-[#010112] border-gray-700 focus:ring-[#5ccfa2]"
                    />
                    <span className="text-white text-sm">Enter URL</span>
                </label>
            </div>

            {uploadType === 'upload' ? (
                <div>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-[#5ccfa2] bg-[#010112] transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {uploading ? (
                                <>
                                    <Loader2 className="w-10 h-10 mb-3 text-[#5ccfa2] animate-spin" />
                                    <p className="text-sm text-gray-400">Uploading... {uploadProgress}%</p>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-10 h-10 mb-3 text-gray-400" />
                                    <p className="mb-2 text-sm text-gray-400">
                                        <span className="font-semibold">Click to upload</span> or drag and drop
                                    </p>
                                    <p className="text-xs text-gray-500">Max 10MB</p>
                                </>
                            )}
                        </div>
                        <input
                            type="file"
                            className="hidden"
                            accept={acceptedTypes}
                            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                            disabled={uploading}
                        />
                    </label>
                </div>
            ) : (
                <div className="flex items-center space-x-2">
                    <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="flex-1 bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                    />
                    <button
                        onClick={handleUrlSubmit}
                        disabled={!urlInput.trim()}
                        className="px-4 py-3 bg-[#5ccfa2] text-black rounded-lg hover:bg-[#45a881] disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"
                    >
                        Set
                    </button>
                </div>
            )}
        </div>
    );
};

// GENERATE IMAGE MODAL FOR VIDEO SOURCE
const GenerateImageModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (prompt: string, style: VideoStyle, purpose: VideoPurpose) => void;
    loading: boolean;
}> = ({ isOpen, onClose, onGenerate, loading }) => {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState<VideoStyle>('realism');
    const [purpose, setPurpose] = useState<VideoPurpose>('social_ad');

    const handleGenerate = () => {
        if (!prompt.trim()) {
            alert('Please enter a prompt');
            return;
        }
        onGenerate(prompt, style, purpose);
    };

    if (!isOpen) return null;

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
                    <div className="flex items-center justify-between p-4 border-b border-gray-800">
                        <h2 className="text-lg font-bold text-white">Generate Video Source Image</h2>
                        <button onClick={onClose} className="p-2 rounded-lg bg-transparent hover:bg-gray-800 transition-colors">
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Style *</label>
                            <select
                                value={style}
                                onChange={(e) => setStyle(e.target.value as VideoStyle)}
                                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                            >
                                {VIDEO_STYLES.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Purpose *</label>
                            <select
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value as VideoPurpose)}
                                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                            >
                                {VIDEO_PURPOSES.map(p => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Prompt *</label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Describe the image you want to generate..."
                                rows={4}
                                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2] resize-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-800">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={loading || !prompt.trim()}
                            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center ${
                                loading || !prompt.trim()
                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                    : 'bg-[#5ccfa2] text-black hover:bg-[#45a881]'
                            }`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                'Generate Image'
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};


const ContentStudioPage = () => {
    const router = useRouter();
    const { user, loading: sessionLoading, session } = useUserSession(); 
    const userId = user?.id;
    const isAdminUser = isAdmin(user?.id); //- making video gen tab available only to admin users
    const jwtToken = session?.access_token || '';

    const [configs, setConfigs] = useState<Config | null>(null);
    const [userSocialProfiles, setUserSocialProfiles] = useState<Record<string, SocialProfile>>({});
    const [isLoading, setIsLoading] = useState(true);
    
    // Tab State
    const [activeTab, setActiveTab] = useState<ContentTab>('social');
    
    // Social Post Fields
    const [socialStyle, setSocialStyle] = useState<VideoStyle>('realism');
    const [socialPrompt, setSocialPrompt] = useState('');
    const [socialReferenceType, setSocialReferenceType] = useState<ReferenceType>('none');
    const [socialReferenceUrl, setSocialReferenceUrl] = useState('');
    const [socialReferenceVideo, setSocialReferenceVideo] = useState('');
    const [socialReferenceImage, setSocialReferenceImage] = useState('');
    const [socialReferenceArticle, setSocialReferenceArticle] = useState('');
    const [socialContentType, setSocialContentType] = useState<'organic' | 'paid'>('organic');
    const [socialWebSearch, setSocialWebSearch] = useState(false);
    const [generateFB, setGenerateFB] = useState(false);
    const [generateIG, setGenerateIG] = useState(false);
    const [generateLI, setGenerateLI] = useState(false);
    const [socialLoading, setSocialLoading] = useState(false);
    
    // Video Fields
    const [videoSource, setVideoSource] = useState<VideoSource>('text');
    const [videoStyle, setVideoStyle] = useState<VideoStyle>('realism');
    const [videoPurpose, setVideoPurpose] = useState<VideoPurpose>('social_ad');
    const [videoPrompt, setVideoPrompt] = useState('');
    const [videoReferenceType, setVideoReferenceType] = useState<ReferenceType>('none');
    const [videoReferenceUrl, setVideoReferenceUrl] = useState('');
    const [videoReferenceVideo, setVideoReferenceVideo] = useState('');
    const [videoReferenceImage, setVideoReferenceImage] = useState('');
    const [videoReferenceArticle, setVideoReferenceArticle] = useState('');
    const [selectedImageForVideo, setSelectedImageForVideo] = useState('');
    const [videoOrientation, setVideoOrientation] = useState<Orientation>('9:16');
    const [videoDuration, setVideoDuration] = useState<'5' | '10' | '15' | '30'>('5');
    const [videoLoading, setVideoLoading] = useState(false);
    const [showGenerateImageModal, setShowGenerateImageModal] = useState(false);
    const [generateImageLoading, setGenerateImageLoading] = useState(false);
    
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

    const handleSocialLogin = async (platformKey: string, loginUrl: string) => {
        if (!userId) {
            alert('User ID not found');
            return;
        }

        try {
            const response = await fetch(`${loginUrl}?userId=${userId}`);
            const data = await response.json();

            if (!data.success || !data.authUrl) {
                alert('Failed to generate login URL');
                console.error('Login API error:', data);
                return;
            }

            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;

            const popup = window.open(
                data.authUrl,
                'social-login',
                `width=${width},height=${height},top=${top},left=${left}`
            );

            if (!popup) {
                alert('Popup blocked! Please allow popups for this site.');
                return;
            }

            const handleMessage = (event: MessageEvent) => {
                if (event.origin !== window.location.origin) return;
                
                if (event.data.success && event.data.platform === platformKey) {
                    console.log(`[${platformKey}] Connected successfully!`);
                    fetchSocialProfiles();
                    window.removeEventListener('message', handleMessage);
                } else if (event.data.error) {
                    console.error(`[${platformKey}] Login error:`, event.data.error);
                    alert(`${platformKey} login failed: ${event.data.error}`);
                    window.removeEventListener('message', handleMessage);
                }
            };

            window.addEventListener('message', handleMessage);

            setTimeout(() => {
                window.removeEventListener('message', handleMessage);
            }, 5 * 60 * 1000);

        } catch (error) {
            console.error(`[${platformKey}] Login error:`, error);
            alert('Failed to initiate login');
        }
    };
    // SOCIAL POST GENERATION
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
                            style: socialStyle,
                            referenceType: socialReferenceType,
                            referenceUrl: socialReferenceType === 'url' ? socialReferenceUrl.trim() || null : null,
                            referenceVideo: socialReferenceType === 'video' ? socialReferenceVideo.trim() || null : null,
                            referenceImage: socialReferenceType === 'image' ? socialReferenceImage.trim() || null : null,
                            referenceArticle: socialReferenceType === 'article' ? socialReferenceArticle.trim() || null : null,
                            generate_FB: generateFB,
                            generate_IG: generateIG,
                            generate_LI: generateLI,
                            organic: socialContentType === 'organic',
                            paid: socialContentType === 'paid',
                            web_search: socialReferenceType === 'none' && socialWebSearch, // Only true if reference is none AND checkbox checked
                        };

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
            setGenerateFB(false);
            setGenerateIG(false);
            setGenerateLI(false);
            setSocialWebSearch(false);
        } catch (error) {
            console.error("Social Post Generation Error:", error);
            alert('Failed to send social post generation request.');
        } finally {
            setSocialLoading(false);
        }
    };

    // VIDEO GENERATION
    const handleVideoGeneration = async () => {
        if (!clientConfigId) {
            alert("Client Config ID is missing.");
            return;
        }

        if (videoSource === 'text' && !videoPrompt.trim()) {
            alert("Video prompt is required.");
            return;
        }

        if (videoSource === 'image' && !selectedImageForVideo.trim()) {
            alert("Please select an image source.");
            return;
        }

        setVideoLoading(true);

        try {
            const payload = {
                clientConfigId,
                videoSource,
                prompt: videoSource === 'text' ? videoPrompt.trim() : 'Motion description',
                style: videoStyle,
                purpose: videoPurpose,
                referenceType: videoSource === 'text' ? videoReferenceType : 'none',
                referenceUrl: videoSource === 'text' && videoReferenceType === 'url' ? videoReferenceUrl.trim() || null : null,
                referenceVideo: videoSource === 'text' && videoReferenceType === 'video' ? videoReferenceVideo.trim() || null : null,
                referenceImage: videoSource === 'text' && videoReferenceType === 'image' ? videoReferenceImage.trim() || null : null,
                referenceArticle: videoSource === 'text' && videoReferenceType === 'article' ? videoReferenceArticle.trim() || null : null,
                sourceImage: videoSource === 'image' ? selectedImageForVideo : null,
                orientation: videoOrientation,
                duration: videoDuration,
            };

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
            setVideoReferenceType('none');
            setVideoReferenceUrl('');
            setVideoReferenceVideo('');
            setVideoReferenceImage('');
            setVideoReferenceArticle('');
            setSelectedImageForVideo('');
        } catch (error) {
            console.error("Video Generation Error:", error);
            alert('Failed to send video generation request.');
        } finally {
            setVideoLoading(false);
        }
    };

    // GENERATE VIDEO SOURCE IMAGE
    const handleGenerateVideoSourceImage = async (prompt: string, style: VideoStyle, purpose: VideoPurpose) => {
        if (!clientConfigId) {
            alert("Client Config ID is missing.");
            return;
        }

        setGenerateImageLoading(true);

        try {
            const payload = {
                clientConfigId,
                prompt: prompt.trim(),
                style,
                purpose,
                action: 'generate-video-source',
            };

            const response = await authenticatedFetch('/api/n8n/generate-video-source', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Image generation failed");
            }

            alert('Video source image is being generated! Check your dashboard in 1-2 minutes.');
            setShowGenerateImageModal(false);
        } catch (error: any) {
            console.error("Generate Image Error:", error);
            alert(`Failed to generate image: ${error.message}`);
        } finally {
            setGenerateImageLoading(false);
        }
    };
    // ========================================================================
    // PART 3: UI RENDERING
    // ========================================================================
    // Add this after Part 2 (handler functions)
    
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
                        <p className="text-sm text-gray-400 mt-1">Create social posts and videos for your brand.</p>
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
                                    ? (platform.key === 'tt' 
                                        ? DateTime.fromISO(profile.token_expiry)
                                        : DateTime.fromISO(profile.token_expiry).minus({ days: 5 }))
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
                                                <div className="flex flex-col space-y-1 w-full mt-2 text-xs text-gray-300 px-1">
                                                    {platform.key === 'tt' && (
                                                        <p className="text-yellow-400 text-xs italic">
                                                            TikTok tokens expire every 24 hours. We'll refresh automatically when you publish.
                                                        </p>
                                                    )}
                                                    <div className="flex justify-between w-full">
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

                        {/* Tab Buttons - ONLY 2 TABS */}
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

{/*START- MAKING VIDEO TAB RENDER ONLY FOR TIRO ID - REMOVE '{isAdmin && (' AND '(Admin)' WHEN OPEN TO ALL USERS*/}  
                          {isAdminUser && ( 
        <button
            onClick={() => setActiveTab('video')}
            className={`flex-1 py-4 px-6 rounded-lg font-semibold transition-all flex items-center justify-center ${
                activeTab === 'video'
                    ? 'bg-[#5ccfa2] text-black'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
        >
            <Video className="w-5 h-5 mr-2" />
            Video Generation (Admin)
        </button>
    )}
</div> 
{/*END - MAKING VIDEO TAB RENDER ONLY FOR TIRO ID - REMOVE '{isAdmin && (' AND '(Admin)' WHEN OPEN TO ALL USERS*/}

                        {/* Tab Content */}
                        <AnimatePresence mode="wait">
                            {/* ============================================ */}
                            {/* SOCIAL POST TAB */}
                            {/* ============================================ */}
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

                                    {/* Style Dropdown - NEW */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400 flex items-center">
                                            Style <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <select
                                            value={socialStyle}
                                            onChange={(e) => setSocialStyle(e.target.value as VideoStyle)}
                                            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                        >
                                            {VIDEO_STYLES.map(s => (
                                                <option key={s.value} value={s.value}>{s.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Prompt */}
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-sm text-gray-400 flex items-center">
                                            <Zap className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Prompt <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <textarea
                                            value={socialPrompt}
                                            onChange={(e) => setSocialPrompt(e.target.value)}
                                            placeholder="Describe what you want to create..."
                                            rows={4}
                                            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2] resize-none"
                                            required
                                        />
                                    </div>

                                    {/* Web Search Checkbox - Only when reference is 'none' */}
                                        {socialReferenceType === 'none' && (
                                            <label className="flex items-center space-x-3 cursor-pointer -mt-2">
                                                <input
                                                    type="checkbox"
                                                    checked={socialWebSearch}
                                                    onChange={(e) => setSocialWebSearch(e.target.checked)}
                                                    className="w-5 h-5 rounded border-2 border-gray-600 bg-[#010112] text-[#5ccfa2] focus:ring-2 focus:ring-[#5ccfa2] focus:ring-offset-0 checked:bg-[#5ccfa2] checked:border-[#5ccfa2] transition-all cursor-pointer"
                                                />
                                                <span className="text-sm text-gray-400">
                                                    Enable web search
                                                </span>
                                            </label>
                                        )}

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
                                                    // Disable web search if reference is not 'none'
                                                    if (e.target.value !== 'none') {
                                                        setSocialWebSearch(false);
                                                    }
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

                                    

                                    {/* Conditional Reference Fields */}
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
                                        <FileUploadOrUrl
                                            label="Video Reference"
                                            onUrl={(url) => setSocialReferenceVideo(url)}
                                            acceptedTypes="video/*"
                                            currentValue={socialReferenceVideo}
                                        />
                                    )}

                                    {socialReferenceType === 'image' && (
                                        <FileUploadOrUrl
                                            label="Image Reference"
                                            onUrl={(url) => setSocialReferenceImage(url)}
                                            acceptedTypes="image/*"
                                            currentValue={socialReferenceImage}
                                        />
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

                            {/* ============================================ */}
                            {/* VIDEO TAB */}
                            {/* ============================================ */}
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
                                            {/* TEXT-TO-VIDEO FIELDS */}
                                            
                                            {/* Style */}
                                            <div className="flex flex-col space-y-2">
                                                <label className="text-sm text-gray-400 flex items-center">
                                                    Style <span className="text-red-500 ml-1">*</span>
                                                </label>
                                                <select
                                                    value={videoStyle}
                                                    onChange={(e) => setVideoStyle(e.target.value as VideoStyle)}
                                                    className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                                >
                                                    {VIDEO_STYLES.map(s => (
                                                        <option key={s.value} value={s.value}>{s.label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Purpose */}
                                            <div className="flex flex-col space-y-2">
                                                <label className="text-sm text-gray-400 flex items-center">
                                                    Purpose <span className="text-red-500 ml-1">*</span>
                                                </label>
                                                <select
                                                    value={videoPurpose}
                                                    onChange={(e) => setVideoPurpose(e.target.value as VideoPurpose)}
                                                    className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                                >
                                                    {VIDEO_PURPOSES.map(p => (
                                                        <option key={p.value} value={p.value}>{p.label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Prompt */}
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

                                            {/* Conditional Reference Fields */}
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
                                                <FileUploadOrUrl
                                                    label="Video Reference"
                                                    onUrl={(url) => setVideoReferenceVideo(url)}
                                                    acceptedTypes="video/*"
                                                    currentValue={videoReferenceVideo}
                                                />
                                            )}

                                            {videoReferenceType === 'image' && (
                                                <FileUploadOrUrl
                                                    label="Image Reference"
                                                    onUrl={(url) => setVideoReferenceImage(url)}
                                                    acceptedTypes="image/*"
                                                    currentValue={videoReferenceImage}
                                                />
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
                                            {/* IMAGE-TO-VIDEO FIELDS */}
                                            
                                            {/* Image Source */}
                                            <FileUploadOrUrl
                                                label="Source Image *"
                                                onUrl={(url) => setSelectedImageForVideo(url)}
                                                acceptedTypes="image/*"
                                                currentValue={selectedImageForVideo}
                                            />

                                            {/* Generate One Button */}
                                            <div className="flex justify-center">
                                                <button
                                                    onClick={() => setShowGenerateImageModal(true)}
                                                    className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors flex items-center"
                                                >
                                                    <ImageIcon className="w-4 h-4 mr-2" />
                                                    Don't have an image? Generate One
                                                </button>
                                            </div>

                                            {/* Style */}
                                            <div className="flex flex-col space-y-2">
                                                <label className="text-sm text-gray-400 flex items-center">
                                                    Style <span className="text-red-500 ml-1">*</span>
                                                </label>
                                                <select
                                                    value={videoStyle}
                                                    onChange={(e) => setVideoStyle(e.target.value as VideoStyle)}
                                                    className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                                >
                                                    {VIDEO_STYLES.map(s => (
                                                        <option key={s.value} value={s.value}>{s.label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Purpose */}
                                            <div className="flex flex-col space-y-2">
                                                <label className="text-sm text-gray-400 flex items-center">
                                                    Purpose <span className="text-red-500 ml-1">*</span>
                                                </label>
                                                <select
                                                    value={videoPurpose}
                                                    onChange={(e) => setVideoPurpose(e.target.value as VideoPurpose)}
                                                    className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                                >
                                                    {VIDEO_PURPOSES.map(p => (
                                                        <option key={p.value} value={p.value}>{p.label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Motion Description */}
                                            <div className="flex flex-col space-y-2">
                                                <label className="text-sm text-gray-400 flex items-center">
                                                    <Zap className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Describe the motion <span className="text-red-500 ml-1">*</span>
                                                </label>
                                                <textarea
                                                    value={videoPrompt}
                                                    onChange={(e) => setVideoPrompt(e.target.value)}
                                                    placeholder="e.g., Camera slowly zooms in while gentle wind blows"
                                                    rows={3}
                                                    className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2] resize-none"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* Orientation - SHARED */}
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

                                    {/* Duration - SHARED */}
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

            {/* Generate Image Modal */}
            <GenerateImageModal
                isOpen={showGenerateImageModal}
                onClose={() => setShowGenerateImageModal(false)}
                onGenerate={handleGenerateVideoSourceImage}
                loading={generateImageLoading}
            />
        </>
    );
};

export default ContentStudioPage;