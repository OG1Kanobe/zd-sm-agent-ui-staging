'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Globe, FileText, Briefcase, Upload, Loader2, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { supabaseServer } from '@/lib/supabaseServerClient';
import { CompanyFormData } from './LaunchpadModal';

interface Step1Props {
  userId: string;
  formData: CompanyFormData;
  setFormData: React.Dispatch<React.SetStateAction<CompanyFormData>>;
  onNext: () => void;
}

const Step1CompanyInfo: React.FC<Step1Props> = ({ userId, formData, setFormData, onNext }) => {
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Load existing data if any
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        const { data, error } = await supabase
          .from('client_configs')
          .select('company_name, company_website, company_description, company_industry, logo_url')
          .eq('client_id', userId)
          .single();

        if (data) {
          setFormData({
            companyName: data.company_name || '',
            website: data.company_website || '',
            hasNoWebsite: !data.company_website,
            description: data.company_description || '',
            industry: data.company_industry || '',
            logoFile: null,
          });
          if (data.logo_url) {
            setLogoPreview(data.logo_url);
          }
        }
      } catch (err) {
        console.log('[Step1] No existing data or error loading:', err);
      }
    };

    loadExistingData();
  }, [userId]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, logoFile: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }

    if (!formData.hasNoWebsite && !formData.website?.trim()) {
      newErrors.website = 'Website is required or check "I don\'t have a website"';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveAndNext = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      let logoUrl = logoPreview;

      // Upload logo if new file selected
      if (formData.logoFile) {
        const fileExt = formData.logoFile.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(filePath, formData.logoFile, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(filePath);
        logoUrl = urlData.publicUrl;
      }

      // Save to database
      const { data: existing, error: fetchError } = await supabase
        .from('client_configs')
        .select('id')
        .eq('client_id', userId)
        .single();

      const payload = {
        company_name: formData.companyName,
        company_website: formData.hasNoWebsite ? null : formData.website,
        company_description: formData.description || null,
        company_industry: formData.industry || null,
        logo_url: logoUrl || null,
      };

      if (existing) {
        // Update
        const { error: updateError } = await supabase
          .from('client_configs')
          .update(payload)
          .eq('client_id', userId);

        if (updateError) throw updateError;
      } else {
        // Insert
        const { error: insertError } = await supabase
          .from('client_configs')
          .insert({
            client_id: userId,
            ...payload,
          });

        if (insertError) throw insertError;
      }

      console.log('[Step1] Company info saved successfully');
      onNext();
    } catch (error: any) {
      console.error('[Step1] Save error:', error);
      alert(`Failed to save company information: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <h3 className="text-xl font-bold text-white mb-2">Tell us about your company</h3>
        <p className="text-sm text-gray-400">
          This information helps us personalize your experience and generate better content.
        </p>
      </div>

      {/* Company Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          <Building2 className="w-4 h-4 inline mr-2" />
          Company Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.companyName}
          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
          placeholder="Acme Corporation"
          className={`w-full bg-[#010112] border ${
            errors.companyName ? 'border-red-500' : 'border-gray-700'
          } text-white rounded-lg p-3 focus:ring-2 focus:ring-[#5ccfa2] focus:border-[#5ccfa2]`}
        />
        {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>}
      </div>

      {/* Website */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          <Globe className="w-4 h-4 inline mr-2" />
          Website <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          value={formData.website || ''}
          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          placeholder="https://example.com"
          disabled={formData.hasNoWebsite}
          className={`w-full bg-[#010112] border ${
            errors.website ? 'border-red-500' : 'border-gray-700'
          } text-white rounded-lg p-3 focus:ring-2 focus:ring-[#5ccfa2] focus:border-[#5ccfa2] disabled:opacity-50 disabled:cursor-not-allowed`}
        />
        <label className="flex items-center space-x-2 mt-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.hasNoWebsite}
            onChange={(e) =>
              setFormData({
                ...formData,
                hasNoWebsite: e.target.checked,
                website: e.target.checked ? null : formData.website,
              })
            }
            className="w-4 h-4 text-[#5ccfa2] bg-[#010112] border-gray-700 rounded focus:ring-[#5ccfa2]"
          />
          <span className="text-sm text-gray-400">I don't have a website</span>
        </label>
        {errors.website && <p className="text-red-500 text-xs mt-1">{errors.website}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          <FileText className="w-4 h-4 inline mr-2" />
          Description (Optional)
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Tell us what your company does..."
          rows={4}
          className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 focus:ring-2 focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
        />
      </div>

      {/* Industry */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          <Briefcase className="w-4 h-4 inline mr-2" />
          Industry (Optional)
        </label>
        <input
          type="text"
          value={formData.industry}
          onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
          placeholder="Technology, Healthcare, Finance, etc."
          className="w-full bg-[#010112] border border-gray-700 text-white rounded-lg p-3 focus:ring-2 focus:ring-[#5ccfa2] focus:border-[#5ccfa2]"
        />
      </div>

      {/* Logo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          <Upload className="w-4 h-4 inline mr-2" />
          Company Logo (Optional)
        </label>
        <div className="flex items-center space-x-4">
          <label className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-[#5ccfa2] transition-colors bg-[#010112]">
            <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            {logoPreview ? (
              <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain p-2 rounded-lg" />
            ) : (
              <div className="text-center">
                <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <span className="text-xs text-gray-500">Upload</span>
              </div>
            )}
          </label>
          {logoPreview && (
            <div className="flex-1">
              <p className="text-sm text-gray-400 mb-2">Preview</p>
              <p className="text-xs text-gray-500">Click to change logo</p>
            </div>
          )}
        </div>
      </div>

      {/* Next Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSaveAndNext}
          disabled={loading}
          className="bg-[#5ccfa2] text-black font-semibold px-6 py-3 rounded-lg hover:bg-[#45a881] transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Next
              <ChevronRight className="w-5 h-5 ml-2" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default Step1CompanyInfo;