import { createClient } from '@supabase/supabase-js';
import FormContent from './FormContent';

export default async function FormPage({ params }: { 
  params: Promise<{ companySlug: string; formId: string; formTitle: string }> 
}) {
  const { formId } = await params;

  // Server-side Supabase client with service role (no auth required)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );

  // Fetch form data server-side
  const { data: formData, error } = await supabase
    .from('posts_v2')
    .select('form_id, form_name, form_title, form_schema')
    .eq('form_id', formId)
    .not('form_schema', 'is', null)
    .limit(1)
    .single();

  if (error || !formData) {
    return (
      <div className="min-h-screen bg-[#010112] flex items-center justify-center p-6">
        <div className="bg-[#10101d] border border-red-700 rounded-xl p-8 max-w-md text-center">
          <p className="text-red-400 text-lg">Form not found</p>
        </div>
      </div>
    );
  }

  return <FormContent formData={formData} />;
}