import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
  authorization_level: number;
  jurisdiction_country: string | null;
}

// Allowed origins for CORS — domínio próprio + produção Vercel + previews + localhost.
const ALLOWED_ORIGINS = [
  "https://afroloc.ao",                    // domínio próprio (apex)
  "https://www.afroloc.ao",                // domínio próprio (www)
  "https://afroc-app26-rose.vercel.app",   // Vercel (produção)
  "https://afroc-app26",   // cobre os preview deployments afroc-app26-*.vercel.app
  "http://localhost",
];

function getAllowedOrigin(requestOrigin: string | null): string {
  if (requestOrigin && ALLOWED_ORIGINS.some(o => requestOrigin.startsWith(o))) {
    return requestOrigin;
  }
  // Allow Supabase internal calls (edge function → edge function)
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (requestOrigin && supabaseUrl && requestOrigin.startsWith(supabaseUrl)) {
    return requestOrigin;
  }
  // Default to production domain (blocks unknown origins from reading responses)
  return ALLOWED_ORIGINS[0];
}

// Security headers applied to all API responses
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
};

// Static CORS headers for backward compatibility — used by functions that don't pass the request
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-afroloc-partner-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  ...securityHeaders,
};

// Dynamic CORS headers — use when you have access to the request
export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("origin") ?? null;
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(origin),
    "Access-Control-Allow-Headers": corsHeaders["Access-Control-Allow-Headers"],
    "Vary": "Origin",
    ...securityHeaders,
  };
}

export function getSupabaseClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

export async function getAuthUser(req: Request): Promise<{ user: User; supabase: SupabaseClient }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing Bearer token");
  }

  const supabase = getSupabaseClient();
  const token = authHeader.replace("Bearer ", "");
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error("Invalid or expired token");
  }

  return { user, supabase };
}

export async function getCurrentUser(req: Request): Promise<AuthUser> {
  const { user, supabase } = await getAuthUser(req);

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .single();

  // Get roles
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  // Get authorization level
  const { data: authLevel } = await supabase
    .from("user_authorization_levels")
    .select("current_level, jurisdiction_country")
    .eq("user_id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email || "",
    full_name: profile?.full_name || null,
    roles: userRoles?.map((r) => r.role) || [],
    authorization_level: authLevel?.current_level || 1,
    jurisdiction_country: authLevel?.jurisdiction_country || null,
  };
}

export function hasAnyRole(user: AuthUser, ...allowedRoles: string[]): boolean {
  return user.roles.some((role) => allowedRoles.includes(role));
}

export function requireRoles(user: AuthUser, ...allowedRoles: string[]): void {
  if (!hasAnyRole(user, ...allowedRoles)) {
    throw new Error(`Forbidden: Requires one of [${allowedRoles.join(", ")}]`);
  }
}

export function isAdmin(user: AuthUser): boolean {
  return hasAnyRole(user, "admin", "admin_national", "admin_province", "admin_municipality");
}

export function isAuditor(user: AuthUser): boolean {
  return hasAnyRole(user, "auditor_read");
}

export function isOperator(user: AuthUser): boolean {
  return hasAnyRole(user, "operator_field");
}

export async function audit(
  supabase: SupabaseClient,
  userId: string | null,
  action: string,
  target: string = "",
  meta: Record<string, unknown> = {},
  req?: Request
): Promise<void> {
  const ip = req?.headers.get("x-forwarded-for") || 
             req?.headers.get("cf-connecting-ip") || 
             "";
  const userAgent = req?.headers.get("user-agent") || "";

  await supabase.from("security_audit_log").insert({
    user_id: userId,
    action,
    function_name: target.split(":")[0] || "unknown",
    details: { target, ...meta },
    ip_address: ip,
    user_agent: userAgent,
  });
}

export function errorResponse(error: unknown, status = 400, req?: Request): Response {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Error:", message);
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
  );
}

export function jsonResponse(data: unknown, status = 200, req?: Request): Response {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
  );
}
