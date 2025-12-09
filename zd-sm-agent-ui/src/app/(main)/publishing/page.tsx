'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Loader2, Zap, Link, Clock, Play, Facebook, Instagram, Linkedin, 
    LogIn, Check, Upload, FileText, AlertCircle, Video
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient'; 
import { useUserSession } from '@/hooks/use-user-session'; 
import { DateTime } from 'luxon';
import { authenticatedFetch } from '@/lib/api-client';

// TIRO-ONLY FEATURES - REMOVE THIS LINE WHEN GOING LIVE
//const TIRO_USER_ID = 'b88432ba-e049-4360-96d6-8c248d7446dc';

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

type ReferenceType = 'none' | 'url' | 'video' | 'article';

const TIMEZONES = [
    'Africa/Johannesburg', 'America/New_York', 'Europe/London', 'Asia/Tokyo', 
    'Australia/Sydney', 'America/Los_Angeles', 'Europe/Paris', 'Asia/Shanghai',
    'UTC',
];

const SOCIAL_PLATFORMS = [
    { name: 'Facebook', icon: Facebook, key: 'fb', color: 'bg-blue-600', loginUrl: '/api/facebook/login' },
    { name: 'Instagram', icon: Instagram, key: 'ig', color: 'bg-pink-600', loginUrl: '/api/instagram/login' },
    { name: 'LinkedIn', icon: Linkedin, key: 'li', color: 'bg-blue-800', loginUrl: '/api/linkedin/login' },
];

