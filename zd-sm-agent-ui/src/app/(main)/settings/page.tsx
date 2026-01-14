'use client';

import React, { useState, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Loader2, Save, Upload, CheckCircle, AlertTriangle, XCircle, 
    Palette, Target, Briefcase, FileText, Globe, Key, Link as LinkIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient'; 
import { useUserSession } from '@/hooks/use-user-session';

type Config = {
    id: string | null; 
    company_name: string;
    company_website: string;
    company_description: string;
    logo_url: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    brand_tone: string[];
    target_audience: string;
    company_industry: string;
    privacy_policy_url: string;
};

type SocialProfile = {
    google_connected: boolean;
    google_email: string | null;
};

const BRAND_TONES = [
    'Professional', 'Witty', 'Casual', 'Luxury', 'Technical', 
    'Empathetic', 'Authoritative', 'Minimalist', 'Inspirational', 'Sarcastic'
];

const INDUSTRIES = [
    'Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 
    'Manufacturing', 'Real Estate', 'Marketing', 'Hospitality', 'Construction'
];

const ensureArray = (value: any): string[] => {
    if (Array.isArray(value)) return value;
    return [];
};

const ColorPicker: React.FC<{ 
    label: string; 
    color: string; 
    onChange: (newColor: string) => void 
}> = ({ label, color, onChange }) => (
    <div className="flex flex-col space-y-2">
        <label className="text-sm text-gray-400 flex items-center">
            <Palette className="w-4 h-4 mr-2 text-[#5ccfa2]" /> {label}
        </label>
        <div className="flex items-center space-x-3">
            <input 
                type="color" 
                value={color} 
                onChange={(e) => onChange(e.target.value)}
                className="w-10 h-10 rounded-full border-none p-0 cursor-pointer"
            />
            <input 
                type="text" 
                value={color} 
                onChange={(e) => onChange(e.target.value)}
                className="bg-[#10101d] border border-gray-700 rounded-lg p-2 text-sm text-white font-mono w-24 focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
            />
        </div>
    </div>
);

const MultiSelectDropdown: React.FC<{ 
    label: string; 
    options: string[]; 
    selected: string[]; 
    onChange: (newSelection: string[]) => void 
}> = ({ label, options, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const handleSelect = (option: string) => {
        const newSelection = selected.includes(option)
            ? selected.filter(s => s !== option)
            : [...selected, option];
        onChange(newSelection);
    };

    return (
        <div className="relative">
            <label className="text-sm text-gray-400 mb-2 flex items-center">
                <Briefcase className="w-4 h-4 mr-2 text-[#5ccfa2]" /> {label}
            </label>
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-[#10101d] border border-gray-700 text-white rounded-lg p-3 text-left transition-all hover:border-[#5ccfa2] flex justify-between items-center"
            >
                {selected.length > 0 ? selected.join(', ') : `Select ${label}`}
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    ▼
                </motion.div>
            </button>

            {isOpen && (
                <div className="absolute z-30 mt-1 w-full rounded-md shadow-lg bg-[#10101d] border border-gray-700 max-h-60 overflow-y-auto">
                    {options.map(option => (
                        <div
                            key={option}
                            onClick={() => handleSelect(option)}
                            className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-700 flex justify-between items-center ${
                                selected.includes(option) ? 'text-[#5ccfa2] font-semibold' : 'text-gray-300'
                            }`}
                        >
                            {option}
                            {selected.includes(option) && <CheckCircle className="w-4 h-4" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const SettingsPage = () => {
    const router = useRouter();
    const { user, loading: sessionLoading } = useUserSession(); 
    const userId = user?.id;

    const [activeTab, setActiveTab] = useState<'company' | 'integrations'>('company');
    const [configs, setConfigs] = useState<Config | null>(null);
    const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [selectedIndustry, setSelectedIndustry] = useState('');
    const [customIndustry, setCustomIndustry] = useState('');
    
    // API Keys
    const [openaiKey, setOpenaiKey] = useState('');
    const [geminiKey, setGeminiKey] = useState('');

    useEffect(() => {
        if (sessionLoading || !userId) return;

        const fetchData = async () => {
            setIsLoading(true);
            
            // Fetch client configs
            const { data: clientData, error: clientError } = await supabase
                .from('client_configs')
                .select('*')
                .eq('client_id', userId)
                .single();

            if (clientError && clientError.code !== 'PGRST116') {
                console.error("Error fetching client configs:", clientError);
            }

            if (clientData) {
                setConfigs({
                    id: clientData.id,
                    company_name: clientData.company_name || '',
                    company_website: clientData.company_website || '',
                    company_description: clientData.company_description || '',
                    logo_url: clientData.logo_url || '',
                    primary_color: clientData.primary_color || '#3B82F6',
                    secondary_color: clientData.secondary_color || '#FFFFFF',
                    accent_color: clientData.accent_color || '#10B981',
                    brand_tone: ensureArray(clientData.brand_tone),
                    target_audience: clientData.target_audience || '',
                    company_industry: clientData.company_industry || '',
                    privacy_policy_url: clientData.privacy_policy_url || '',
                }); 

                // Set industry state
                if (clientData.company_industry) {
                    if (INDUSTRIES.includes(clientData.company_industry)) {
                        setSelectedIndustry(clientData.company_industry);
                    } else {
                        setSelectedIndustry('Other');
                        setCustomIndustry(clientData.company_industry);
                    }
                }
            } else {
                setConfigs({
                    id: null,
                    company_name: '', 
                    company_website: '',
                    company_description: '',
                    logo_url: '', 
                    target_audience: '', 
                    primary_color: '#3B82F6', 
                    secondary_color: '#FFFFFF', 
                    accent_color: '#10B981',
                    brand_tone: [], 
                    company_industry: '',
                    privacy_policy_url: '',
                });
            }

            // Fetch social profile (Google)
            const { data: socialData } = await supabase
                .from('user_social_profiles')
                .select('google_connected, google_email')
                .eq('client_id', userId)
                .single();

            if (socialData) {
                setSocialProfile(socialData);
            }

            // Fetch API keys
            const { data: keysData } = await supabase
                .from('api_keys')
                .select('openai_key, gemini_key')
                .eq('user_id', userId)
                .single();

            if (keysData) {
                setOpenaiKey(keysData.openai_key || '');
                setGeminiKey(keysData.gemini_key || '');
            }

            setIsLoading(false);
        };

        fetchData();
    }, [userId, sessionLoading]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (!configs) return;
        const { name, value } = e.target;
        setConfigs({ ...configs, [name]: value });
    };

    const handleLogoSelect = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setLogoFile(e.target.files[0]);
        }
    };
    
    const uploadLogo = async (): Promise<string | null> => {
        if (!logoFile) return configs?.logo_url || null;
        
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${userId}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error } = await supabase.storage
            .from('logos')
            .upload(filePath, logoFile, { cacheControl: '3600', upsert: true });

        if (error) {
            console.error("Logo upload failed:", error);
            setSaveStatus('failed');
            return null;
        }

        const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(filePath);
        return publicUrlData.publicUrl;
    };

    // Save Company & Branding settings
const handleSaveSettings = async () => {
  if (!configs || !userId) return;
  
  setIsSaving(true);
  setSaveStatus('idle');
  
  try {
    const newLogoUrl = await uploadLogo();
    if (logoFile && !newLogoUrl) {
      throw new Error("Logo upload failed.");
    }
    
    const dataToSave = {
      client_id: userId,
      company_name: configs.company_name || null,
      company_website: configs.company_website || null,
      company_description: configs.company_description || null,
      logo_url: newLogoUrl || configs.logo_url || null,
      primary_color: configs.primary_color,
      secondary_color: configs.secondary_color,
      accent_color: configs.accent_color,
      brand_tone: configs.brand_tone || null,
      target_audience: configs.target_audience || null,
      company_industry: selectedIndustry === 'Other' ? customIndustry : selectedIndustry || null,
      privacy_policy_url: configs.privacy_policy_url || null,
    };
    
    const { error: configError } = await supabase
      .from('client_configs')
      .upsert(dataToSave, { onConflict: 'client_id' });

    if (configError) throw configError;

    setSaveStatus('saved');
  } catch (e) {
    console.error("Settings save failed:", e);
    setSaveStatus('failed');
  } finally {
    setIsSaving(false);
    setTimeout(() => setSaveStatus('idle'), 3000); 
  }
};

// Save Connections (API keys)
const handleSaveConnections = async () => {
  if (!userId) return;
  
  setIsSaving(true);
  setSaveStatus('idle');
  
  try {
    const { error: keysError } = await supabase
      .from('user_api_keys')
      .upsert({
        user_id: userId,
        openai_key: openaiKey || null,
        gemini_key: geminiKey || null
      }, { onConflict: 'user_id' });

    if (keysError) throw keysError;

    setSaveStatus('saved');
  } catch (e) {
    console.error("Connections save failed:", e);
    setSaveStatus('failed');
  } finally {
    setIsSaving(false);
    setTimeout(() => setSaveStatus('idle'), 3000); 
  }
};

    const handleConnectGoogle = () => {
        if (!userId) return;
        window.location.href = `/api/google/connect?userId=${userId}`;
    };

    const handleDisconnectGoogle = async () => {
        if (!confirm('Disconnect Google account? You will no longer be able to create forms.')) return;

        try {
            const { error } = await supabase
                .from('user_social_profiles')
                .update({
                    google_connected: false,
                    google_user_id: null,
                    google_email: null,
                    google_name: null,
                    google_access_token: null,
                    google_refresh_token: null,
                    google_token_expires_at: null
                })
                .eq('client_id', userId);

            if (error) throw error;

            setSocialProfile({ google_connected: false, google_email: null });
            alert('Google account disconnected');
        } catch (error: any) {
            alert(`Failed to disconnect: ${error.message}`);
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
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-gray-800">
                <div>
                    <h2 className="text-3xl font-mono text-white">Settings</h2>
                    <p className="text-sm text-gray-400 mt-1">Manage your company profile, branding, and integrations</p>
                </div>
            </div>

            {/* TABS */}
            <div className="flex space-x-1 bg-[#10101d] p-1 rounded-lg border border-gray-800">
                <button
                    onClick={() => setActiveTab('company')}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                        activeTab === 'company' 
                            ? 'bg-[#5ccfa2] text-black' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                >
                    <Briefcase className="w-4 h-4 inline mr-2" />
                    Company & Branding
                </button>
                <button
                    onClick={() => setActiveTab('integrations')}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                        activeTab === 'integrations' 
                            ? 'bg-[#5ccfa2] text-black' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                >
                    <LinkIcon className="w-4 h-4 inline mr-2" />
                    Connections
                </button>
            </div>

            <div className="space-y-6">
                {/* TAB 1: COMPANY & BRANDING */}
                {activeTab === 'company' && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#10101d] p-8 rounded-xl shadow-2xl border border-gray-800 space-y-6"
                    >
                        {/* COMPANY INFO SECTION */}
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                                <Briefcase className="w-5 h-5 mr-2 text-[#5ccfa2]" />
                                Company Information
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="company_name" className="text-sm text-gray-400 flex items-center mb-2">
                                        <Briefcase className="w-4 h-4 mr-2 text-[#5ccfa2]" /> 
                                        Company Name <span className="text-red-400 ml-1">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="company_name"
                                        name="company_name"
                                        value={configs.company_name}
                                        onChange={handleChange}
                                        placeholder="e.g., Zenith Digital Solutions"
                                        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="company_website" className="text-sm text-gray-400 flex items-center mb-2">
                                        <Globe className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Company Website
                                    </label>
                                    <input
                                        type="url"
                                        id="company_website"
                                        name="company_website"
                                        value={configs.company_website}
                                        onChange={handleChange}
                                        placeholder="e.g., https://zenithdigital.com"
                                        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="company_description" className="text-sm text-gray-400 flex items-center mb-2">
                                        <FileText className="w-4 h-4 mr-2 text-[#5ccfa2]" /> 
                                        Company Description <span className="text-red-400 ml-1">*</span>
                                    </label>
                                    <textarea
                                        id="company_description"
                                        name="company_description"
                                        rows={4}
                                        value={configs.company_description}
                                        onChange={handleChange}
                                        placeholder="Describe your company, what you do, your mission, and what makes you unique..."
                                        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="company_industry" className="text-sm text-gray-400 flex items-center mb-2">
                                        <Briefcase className="w-4 h-4 mr-2 text-[#5ccfa2]" /> 
                                        Industry <span className="text-red-400 ml-1">*</span>
                                    </label>
                                    <select
                                        id="company_industry"
                                        value={selectedIndustry}
                                        onChange={(e) => {
                                            setSelectedIndustry(e.target.value);
                                            if (e.target.value !== 'Other') {
                                                setCustomIndustry('');
                                            }
                                        }}
                                        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                    >
                                        <option value="">-- Select Industry --</option>
                                        {INDUSTRIES.map(ind => (
                                            <option key={ind} value={ind}>{ind}</option>
                                        ))}
                                        <option value="Other">Other</option>
                                    </select>

                                    {selectedIndustry === 'Other' && (
                                        <input
                                            type="text"
                                            value={customIndustry}
                                            onChange={(e) => setCustomIndustry(e.target.value)}
                                            placeholder="Please specify your industry"
                                            className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2] mt-3"
                                        />
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="target_audience" className="text-sm text-gray-400 flex items-center mb-2">
                                        <Target className="w-4 h-4 mr-2 text-[#5ccfa2]" /> 
                                        Target Audience <span className="text-red-400 ml-1">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="target_audience"
                                        name="target_audience"
                                        value={configs.target_audience}
                                        onChange={handleChange}
                                        placeholder="e.g., Young professionals in tech"
                                        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                    />
                                </div>

                                    <div>
                                 <label htmlFor="privacy_policy_url" className="text-sm text-gray-400 flex items-center mb-2">
                                <FileText className="w-4 h-4 mr-2 text-[#5ccfa2]" /> 
                                Privacy Policy URL (Optional)
                                </label>
                                <input
                                type="url"
                                id="privacy_policy_url"
                                name="privacy_policy_url"
                                value={configs.privacy_policy_url}
                                onChange={handleChange}
                                placeholder="e.g., https://yourcompany.com/privacy"
                                className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                This link will be shown in your lead forms privacy disclaimer
                            </p>
                            </div>

                            </div>
                        </div>

                        {/* BRANDING SECTION */}
                        <div className="border-t border-gray-700 pt-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                                <Palette className="w-5 h-5 mr-2 text-[#5ccfa2]" />
                                Visual Branding
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Company Logo</label>
                                    <div 
                                        className="w-full h-32 border-2 border-dashed border-gray-700 rounded-lg flex flex-col justify-center items-center cursor-pointer hover:border-[#5ccfa2] transition-colors relative"
                                        onClick={() => document.getElementById('logo-upload-input')?.click()}
                                    >
                                        <input 
                                            type="file" 
                                            id="logo-upload-input" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={handleLogoSelect} 
                                        />
                                        {(logoFile || configs.logo_url) ? (
                                            <>
                                                <img 
                                                    src={logoFile ? URL.createObjectURL(logoFile) : configs.logo_url} 
                                                    alt="Logo Preview" 
                                                    className="h-full w-full object-contain p-2 rounded-lg"
                                                />
                                                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                    <Upload className="w-6 h-6 text-white" />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-6 h-6 text-gray-500" />
                                                <p className="text-xs text-gray-500 mt-1">Click to upload</p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <MultiSelectDropdown
                                    label="Brand Tone"
                                    options={BRAND_TONES}
                                    selected={configs.brand_tone}
                                    onChange={(s) => setConfigs({ ...configs, brand_tone: s })}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <ColorPicker 
                                    label="Primary Color"
                                    color={configs.primary_color}
                                    onChange={(c) => setConfigs({ ...configs, primary_color: c })}
                                />
                                <ColorPicker 
                                    label="Secondary Color"
                                    color={configs.secondary_color}
                                    onChange={(c) => setConfigs({ ...configs, secondary_color: c })}
                                />
                                <ColorPicker 
                                    label="Accent Color"
                                    color={configs.accent_color}
                                    onChange={(c) => setConfigs({ ...configs, accent_color: c })}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* TAB 2: CONNECTIONS */}
                {activeTab === 'integrations' && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#10101d] p-8 rounded-xl shadow-2xl border border-gray-800 space-y-8"
                    >
                        {/* API KEYS */}
                        <div>
                            <h3 className="text-xl font-mono text-[#5ccfa2] mb-4 flex items-center">
                                <Key className="w-5 h-5 mr-2" /> API Keys
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-gray-400 mb-2 block">OpenAI API Key</label>
                                    <input
                                        type="password"
                                        value={openaiKey}
                                        onChange={(e) => setOpenaiKey(e.target.value)}
                                        placeholder="sk-..."
                                        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 font-mono text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm text-gray-400 mb-2 block">Gemini API Key</label>
                                    <input
                                        type="password"
                                        value={geminiKey}
                                        onChange={(e) => setGeminiKey(e.target.value)}
                                        placeholder="AIza..."
                                        className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 font-mono text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* GOOGLE OAUTH */}
                        <div>
                            <h3 className="text-xl font-mono text-[#5ccfa2] mb-4 flex items-center">
                                <LinkIcon className="w-5 h-5 mr-2" /> Google Drive & Sheets
                            </h3>

                            {socialProfile?.google_connected ? (
                                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-green-300 font-semibold">✓ Connected</p>
                                            <p className="text-xs text-gray-400 mt-1">{socialProfile.google_email}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleDisconnectGoogle}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                                    <p className="text-sm text-yellow-300 mb-3">
                                        Connect Google to enable lead form creation with automatic spreadsheet generation
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleConnectGoogle}
                                        className="px-4 py-2 bg-[#5ccfa2] hover:bg-[#45a881] text-black font-semibold rounded-lg transition-colors"
                                    >
                                        Connect Google Account
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* SAVE BUTTONS */}
{activeTab === 'company' && (
  <div className="flex justify-between items-center pt-4 border-t border-gray-800">
    <button
      onClick={handleSaveSettings}
      disabled={isSaving}
      className={`px-8 py-3 rounded-xl font-bold transition-all flex items-center ${
        isSaving ? 'bg-gray-500 text-gray-300 cursor-not-allowed' : 'bg-[#5ccfa2] text-black hover:bg-[#45a881]'
      }`}
    >
      {isSaving ? (
        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
      ) : saveStatus === 'saved' ? (
        <CheckCircle className="w-5 h-5 mr-3" />
      ) : saveStatus === 'failed' ? (
        <AlertTriangle className="w-5 h-5 mr-3" />
      ) : (
        <Save className="w-5 h-5 mr-3" />
      )}
      {isSaving ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'failed' ? 'Failed!' : 'Save Settings'}
    </button>

    <p className="text-xs text-gray-500">
      <span className="text-red-400">*</span> Required for lead form creation
    </p>
  </div>
)}

{activeTab === 'integrations' && (
  <div className="flex justify-end items-center pt-4 border-t border-gray-800">
    <button
      onClick={handleSaveConnections}
      disabled={isSaving}
      className={`px-8 py-3 rounded-xl font-bold transition-all flex items-center ${
        isSaving ? 'bg-gray-500 text-gray-300 cursor-not-allowed' : 'bg-[#5ccfa2] text-black hover:bg-[#45a881]'
      }`}
    >
      {isSaving ? (
        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
      ) : saveStatus === 'saved' ? (
        <CheckCircle className="w-5 h-5 mr-3" />
      ) : saveStatus === 'failed' ? (
        <AlertTriangle className="w-5 h-5 mr-3" />
      ) : (
        <Save className="w-5 h-5 mr-3" />
      )}
      {isSaving ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'failed' ? 'Failed!' : 'Save Connections'}
    </button>
  </div>
)}
            </div>
            </div>
        
    );
};

export default SettingsPage;