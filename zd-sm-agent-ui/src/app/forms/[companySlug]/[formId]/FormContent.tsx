'use client';

import React, { useState } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';

interface Question {
  id: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'textarea' | 'radio';
  label: string;
  placeholder?: string;
  category: string;
  options?: string[];
  required: boolean;
}

interface FormData {
  id: string;
  form_name: string;
  form_title: string;
  form_schema: {
    questions: Question[];
  };
}

interface FormContentProps {
  formData: FormData;
  companyName: string | null;
  companyLogoUrl: string | null;
  privacyPolicyUrl: string | null;
}

const QuestionField: React.FC<{ 
  question: Question; 
  value: string;
  onChange: (value: string) => void;
}> = ({ question, value, onChange }) => {
  const Label = () => (
    <label className="block text-sm font-semibold text-[#10101d] mb-2">
      {question.label}
      {question.required && <span className="text-red-600 ml-1">*</span>}
    </label>
  );

  const inputClasses = "w-full bg-white border border-[#10101d] text-[#10101d] rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#5ccfa2] focus:border-[#5ccfa2] focus:outline-none transition-all placeholder:text-gray-400";

  switch (question.type) {
    case 'text':
    case 'email':
    case 'phone':
      return (
        <div>
          <Label />
          <input
            type={question.type}
            placeholder={question.placeholder}
            required={question.required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
          />
        </div>
      );

    case 'select':
      return (
        <div>
          <Label />
          <select
            required={question.required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
          >
            <option value="">Select an option...</option>
            {question.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );

    case 'radio':
      return (
        <div>
          <Label />
          <div className="space-y-2">
            {question.options?.map((opt) => (
              <label key={opt} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name={question.id}
                  value={opt}
                  checked={value === opt}
                  onChange={(e) => onChange(e.target.value)}
                  required={question.required}
                  className="w-4 h-4 text-[#5ccfa2] border-[#10101d] focus:ring-[#5ccfa2]"
                />
                <span className="text-[#10101d] text-sm">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      );

    case 'textarea':
      return (
        <div>
          <Label />
          <textarea
            placeholder={question.placeholder}
            required={question.required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className={`${inputClasses} resize-none`}
          />
        </div>
      );

    default:
      return null;
  }
};

export default function FormContent({ formData, companyName, companyLogoUrl, privacyPolicyUrl }: FormContentProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/forms/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId: formData.id,
          answers: answers
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed');
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error('[Form] Submit error:', err);
      setError(err.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <div className="bg-white border border-[#5ccfa2] rounded-xl p-8 max-w-md text-center shadow-lg">
          <CheckCircle className="w-16 h-16 text-[#5ccfa2] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#10101d] mb-2">Thank You!</h2>
          <p className="text-gray-600">Your response has been submitted successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* HEADER */}
      <header className="bg-[#FAFAFA] p-6 md:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Company Branding */}
          {(companyLogoUrl || companyName) && (
            <div className="flex items-start justify-between mb-6">
              {/* Logo - Left */}
              {companyLogoUrl && (
                <div className="flex-shrink-0">
                  <img 
                    src={companyLogoUrl} 
                    alt="Company Logo" 
                    className="h-12 w-auto object-contain"
                  />
                </div>
              )}
              
              {/* Company Name - Right */}
              {companyName && (
                <h2 className="text-xl md:text-2xl font-bold text-[#10101d] text-right">
                  {companyName}
                </h2>
              )}
            </div>
          )}
          
          {/* Form Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-[#10101d] mb-2">
            {formData.form_title}
          </h1>
          <p className="text-gray-600 text-sm md:text-base">
            Please fill out this form to help us understand your needs
          </p>
        </div>
      </header>

      {/* FORM */}
      <main className="max-w-3xl mx-auto p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {formData.form_schema.questions.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              value={answers[question.id] || ''}
              onChange={(value) => setAnswers({ ...answers, [question.id]: value })}
            />
          ))}

          {error && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#5ccfa2] hover:bg-[#45a881] text-black font-semibold py-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </button>
        </form>

      {/* USER PRIVACY DISCLAIMER (Outside footer, under submit button) */}
<div className="text-center text-sm text-gray-600 mt-4">
  <p>
    By submitting this form, you consent to the collection and processing of your personal information.
    {privacyPolicyUrl && companyName && (
      <>
        {' '}
        <a 
          href={privacyPolicyUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[#10101d] hover:text-[#010112] underline transition-colors"
        >
          Learn more about how {companyName} uses your information.
        </a>
      </>
    )}
  </p>
</div>
</main>

{/* FOOTER */}
<footer className="bg-white border-t border-gray-200 p-6 mt-8">
  <div className="max-w-3xl mx-auto space-y-4">
    {/* Zenith Digital Disclaimer */}
    <div className="text-center text-xs text-gray-500">
      <p>
        This content is created by the owner of the form. The data you submit will be sent to the form owner. 
        {/*Add the below if applicable*/}
        {/* Zenith Digital is not responsible for the privacy or security practices of its customers, including those of this form owner.*/}
      </p>
    </div>


    {/* Branding */}
    <div className="flex items-center justify-between border-t border-gray-200 pt-4">
      {/* Content Factory Logo - Left */}
      <a 
        href="#" 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex-shrink-0"
      >
        <img 
          src="https://placeholder-logo-url.com/content-factory.png" 
          alt="Content Factory" 
          className="h-8 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity"
        />
      </a>
      
      {/* Powered by Zenith Digital - Right */}
      <a 
        href="https://zenithdigi.co.za" 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-sm text-gray-600 hover:text-[#010112] transition-colors"
      >
        ⚡by Zenith Digital
      </a>
    </div>
  </div>
</footer>
    </div>
  );
}