const PublishingPage = () => {
    const router = useRouter();
    const { user, loading: sessionLoading, session } = useUserSession(); 
    const userId = user?.id;
    const userDisplayName = user?.user_metadata?.display_name || user?.email || 'Architect-Agent';
    const jwtToken = session?.access_token || '';

    const [configs, setConfigs] = useState<Config | null>(null);
    const [userSocialProfiles, setUserSocialProfiles] = useState<Record<string, SocialProfile>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Image Generation Fields
    const [imagePrompt, setImagePrompt] = useState('');
    const [imageReferenceType, setImageReferenceType] = useState<ReferenceType>('none');
    const [imageReferenceUrl, setImageReferenceUrl] = useState('');
    const [imageReferenceVideo, setImageReferenceVideo] = useState('');
    const [imageReferenceArticle, setImageReferenceArticle] = useState('');
    const [onDemandFile, setOnDemandFile] = useState<File | null>(null);
    const [fileUploadWarning, setFileUploadWarning] = useState(false);
    const [onDemandLoading, setOnDemandLoading] = useState(false);
    
    // Platform Selection for Image Generation
    const [generateFB, setGenerateFB] = useState(false);
    const [generateIG, setGenerateIG] = useState(false);
    const [generateLI, setGenerateLI] = useState(false);
    const [imageContentType, setImageContentType] = useState<'organic' | 'paid'>('organic');
    
    // Video Generation Fields
    const [videoPrompt, setVideoPrompt] = useState('');
    const [videoReferenceType, setVideoReferenceType] = useState<ReferenceType>('none');
    const [videoReferenceUrl, setVideoReferenceUrl] = useState('');
    const [videoReferenceVideo, setVideoReferenceVideo] = useState('');
    const [videoReferenceArticle, setVideoReferenceArticle] = useState('');
    const [videoContentType, setVideoContentType] = useState<'organic' | 'paid'>('organic');
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
        } else {
            console.log('✅ Updated user_social_profiles with selected org:', selectedOrgData);
        }
        
        if (configs?.id) {
            const valueToSave = orgUrn === 'personal' ? null : orgUrn;
            
            const { error } = await supabase
                .from('client_configs')
                .update({ linkedin_organization_urn: valueToSave })
                .eq('id', configs.id);
            
            if (error) {
                console.error('Failed to save LinkedIn org selection:', error);
            } else {
                console.log('LinkedIn org saved:', orgUrn === 'personal' ? 'Personal Profile' : orgUrn);
            }
        }
    };

    const fetchSocialProfiles = async () => {
        if (!userId) return;

        try {
            const { data: socialProfile, error: socialError } = await supabase
                .from('user_social_profiles')
                .select('facebook_connected, instagram_connected, linkedin_connected, fb_token_expires_at, ig_token_expires_at, li_token_expires_at, linkedin_organizations')
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
                }
            };

            setUserSocialProfiles(profiles);
            
            const orgsData = (socialProfile as any)?.linkedin_organizations;
            if (orgsData && Array.isArray(orgsData) && orgsData.length > 0) {
                setLinkedinOrgs(orgsData);
            }

            console.log('[Publishing] Social profiles fetched:', profiles);
        } catch (err) {
            console.error('[Publishing] Failed to fetch social profiles:', err);
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
                console.log(`[Publishing] Received success message for platform: ${platformKey}`);
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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const fileType = file.name.split('.').pop()?.toLowerCase();
            
            if (fileType !== 'pdf' && fileType !== 'docx' && fileType !== 'doc') {
                alert('Please upload only PDF or Word documents (.pdf, .doc, .docx)');
                e.target.value = '';
                return;
            }
            
            setOnDemandFile(file);
            setFileUploadWarning(true);
        }
    };

    const uploadFileToStorage = async (file: File): Promise<{ url: string; type: string; name: string } | null> => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}_${Date.now()}.${fileExt}`;
            const filePath = fileName;

            const { error: uploadError } = await supabase.storage
                .from('one-time-uploads')
                .upload(filePath, file, { 
                    cacheControl: '3600', 
                    upsert: false 
                });

            if (uploadError) {
                console.error('File upload error:', uploadError);
                throw uploadError;
            }

            const { data: publicUrlData } = supabase.storage
                .from('one-time-uploads')
                .getPublicUrl(filePath);

            return {
                url: publicUrlData.publicUrl,
                type: fileExt || 'unknown',
                name: file.name
            };
        } catch (error) {
            console.error('Failed to upload file:', error);
            return null;
        }
    };

    const handleOnDemandPost = async () => {
        if (!clientConfigId) {
            alert("Client Config ID is missing.");
            return;
        }

        // Validation: Prompt is required
        if (!imagePrompt.trim()) {
            alert("Prompt is required.");
            return;
        }

        // Validation: At least one platform must be selected
        if (!generateFB && !generateIG && !generateLI) {
            alert("Please select at least one platform to generate content for.");
            return;
        }

        setOnDemandLoading(true);

        try {
            let fileData = null;
            
            if (onDemandFile) {
                fileData = await uploadFileToStorage(onDemandFile);
                if (!fileData) {
                    throw new Error('File upload failed');
                }
            }

            const payload = {
                clientConfigId,
                prompt: imagePrompt.trim(),
                referenceType: imageReferenceType,
                referenceUrl: imageReferenceType === 'url' ? imageReferenceUrl.trim() || null : null,
                referenceVideo: imageReferenceType === 'video' ? imageReferenceVideo.trim() || null : null,
                referenceArticle: imageReferenceType === 'article' ? imageReferenceArticle.trim() || null : null,
                oneTimeFile: fileData || null,
                generate_FB: generateFB,
                generate_IG: generateIG,
                generate_LI: generateLI,
                organic: imageContentType === 'organic',
                paid: imageContentType === 'paid',
            };

            console.log('[Publishing] Sending image generation payload:', payload);

            const response = await authenticatedFetch('/api/n8n/post-now', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Post Now API failed");
            }

            alert('Image generation request sent successfully!');
            setImagePrompt('');
            setImageReferenceType('none');
            setImageReferenceUrl('');
            setImageReferenceVideo('');
            setImageReferenceArticle('');
            setOnDemandFile(null);
            setGenerateFB(false);
            setGenerateIG(false);
            setGenerateLI(false);
            setFileUploadWarning(false);
        } catch (error) {
            console.error("On-Demand Post Error:", error);
            alert('Failed to send image generation request.');
        } finally {
            setOnDemandLoading(false);
        }
    };

    const handleVideoGeneration = async () => {
        if (!clientConfigId) {
            alert("Client Config ID is missing.");
            return;
        }

        // Validation: Prompt is required
        if (!videoPrompt.trim()) {
            alert("Video prompt is required.");
            return;
        }

        setVideoLoading(true);

        try {
            const payload = {
                clientConfigId,
                videoPrompt: videoPrompt.trim(),
                referenceType: videoReferenceType,
                referenceUrl: videoReferenceType === 'url' ? videoReferenceUrl.trim() || null : null,
                referenceVideo: videoReferenceType === 'video' ? videoReferenceVideo.trim() || null : null,
                referenceArticle: videoReferenceType === 'article' ? videoReferenceArticle.trim() || null : null,
                organic: videoContentType === 'organic',
                paid: videoContentType === 'paid',
            };

            console.log('[Publishing] Sending video generation payload:', payload);

            const response = await authenticatedFetch('/api/n8n/video-gen-on-demand', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Video generation API failed");
            }

            alert('Video generation request sent successfully!');
            setVideoPrompt('');
            setVideoReferenceType('none');
            setVideoReferenceUrl('');
            setVideoReferenceVideo('');
            setVideoReferenceArticle('');
        } catch (error) {
            console.error("Video Generation Error:", error);
            alert('Failed to send video generation request.');
        } finally {
            setVideoLoading(false);
        }
    };

    const handleScheduleSave = async () => {
        if (!configs || !userId) return;
        setIsSaving(true);

        try {
            const payload = {
                action: 'schedule',
                messageId: configs.id,
                time: configs.schedule_time,
                schedule_posts: configs.schedule_posts,
                token: jwtToken
            };

            const response = await authenticatedFetch('/api/schedule', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to schedule via QStash');
            }

            alert(`Schedule saved and QStash triggered successfully!`);
        } catch (err) {
            console.error('Schedule Save Error:', err);
            alert('Failed to save schedule. Check console.');
        } finally {
            setIsSaving(false);
        }
    };

    if (sessionLoading || isLoading || !configs) {
        return (
            <div className="min-h-screen flex justify-center items-center">
                <Loader2 className="w-10 h-10 animate-spin text-[#5ccfa2]" />
                <span className="ml-3 text-lg font-mono">Loading...</span> 
            </div>
        );
    }

    const nextScheduledTime = configs.schedule_posts 
        ? DateTime.local().setZone(configs.user_timezone).toISODate() + 'T' + configs.schedule_time 
        : null;

    return (
        <>
            <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-gray-800">
                    <div>
                        <h2 className="text-3xl font-mono text-white">Agent Publishing</h2>
                        <p className="text-sm text-gray-400 mt-1">Manage social media connections and set up scheduled or on-demand posting.</p>
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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                            transition={{ duration: 0.5, delay: 0.15 }}
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
                    
                    {/* ONE-TIME IMAGE POST GENERATION */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="bg-[#10101d] p-8 rounded-xl shadow-2xl border border-gray-800 space-y-6"
                    >
                        <h2 className="text-2xl font-mono text-white border-b border-gray-700 pb-3 flex items-center">
                            <Play className="w-6 h-6 mr-3 text-[#5ccfa2]" /> One-Time Image Post Generation
                        </h2>

                        <div className="space-y-6">
                            {/* Prompt - Required */}
                            <div className="flex flex-col space-y-2">
                                <label className="text-sm text-gray-400 flex items-center">
                                    <Zap className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Prompt <span className="text-red-500 ml-1">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={imagePrompt}
                                    onChange={(e) => setImagePrompt(e.target.value)}
                                    placeholder="Enter your content generation prompt (required)"
                                    className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                    required
                                />
                            </div>

                            {/* Reference Type Dropdown */}
                            <div className="flex flex-col space-y-2">
                                <label className="text-sm text-gray-400 flex items-center">
                                    What do you want to base your content on? (Optional)
                                </label>
                                <select
                                    value={imageReferenceType}
                                    onChange={(e) => {
                                        setImageReferenceType(e.target.value as ReferenceType);
                                        // Reset all reference fields when type changes
                                        setImageReferenceUrl('');
                                        setImageReferenceVideo('');
                                        setImageReferenceArticle('');
                                    }}
                                    className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                >
                                    <option value="none">None - Just use the prompt</option>
                                    <option value="url">Website URL</option>
                                    <option value="video">Video</option>
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
                                        placeholder="Insert link"
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
                                        placeholder="Insert a link to your video (only video links are currently accepted)"
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

                            <div className="flex flex-col space-y-2">
    <label className="text-sm text-gray-400 flex items-center">
        <Upload className="w-4 h-4 mr-2 text-[#5ccfa2]" /> File Upload (Optional)
    </label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx"
                                            onChange={handleFileSelect}
                                            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#5ccfa2] file:text-black hover:file:bg-[#45a881] cursor-pointer"
                                        />
                                        {onDemandFile && (
                                            <p className="text-xs text-gray-400 mt-2">
                                                Selected: {onDemandFile.name}
                                            </p>
                                        )}
                                    </div>
                                    <p className="text-xs text-yellow-500 italic flex items-center">
                                        <AlertCircle className="w-3 h-3 mr-1" />
                                        This feature is currently in beta.
                                    </p>
                                </div>
                            

                            {/* Content Type Dropdown */}
                            <div className="flex flex-col space-y-2">
                                <label className="text-sm text-gray-400 flex items-center">
                                    What's this image for?
                                </label>
                                <select
                                    value={imageContentType}
                                    onChange={(e) => setImageContentType(e.target.value as 'organic' | 'paid')}
                                    className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                >
                                    <option value="organic">Organic Social Media</option>
                                    <option value="paid">Paid Social Media</option>
                                </select>
                            </div>

                            {/* Platform Selection */}
                            <div className="flex flex-col space-y-3">
                                <label className="text-sm text-gray-400 font-semibold">
                                    Select which platforms you want to generate image content for:
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

                            {fileUploadWarning && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 flex items-start space-x-3"
                                >
                                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-yellow-200 font-semibold">File Upload Notice</p>
                                        <p className="text-xs text-yellow-300 mt-1">
                                            Your file will be uploaded and processed. This feature is in beta.
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            <button
                                onClick={handleOnDemandPost}
                                disabled={onDemandLoading}
                                className={`w-full px-8 py-3 rounded-xl font-bold transition-all flex items-center justify-center ${onDemandLoading ? 'bg-gray-500 text-gray-300 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
                            >
                                {onDemandLoading ? (
                                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                ) : (
                                    <Zap className="w-5 h-5 mr-3" />
                                )}
                                {onDemandLoading ? 'Sending Request...' : 'Generate Image Now'}
                            </button>
                        </div>
                    </motion.div>

                    
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.15 }}
                            className="bg-[#10101d] p-8 rounded-xl shadow-2xl border border-yellow-600 space-y-6"
                        >
                            <h2 className="text-2xl font-mono text-white border-b border-gray-700 pb-3 flex items-center">
                                <Video className="w-6 h-6 mr-3 text-yellow-500" /> One-Time Video Generation - TIRO ONLY
                            </h2>

                            <div className="space-y-6">
                                {/* Video Prompt - Required */}
                                <div className="flex flex-col space-y-2">
                                    <label className="text-sm text-gray-400 flex items-center">
                                        <Zap className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Video Prompt <span className="text-red-500 ml-1">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={videoPrompt}
                                        onChange={(e) => setVideoPrompt(e.target.value)}
                                        placeholder="Enter your video generation prompt (required)"
                                        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                        required
                                    />
                                </div>

                                {/* Reference Type Dropdown */}
                                <div className="flex flex-col space-y-2">
                                    <label className="text-sm text-gray-400 flex items-center">
                                        What do you want to base your video on? (Optional)
                                    </label>
                                    <select
                                        value={videoReferenceType}
                                        onChange={(e) => {
                                            setVideoReferenceType(e.target.value as ReferenceType);
                                            // Reset all reference fields when type changes
                                            setVideoReferenceUrl('');
                                            setVideoReferenceVideo('');
                                            setVideoReferenceArticle('');
                                        }}
                                        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                    >
                                        <option value="none">None - Just use the prompt</option>
                                        <option value="url">Website URL</option>
                                        <option value="video">Video</option>
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
                                            placeholder="Insert link"
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
                                            placeholder="Insert a link to your video (only video links are currently accepted)"
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

                                {/* Content Type Dropdown */}
                                <div className="flex flex-col space-y-2">
                                    <label className="text-sm text-gray-400 flex items-center">
                                        What's this video for?
                                    </label>
                                    <select
                                        value={videoContentType}
                                        onChange={(e) => setVideoContentType(e.target.value as 'organic' | 'paid')}
                                        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                    >
                                        <option value="organic">Organic Social Media</option>
                                        <option value="paid">Paid Social Media</option>
                                    </select>
                                </div>

                                <button
                                    onClick={handleVideoGeneration}
                                    disabled={videoLoading}
                                    className={`w-full px-8 py-3 rounded-xl font-bold transition-all flex items-center justify-center ${videoLoading ? 'bg-gray-500 text-gray-300 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                                >
                                    {videoLoading ? (
                                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                    ) : (
                                        <Video className="w-5 h-5 mr-3" />
                                    )}
                                    {videoLoading ? 'Generating Video...' : 'Generate Video Now'}
                                </button>
                            </div>
                        </motion.div>
                    

                    {/*  AUTOMATED SCHEDULING */}
                    
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="bg-[#10101d] p-8 rounded-xl shadow-2xl border border-gray-800 space-y-6"
                        >
                            <h2 className="text-2xl font-mono text-white border-b border-gray-700 pb-3 flex items-center">
                                <Clock className="w-6 h-6 mr-3 text-[#5ccfa2]" /> Automated Scheduling - TIRO ONLY
                            </h2>

                            <div className="flex flex-col space-y-4">
                                <label className="text-sm text-gray-400">Enable Scheduled Posting?</label>
                                <div className="flex items-center space-x-4">
                                    <div
                                        onClick={() => setConfigs(prev => prev ? { ...prev, schedule_posts: !prev.schedule_posts } : prev)}
                                        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${configs.schedule_posts ? 'bg-[#5ccfa2]' : 'bg-gray-500'}`}
                                    >
                                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${configs.schedule_posts ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>

                                    <input
                                        type="time"
                                        value={configs.schedule_time}
                                        onChange={(e) => setConfigs(prev => prev ? { ...prev, schedule_time: e.target.value } : prev)}
                                        className="bg-[#010112] border border-gray-700 text-white p-2 rounded-lg"
                                        style={{ colorScheme: 'dark' }}
                                    />

                                    <select
                                        value={configs.user_timezone}
                                        onChange={(e) => setConfigs(prev => prev ? { ...prev, user_timezone: e.target.value } : prev)}
                                        className="bg-[#010112] border border-gray-700 text-white p-2 rounded-lg"
                                    >
                                        {TIMEZONES.map(tz => (
                                            <option key={tz} value={tz}>{tz}</option>
                                        ))}
                                    </select>

                                    <button
                                        onClick={handleScheduleSave}
                                        disabled={isSaving}
                                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${isSaving ? 'bg-gray-500 cursor-not-allowed' : 'bg-[#5ccfa2] text-black hover:bg-[#45a881]'}`}
                                    >
                                        {isSaving ? 'Saving...' : 'Save Schedule'}
                                    </button>
                                </div>

                                {configs.schedule_posts && nextScheduledTime && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        Next scheduled post: {nextScheduledTime}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    
                </div>
            </div>
        </>
    );
};

export default PublishingPage;