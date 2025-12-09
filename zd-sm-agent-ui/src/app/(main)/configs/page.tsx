'use client';

import React, { useState, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Loader2, Save, Upload, Zap, CheckCircle, AlertTriangle, XCircle, 
    Palette, Target, Rss, Link, MessageSquare, Briefcase, FileText, Globe
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
    font_family: string;
    brand_tone: string[]; 
    visual_aesthetic: string[];
    target_audience: string;
    rss_urls: string[];
    normal_urls: string[];
    custom_prompt: string;
    schedule_posts: boolean;
    schedule_time: string;
    linked_accounts: { fb: boolean; ig: boolean; li: boolean };
    user_timezone: string;
    company_industry: string; //--- NEW ADDITION 031225
};

type DefaultConfig = {
    agent_role: string;
    brand_tone: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    visual_aesthetic: string;
    rss_urls: string[];
    normal_urls: string[];
    agent_prompt: string;
};

const BRAND_TONES = [
    'Professional', 'Witty', 'Casual', 'Luxury', 'Technical', 
    'Empathetic', 'Authoritative', 'Minimalist', 'Inspirational', 'Sarcastic'
];

const VISUAL_AESTHETICS = [
    'Clean Lines', 'Bold Graphics', 'Pastel Colors', 'Monochrome', 'Geometric', 
    'add more here' 
];

const ensureArray = (value: any): string[] => {
    if (Array.isArray(value)) return value;
    return [];
};

