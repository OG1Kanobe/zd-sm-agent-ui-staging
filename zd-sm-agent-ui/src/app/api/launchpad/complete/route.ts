import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServerClient';
import { withSecurity } from '@/lib/security';

/**
 * POST /api/launchpad/complete
 * 
 * Mark user's onboarding as complete
 * Sets onboarding_completed = true in client_configs
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (userId: string) => {
      try {
        console.log(`[Launchpad Complete] Marking onboarding complete for user ${userId}`);
        
        // Check if client_configs record exists
        const { data: existing, error: fetchError } = await supabaseServer
          .from('client_configs')
          .select('id')
          .eq('client_id', userId)
          .single();
        
        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 = no rows returned (expected for new users)
          console.error('[Launchpad Complete] Fetch error:', fetchError);
          throw fetchError;
        }
        
        if (existing) {
          // Update existing record
          const { error: updateError } = await supabaseServer
            .from('client_configs')
            .update({ onboarding_completed: true })
            .eq('client_id', userId);
          
          if (updateError) {
            console.error('[Launchpad Complete] Update error:', updateError);
            throw updateError;
          }
          
          console.log(`[Launchpad Complete] Updated existing record for user ${userId}`);
        } else {
          // Create new record with onboarding_completed = true
          const { error: insertError } = await supabaseServer
            .from('client_configs')
            .insert({
              client_id: userId,
              onboarding_completed: true,
            });
          
          if (insertError) {
            console.error('[Launchpad Complete] Insert error:', insertError);
            throw insertError;
          }
          
          console.log(`[Launchpad Complete] Created new record for user ${userId}`);
        }
        
        return NextResponse.json({
          success: true,
          message: 'Onboarding marked as complete',
        });
      } catch (error: any) {
        console.error('[Launchpad Complete] Error:', error);
        return NextResponse.json(
          { error: 'Failed to complete onboarding', details: error.message },
          { status: 500 }
        );
      }
    },
    {
      rateLimitKey: 'launchpad-complete',
      rateLimitMax: 5,
      auditAction: 'onboarding_completed',
    }
  );
}