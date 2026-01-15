import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServerClient';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const userId = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('LinkedIn OAuth error:', { error, errorDescription });
      
      return new Response(
        `<script>
          if (window.opener) {
            window.opener.postMessage({ 
              success: false, 
              platform: 'li',
              error: '${errorDescription || error}'
            }, window.location.origin);
            window.close();
          } else {
            document.body.innerText = 'Authorization failed: ${errorDescription || error}. You can close this tab.';
          }
        </script>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !userId) {
      return new Response('Missing code or userId', { status: 400 });
    }

    // Validate userId format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return new Response('Invalid user ID format', { status: 400 });
    }

    const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
    const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
    const BASE_URL = process.env.BASE_APP_URI;
    const REDIRECT_URI = `${BASE_URL}/api/linkedin/callback`;

    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET || !BASE_URL) {
      return new Response('Server configuration error', { status: 500 });
    }

    // ==========================================
    // STEP 1: Exchange code for access token
    // ==========================================
    const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
    
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenRes.json();
    console.log('[LinkedIn] Token response:', tokenRes.status);

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Failed to get access token:', tokenData);
      return new Response('Failed to get access token', { status: 400 });
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // ==========================================
    // STEP 2: Get user profile
    // ==========================================
    const profileUrl = 'https://api.linkedin.com/v2/userinfo';
    
    const profileRes = await fetch(profileUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const profileData = await profileRes.json();
    console.log('[LinkedIn] Profile response:', profileRes.status);

    if (!profileRes.ok) {
      console.error('Failed to get LinkedIn profile:', profileData);
      return new Response('Failed to get LinkedIn profile', { status: 400 });
    }

    // ==========================================
    // STEP 3: Get organizations user can manage
    // ==========================================
    const orgsUrl = 'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&projection=(elements*(organization~(localizedName,vanityName),roleAssignee,state))';

    const orgsRes = await fetch(orgsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    const orgsData = await orgsRes.json();
    console.log('[LinkedIn] Organizations response:', orgsRes.status, orgsData);

    // Extract organizations where user has admin access
    const organizations = [];
    
    if (orgsData.elements && Array.isArray(orgsData.elements)) {
      for (const element of orgsData.elements) {
        // Check if user is approved administrator
        if (element.state === 'APPROVED' && element.organization) {
          const orgUrn = element.organization;
          const orgId = orgUrn.replace('urn:li:organization:', '');
          
          organizations.push({
            id: orgId,
            urn: orgUrn,
            name: element['organization~']?.localizedName || 'Unknown Organization',
            vanityName: element['organization~']?.vanityName || null,
          });
        }
      }
    }

    console.log('[LinkedIn] Extracted organizations:', organizations);

    // ==========================================
    // STEP 4: Save to database
    // ==========================================
    const { error: dbError } = await supabaseServer
      .from('user_social_profiles')
      .upsert(
        {
          client_id: userId,
          linkedin_connected: true,
          linkedin_user_id: profileData.sub,
          linkedin_name: profileData.name,
          linkedin_email: profileData.email,
          linkedin_profile_url: profileData.picture || null,
          linkedin_access_token: accessToken,
          li_token_expires_at: expiresAt,
          linkedin_organizations: organizations, // Store organizations as JSON
        },
        { onConflict: 'client_id' }
      );

    if (dbError) {
      console.error('Supabase upsert error:', dbError, { userId });
      return new Response('Database error', { status: 500 });
    }

    // ==========================================
    // STEP 5: Close popup and notify parent
    // ==========================================
    const orgCount = organizations.length;
    const successMessage = orgCount > 0 
      ? `Connected LinkedIn successfully (${profileData.name}) with ${orgCount} organization page(s).`
      : `Connected LinkedIn successfully (${profileData.name}). No organization pages found.`;

    return new Response(
      `<script>
        if (window.opener) {
          window.opener.postMessage({ 
            success: true, 
            platform: 'li',
            name: '${profileData.name}',
            orgCount: ${orgCount}
          }, window.location.origin);
          window.close();
        } else {
          document.body.innerText = '${successMessage} You can close this tab.';
        }
      </script>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (err) {
    console.error('LinkedIn callback error:', err);
    return new Response('Internal server error', { status: 500 });
  }
}