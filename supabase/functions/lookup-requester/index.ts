import { corsHeaders, getAuthUser, getCurrentUser, hasAnyRole, errorResponse, jsonResponse, audit } from "../_shared/auth_rbac.ts";

/**
 * Lookup Requester
 * 
 * Allows yamioo_agent / admin roles to search for a registered user
 * by phone number and return their profile data + email + document info.
 * 
 * POST { phone: string }
 * Returns: { found, profile: { user_id, full_name, phone, email, afro_id, country, city, document_number, document_type } }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const currentUser = await getCurrentUser(req);

    // Only yamioo_agent, temp_address_manager, or admins can lookup
    if (!hasAnyRole(currentUser, "yamioo_agent", "temp_address_manager", "admin", "admin_national", "admin_province", "admin_municipality")) {
      return errorResponse(new Error("Forbidden: requires yamioo_agent or admin role"), 403);
    }

    const { phone } = await req.json();
    if (!phone || typeof phone !== "string" || phone.trim().length < 6) {
      return errorResponse(new Error("Provide a valid phone number (min 6 digits)"), 400);
    }

    const { supabase } = await getAuthUser(req);

    // Search profiles by phone (partial match)
    const cleanPhone = phone.trim().replace(/\s+/g, "");
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone, afro_id, country, city")
      .or(`phone.ilike.%${cleanPhone}%,phone.ilike.%${cleanPhone.replace(/^\+/, "")}%`)
      .limit(5);

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      return errorResponse(new Error("Failed to search profiles"), 500);
    }

    if (!profiles || profiles.length === 0) {
      return jsonResponse({ found: false, results: [] });
    }

    // Enrich with email from auth.users and document info from afroloc_requests
    const results = await Promise.all(
      profiles.map(async (p) => {
        // Get email from auth.users
        const { data: authUser } = await supabase.auth.admin.getUserById(p.user_id);

        // Get latest document info from afroloc_requests (if any)
        const { data: latestRequest } = await supabase
          .from("afroloc_requests")
          .select("requester_document_type, requester_document_number, requester_name")
          .eq("requester_phone", p.phone || "")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          user_id: p.user_id,
          full_name: p.full_name || latestRequest?.requester_name || null,
          phone: p.phone,
          email: authUser?.user?.email || null,
          afro_id: p.afro_id,
          country: p.country,
          city: p.city,
          document_type: latestRequest?.requester_document_type || null,
          document_number: latestRequest?.requester_document_number || null,
        };
      })
    );

    // Audit the lookup
    const { supabase: svc } = await getAuthUser(req);
    await audit(svc, currentUser.id, "requester_lookup", "lookup-requester", { phone: cleanPhone, results_count: results.length }, req);

    return jsonResponse({ found: true, results });
  } catch (err) {
    return errorResponse(err);
  }
});