const ColorPicker: React.FC<{ label: string, color: string, onChange: (newColor: string) => void }> = ({ label, color, onChange }) => (
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

const MultiSelectDropdown: React.FC<{ label: string, options: string[], selected: string[], onChange: (newSelection: string[]) => void }> = ({ label, options, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const handleSelect = (option: string) => {
        if (option === 'add more here') return; 
        const newSelection = selected.includes(option)
            ? selected.filter(s => s !== option)
            : [...selected, option];
        onChange(newSelection);
    };

    return (
        <div className="relative">
            <label className="text-sm text-gray-400 mb-1 flex items-center">
                <Briefcase className="w-4 h-4 mr-2 text-[#5ccfa2]" /> {label}
            </label>
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-[#10101d] border border-gray-700 text-white rounded-lg p-3 text-left transition-all hover:border-[#5ccfa2] flex justify-between items-center"
            >
                {selected.length > 0 ? selected.join(', ') : `Select ${label}`}
                <Zap className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
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

const UrlInput: React.FC<{ label: string, urls: string[], onChange: (newUrls: string[]) => void, icon: React.ElementType }> = ({ label, urls, onChange, icon: Icon }) => {
    const [currentInput, setCurrentInput] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && currentInput.trim()) {
            e.preventDefault();
            const newUrl = currentInput.trim();
            if (!urls.includes(newUrl)) {
                onChange([...urls, newUrl]);
            }
            setCurrentInput('');
        }
    };

    const handleRemove = (urlToRemove: string) => {
        onChange(urls.filter(url => url !== urlToRemove));
    };

    return (
        <div className="flex flex-col space-y-3">
            <label className="text-sm text-gray-400 flex items-center">
                <Icon className="w-4 h-4 mr-2 text-[#5ccfa2]" /> {label} (Press Enter to add)
            </label>
            <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Enter a ${label.toLowerCase()} URL`}
                className="w-full bg-[#10101d] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
            />
            <div className="flex flex-wrap gap-2 min-h-12 p-1 bg-[#10101d]/50 rounded-lg border border-gray-800">
                {urls.map(url => (
                    <span 
                        key={url} 
                        className="flex items-center bg-[#5ccfa2] text-black text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap"
                    >
                        {new URL(url).hostname} 
                        <XCircle className="w-3 h-3 ml-1 cursor-pointer" onClick={() => handleRemove(url)} />
                    </span>
                ))}
            </div>
        </div>
    );
};

const DefaultConfigsModal: React.FC<{ defaultConfigs: DefaultConfig, onClose: () => void }> = ({ defaultConfigs, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="bg-[#010112] p-8 rounded-xl max-w-2xl w-full border border-[#5ccfa2] shadow-2xl"
        >
            <h3 className="text-2xl font-mono text-[#5ccfa2] mb-4 border-b border-gray-700 pb-2 flex justify-between items-center">
                Default Agent Configurations
                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                    <XCircle className="w-6 h-6" />
                </button>
            </h3>
            
            <div className="max-h-96 overflow-y-auto space-y-6 text-sm text-gray-300">
                <p><strong className="text-white">Agent Role:</strong> {defaultConfigs.agent_role || 'Not Defined'}</p>
                
                <div className="grid grid-cols-2 gap-4">
                    <p><strong className="text-white">Brand Tone:</strong> {defaultConfigs.brand_tone || 'Neutral'}</p>
                    <p><strong className="text-white">Visual Aesthetic:</strong> {defaultConfigs.visual_aesthetic || 'Standard'}</p>
                    <p><strong className="text-white">Primary Color:</strong> <span style={{ color: defaultConfigs.primary_color }}>{defaultConfigs.primary_color || 'N/A'}</span></p>
                    <p><strong className="text-white">Secondary Color:</strong> <span style={{ color: defaultConfigs.secondary_color }}>{defaultConfigs.secondary_color || 'N/A'}</span></p>
                    <p><strong className="text-white">Accent Color:</strong> <span style={{ color: defaultConfigs.accent_color }}>{defaultConfigs.accent_color || 'N/A'}</span></p>
                    <p><strong className="text-white">RSS URLs:</strong> {defaultConfigs.rss_urls?.join(', ') || 'None'}</p>
                    <p><strong className="text-white">Normal URLs:</strong> {defaultConfigs.normal_urls?.join(', ') || 'None'}</p>
                </div>
                
                <div>
                    <strong className="text-white block mb-1">Default Agent Prompt:</strong>
                    <pre className="bg-[#10101d] p-3 rounded-lg border border-gray-700 overflow-x-auto text-xs font-mono whitespace-pre-wrap">
                        {defaultConfigs.agent_prompt || 'No default prompt specified in DB.'}
                    </pre>
                </div>
            </div>
            
            <button onClick={onClose} className="mt-6 w-full py-2 bg-[#5ccfa2] text-black font-semibold rounded-lg hover:bg-[#45a881] transition-colors">
                Close
            </button>
        </motion.div>
    </div>
);

const AgentConfigsPage = () => {
    const router = useRouter();
    const { user, loading: sessionLoading } = useUserSession(); 
    const userId = user?.id;
    const userDisplayName = user?.user_metadata?.display_name || user?.email || 'Architect-Agent';

    const [configs, setConfigs] = useState<Config | null>(null);
    const [defaultConfigs, setDefaultConfigs] = useState<DefaultConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [isDefaultModalOpen, setIsDefaultModalOpen] = useState(false);
    const [selectedIndustry, setSelectedIndustry] = useState('');  //--NEW ADDITION 031225
const [customIndustry, setCustomIndustry] = useState(''); //--NEW ADDITION 031225

    useEffect(() => {
        if (sessionLoading || !userId) return;

        const fetchData = async () => {
            setIsLoading(true);
            
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
                    font_family: clientData.font_family || 'Inter',
                    brand_tone: ensureArray(clientData.brand_tone),
                    visual_aesthetic: ensureArray(clientData.visual_aesthetic),
                    target_audience: clientData.target_audience || '',
                    rss_urls: ensureArray(clientData.rss_urls),
                    normal_urls: ensureArray(clientData.normal_urls),
                    custom_prompt: clientData.custom_prompt || '',
                    schedule_posts: clientData.schedule_posts || false,
                    schedule_time: clientData.schedule_time || '10:00',
                    linked_accounts: clientData.linked_accounts || { fb: false, ig: false, li: false },
                    user_timezone: clientData.user_timezone || '',
                    company_industry: clientData.company_industry || '', //---NEW ADDITION 031225
                }); 
            } else {
                setConfigs({
                    id: null,
                    company_name: '', 
                    company_website: '',
                    company_description: '',
                    logo_url: '', 
                    target_audience: '', 
                    custom_prompt: '', 
                    font_family: 'Inter',
                    primary_color: '#3B82F6', 
                    secondary_color: '#FFFFFF', 
                    accent_color: '#10B981',
                    brand_tone: [], 
                    visual_aesthetic: [], 
                    rss_urls: [], 
                    normal_urls: [],
                    schedule_posts: false, 
                    schedule_time: '10:00',
                    linked_accounts: { fb: false, ig: false, li: false }, 
                    user_timezone: '',
                    company_industry: '',
                });
            }

            // Set industry state
if (clientData.company_industry) {
    const industries = ['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing', 'Real Estate', 'Marketing', 'Hospitality', 'Construction'];
    if (industries.includes(clientData.company_industry)) {
        setSelectedIndustry(clientData.company_industry);
    } else {
        setSelectedIndustry('Other');
        setCustomIndustry(clientData.company_industry);
    }
} //NEW ADDITION 031225 - NOT SURE IF IN RIGHT PLACE (LINES 299-308)
            
            const { data: defaultData } = await supabase
                .from('default_configs')
                .select('*')
                .single();
                
            if (defaultData) {
                setDefaultConfigs(defaultData as DefaultConfig);
            }

            setIsLoading(false);
        };

        fetchData();
    }, [userId, sessionLoading]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (!configs) return;
        const { name, value, type } = e.target;
        
        if (type === 'checkbox' && 'checked' in e.target) {
            setConfigs({ ...configs, [name]: e.target.checked });
            return;
        }

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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
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
                font_family: configs.font_family,
                brand_tone: configs.brand_tone || null,
                visual_aesthetic: configs.visual_aesthetic || null,
                target_audience: configs.target_audience || null,
                rss_urls: configs.rss_urls || [],
                normal_urls: configs.normal_urls || [],
                custom_prompt: configs.custom_prompt || null,
                schedule_posts: configs.schedule_posts ?? false,
                schedule_time: configs.schedule_time ?? "10:00",
                linked_accounts: configs.linked_accounts || { fb: false, ig: false, li: false },
                user_timezone: configs.user_timezone || null,
                company_industry: selectedIndustry === 'Other' ? customIndustry : selectedIndustry || null, //new addition 03125
            };
            
            const { data, error } = await supabase
                .from('client_configs')
                .upsert(dataToSave, { onConflict: 'client_id' })
                .select()
                .single();

            if (error) throw error;

            setSaveStatus('saved');
        } catch (e) {
            console.error("Configuration save failed:", e);
            setSaveStatus('failed');
        } finally {
            setIsSaving(false);
            setTimeout(() => setSaveStatus('idle'), 3000); 
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
        <>
            <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-gray-800">
                    <div>
                        <h2 className="text-3xl font-mono text-white">Agent Configuration</h2>
                        <p className="text-sm text-gray-400 mt-1">Customize your AI agent's behavior and branding settings.</p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-10">
                    {/* SECTION 1: BRANDING */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="bg-[#10101d] p-8 rounded-xl shadow-2xl border border-gray-800 space-y-8"
                    >
                        <h2 className="text-2xl font-mono text-[#5ccfa2] border-b border-gray-700 pb-3 flex items-center">
                            <Palette className="w-6 h-6 mr-3" /> Branding Identity
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                            <div className="col-span-1">
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
                                            <p className="text-xs text-gray-500 mt-1">Click to upload or drag & drop</p>
                                        </>
                                    )}
                                </div>
                                <p className="text-xs text-gray-600 mt-1">Uploaded file: {logoFile?.name || (configs.logo_url ? 'Existing logo' : 'None')}</p>
                            </div>
                            
                            <div className="col-span-2 space-y-4">
                                <div>
                                    <label htmlFor="company_name" className="text-sm text-gray-400 flex items-center mb-1">
                                        <Briefcase className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Company Name
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
                                    <label htmlFor="company_website" className="text-sm text-gray-400 flex items-center mb-1">
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
                            </div>
                        </div>

                        <div>
                            <label htmlFor="company_description" className="text-sm text-gray-400 flex items-center mb-1">
                                <FileText className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Company Description
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

{/* Industry Selection */}  {/* NEW ADDITION 03125 */}
<div> 
    <label htmlFor="company_industry" className="text-sm text-gray-400 flex items-center mb-1">
        <Briefcase className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Industry
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
        <option value="Technology">Technology</option>
        <option value="Healthcare">Healthcare</option>
        <option value="Finance">Finance</option>
        <option value="Education">Education</option>
        <option value="Retail">Retail</option>
        <option value="Manufacturing">Manufacturing</option>
        <option value="Real Estate">Real Estate</option>
        <option value="Marketing">Marketing</option>
        <option value="Hospitality">Hospitality</option>
        <option value="Construction">Construction</option>
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
</div> {/*nNEW ADDITION 031225 */}

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
                    </motion.div>
                    
                    {/* SECTION 2: AI BEHAVIOR & INPUTS */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="bg-[#10101d] p-8 rounded-xl shadow-2xl border border-gray-800 space-y-8"
                    >
                        <h2 className="text-2xl font-mono text-[#5ccfa2] border-b border-gray-700 pb-3 flex items-center">
                            <Zap className="w-6 h-6 mr-3" /> Agent Behavior & Inputs
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <MultiSelectDropdown
                                label="Brand Tone (Multiselect)"
                                options={BRAND_TONES}
                                selected={configs.brand_tone}
                                onChange={(s) => setConfigs({ ...configs, brand_tone: s })}
                            />
                            <MultiSelectDropdown
                                label="Visual Aesthetic (Multiselect)"
                                options={VISUAL_AESTHETICS}
                                selected={configs.visual_aesthetic}
                                onChange={(s) => setConfigs({ ...configs, visual_aesthetic: s })}
                            />
                            <div className="flex flex-col space-y-2">
                                <label htmlFor="target_audience" className="text-sm text-gray-400 flex items-center mb-1">
                                    <Target className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Target Audience
                                </label>
                                <input
                                    type="text"
                                    id="target_audience"
                                    name="target_audience"
                                    value={configs.target_audience}
                                    onChange={handleChange}
                                    placeholder="e.g., Young professionals in tech"
                                    className="w-full bg-[#10101d] border border-gray-700 text-white rounded-lg p-3 text-base focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <UrlInput
                                label="RSS Feed URLs"
                                urls={configs.rss_urls}
                                onChange={(u) => setConfigs({ ...configs, rss_urls: u })}
                                icon={Rss}
                            />
                            <UrlInput
                                label="Normal Website URLs"
                                urls={configs.normal_urls}
                                onChange={(u) => setConfigs({ ...configs, normal_urls: u })}
                                icon={Link}
                            />
                        </div>

                        <div>
                            <label htmlFor="custom_prompt" className="text-sm text-gray-400 flex items-center mb-1">
                                <MessageSquare className="w-4 h-4 mr-2 text-[#5ccfa2]" /> Custom Agent Prompt
                            </label>
                            <textarea
                                id="custom_prompt"
                                name="custom_prompt"
                                rows={6}
                                value={configs.custom_prompt}
                                onChange={handleChange}
                                placeholder="Write your custom instructions for the AI agent here. (e.g., You are a witty social media manager. All posts must be exactly 280 characters and end with a relevant emoji.)"
                                className="w-full bg-[#10101d] border border-gray-700 text-white rounded-lg p-3 text-sm focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
                            />
                        </div>
                    </motion.div>
                    
                    {/* SAVE BUTTON AND FEEDBACK */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-800">
                        <button
                            type="submit"
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
                            {isSaving ? 'Saving Configuration...' : saveStatus === 'saved' ? 'Configuration Saved!' : saveStatus === 'failed' ? 'Save Failed!' : 'Save Configuration'}
                        </button>
                        
                        <div className="text-right">
                            <p className="text-xs text-gray-500">
                                Empty fields will revert to default agent settings upon execution.
                            </p>
                            <button
                                type="button"
                                onClick={() => setIsDefaultModalOpen(true)}
                                className="text-sm text-[#5ccfa2] hover:text-[#45a881] underline mt-1 flex items-center float-right"
                            >
                                <FileText className="w-4 h-4 mr-1" /> View Default Configurations
                            </button>
                        </div>
                    </div>
                </form>

                {isDefaultModalOpen && defaultConfigs && (
                    <DefaultConfigsModal 
                        defaultConfigs={defaultConfigs} 
                        onClose={() => setIsDefaultModalOpen(false)} 
                    />
                )}
                
                {isDefaultModalOpen && !defaultConfigs && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
                        <div className="bg-[#10101d] p-8 rounded-xl max-w-lg w-full border border-gray-700">
                            <h3 className="text-xl text-white">Default Configs Not Found</h3>
                            <p className="text-gray-400 mt-2">Could not retrieve default configurations from the database.</p>
                            <button onClick={() => setIsDefaultModalOpen(false)} className="mt-4 px-4 py-2 bg-gray-600 rounded">Close</button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default AgentConfigsPage;