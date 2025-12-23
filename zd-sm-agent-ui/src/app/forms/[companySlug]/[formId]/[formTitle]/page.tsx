'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface Question {
  id: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'textarea';
  label: string;
  placeholder?: string;
  category: string;
  options?: string[];
  required: boolean;
}

interface FormData {
  form_id: string;
  form_name: string;
  form_title: string;
  form_schema: {
    questions: Question[];
  };
}

const QuestionField: React.FC<{ 
  question: Question; 
  value: string;
  onChange: (value: string) => void;
}> = ({ question, value, onChange }) => {
  const Label = () => (
    <label className="block text-sm font-semibold text-white mb-2">
      {question.label}
      {question.required && <span className="text-red-400 ml-1">*</span>}
    </label>
  );

  const inputClasses = "w-full bg-[#10101d] border border-gray-700 text-white rounded-lg px-4 py-3 focus:ring-[#5ccfa2] focus:border-[#5ccfa2] focus:outline-none transition-colors";

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

export default function FormPage() {
  const params = useParams();
  const { companySlug, formId, formTitle } = params;

  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchForm();
  }, [formId]);

  const fetchForm = async () => {
    try {
      const { data, error } = await supabase
        .from('posts_v2')
        .select('form_id, form_name, form_title, form_schema')
        .eq('form_id', formId)
        .not('form_schema', 'is', null)
        .limit(1)
        .single();

      if (error || !data) {
        setError('Form not found');
        setLoading(false);
        return;
      }

      setFormData(data as FormData);
    } catch (err) {
      console.error('[Form] Fetch error:', err);
      setError('Failed to load form');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // TODO: Submit to API endpoint
      // For now, just simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Form submission:', {
        formId,
        answers
      });

      setSubmitted(true);
    } catch (err: any) {
      console.error('[Form] Submit error:', err);
      setError(err.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#010112] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#5ccfa2] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#010112] flex items-center justify-center p-6">
        <div className="bg-[#10101d] border border-red-700 rounded-xl p-8 max-w-md text-center">
          <p className="text-red-400 text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#010112] flex items-center justify-center p-6">
        <div className="bg-[#10101d] border border-[#5ccfa2] rounded-xl p-8 max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-[#5ccfa2] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Thank You!</h2>
          <p className="text-gray-400">Your response has been submitted successfully.</p>
        </div>
      </div>
    );
  }

  if (!formData) return null;

  return (
    <div className="min-h-screen bg-[#010112]">
      {/* HEADER */}
      <header className="border-b border-gray-800 p-6 md:p-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {formData.form_title}
          </h1>
          <p className="text-gray-400">
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
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#5ccfa2] hover:bg-[#45a881] text-black font-semibold py-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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
      </main>

      {/* FOOTER */}
      <footer className="border-t border-gray-800 p-6 text-center">
        <p className="text-gray-500 text-sm">
          Powered by Architect C
        </p>
      </footer>
    </div>
  );
}