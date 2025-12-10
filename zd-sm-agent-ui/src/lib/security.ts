import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Security middleware for API routes
 * Provides: Authentication, CSRF protection, Rate limiting, Audit logging
 */

// Rate limiting store (in-memory, will reset on server restart)
// TODO: Move to Redis for production
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Validate request origin for CSRF protection
 */
function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // Allow requests from same origin
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL,
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean);
  
  if (origin && allowedOrigins.some(allowed => origin.startsWith(allowed as string))) {
    return true;
  }
  
  if (referer && allowedOrigins.some(allowed => referer.startsWith(allowed as string))) {
    return true;
  }
  
  console.warn('[Security] Invalid origin:', { origin, referer });
  return false;
}

/**
 * Authenticate request using JWT token from Authorization header
 * Returns userId if valid, null otherwise
 */
async function authenticateRequest(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('[Security] Missing or invalid authorization header');
      return null;
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Create a Supabase client to verify the JWT
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Verify the JWT and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.warn('[Security] Invalid token:', error?.message);
      return null;
    }
    
    return user.id;
  } catch (error) {
    console.error('[Security] Authentication error:', error);
    return null;
  }
}

/**
 * Check rate limit for a user action
 */
function checkRateLimit(
  userId: string,
  action: string,
  maxAttempts: number = 10,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): { allowed: boolean; remaining: number; resetAt: number | null } {
  const key = `${userId}:${action}`;
  const now = Date.now();
  
  const existing = rateLimitStore.get(key);
  
  // If no existing record or window expired, create new
  if (!existing || existing.resetAt < now) {
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxAttempts - 1, resetAt };
  }
  
  // Increment count
  existing.count++;
  rateLimitStore.set(key, existing);
  
  // Check if limit exceeded
  if (existing.count > maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }
  
  return {
    allowed: true,
    remaining: maxAttempts - existing.count,
    resetAt: existing.resetAt,
  };
}

/**
 * Audit log entry interface
 */
interface AuditLogEntry {
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Log API operations for audit trail
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    // For now, just console log. In production, store in database
    console.log('[Audit Log]', {
      timestamp: new Date().toISOString(),
      ...entry,
    });
    
    // TODO: Store in audit_logs table when created
    // const supabaseServer = createClient(
    //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
    //   process.env.SUPABASE_SERVICE_ROLE_KEY!
    // );
    // await supabaseServer.from('audit_logs').insert({
    //   ...entry,
    //   created_at: new Date().toISOString(),
    // });
  } catch (error) {
    console.error('[Audit Log] Failed to log event:', error);
    // Don't throw - audit logging failures shouldn't break the API
  }
}

/**
 * Security middleware wrapper for API routes
 * Handles auth, rate limiting, CSRF, and audit logging
 */
export async function withSecurity(
  request: NextRequest,
  handler: (userId: string) => Promise<NextResponse>,
  options: {
    rateLimitKey?: string;
    rateLimitMax?: number;
    rateLimitWindowMs?: number;
    skipOriginValidation?: boolean;
    auditAction?: string;
  } = {}
): Promise<NextResponse> {
  try {
    // 1. Validate origin (CSRF protection)
    if (!options.skipOriginValidation && !validateOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid origin' },
        { status: 403 }
      );
    }
    
    // 2. Authenticate user
    const userId = await authenticateRequest(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // 3. Rate limiting
    if (options.rateLimitKey) {
      const rateLimit = checkRateLimit(
        userId,
        options.rateLimitKey,
        options.rateLimitMax,
        options.rateLimitWindowMs
      );
      
      if (!rateLimit.allowed) {
        const resetIn = rateLimit.resetAt
          ? Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
          : 60;
        
        await logAuditEvent({
          user_id: userId,
          action: `${options.rateLimitKey}_rate_limit_exceeded`,
          resource_type: 'rate_limit',
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        });
        
        return NextResponse.json(
          { error: 'Rate limit exceeded', resetIn },
          { status: 429 }
        );
      }
    }
    
    // 4. Execute handler
    const response = await handler(userId);
    
    // 5. Audit logging
    if (options.auditAction) {
      await logAuditEvent({
        user_id: userId,
        action: options.auditAction,
        resource_type: 'api_key',
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
      });
    }
    
    return response;
  } catch (error) {
    console.error('[Security] Middleware error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}