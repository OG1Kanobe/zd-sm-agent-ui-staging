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

  // Fetch form data + company branding
  const { data: formData, error } = await supabase
    .from('forms')
    .select(`
      id, 
      form_name, 
      form_title, 
      form_schema,
      user_id
    `)
    .eq('id', formId)
    .single();

  if (error || !formData) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <div className="bg-white border border-red-700 rounded-xl p-8 max-w-md text-center">
          <p className="text-red-600 text-lg">Form not found</p>
        </div>
      </div>
    );
  }

  // Fetch company branding
  const { data: companyData } = await supabase
    .from('client_configs')
    .select('company_name, logo_url')
    .eq('client_id', formData.user_id)
    .single();

  // Increment view count (track analytics)
  await supabase.rpc('increment_form_view', { form_id_param: formId });

  return (
    <FormContent 
      formData={formData}
      companyName={companyData?.company_name || null}
      companyLogoUrl={companyData?.logo_url || null}
    />
  );
}