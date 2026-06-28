import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  corsHeaders, 
  getCurrentUser, 
  jsonResponse, 
  errorResponse, 
  audit 
} from "../_shared/auth_rbac.ts";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = await getCurrentUser(req);
    
    // Require minimum level 4
    if (user.authorization_level < 4) {
      return errorResponse(new Error("Apenas utilizadores de nível 4+ podem delegar pedidos"), 403);
    }
    
    const { request_id, assign_to_user_id, notes } = await req.json();
    
    if (!request_id || !assign_to_user_id) {
      return errorResponse(new Error("request_id e assign_to_user_id são obrigatórios"), 400);
    }
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    
    // Get the request
    const { data: request, error: fetchError } = await supabase
      .from("afroloc_requests")
      .select("*")
      .eq("id", request_id)
      .single();
    
    if (fetchError || !request) {
      return errorResponse(new Error("Pedido não encontrado"), 404);
    }
    
    // Validate target user has level 2 or 3
    const { data: targetUser, error: targetError } = await supabase
      .from("user_authorization_levels")
      .select("*")
      .eq("user_id", assign_to_user_id)
      .single();
    
    if (targetError || !targetUser) {
      return errorResponse(new Error("Utilizador alvo não encontrado"), 404);
    }
    
    if (targetUser.current_level < 2 || targetUser.current_level >= 4) {
      return errorResponse(new Error("Apenas pode delegar a utilizadores de nível 2 ou 3"), 400);
    }
    
    // Check jurisdiction match
    const jurisdictionMatch = 
      user.jurisdiction_country === request.country_code ||
      (targetUser.jurisdiction_level1_code && targetUser.jurisdiction_level1_code === request.level1_code);
    
    if (!jurisdictionMatch) {
      return errorResponse(new Error("Utilizador alvo não tem jurisdição sobre esta área"), 400);
    }
    
    // Get previous assignee for reassignment record
    const previousAssignee = request.assigned_to_user_id;
    
    // Update request
    const { error: updateError } = await supabase
      .from("afroloc_requests")
      .update({
        assigned_to_user_id: assign_to_user_id,
        assigned_by_user_id: user.id,
        assigned_at: new Date().toISOString(),
        status: 'assigned',
      })
      .eq("id", request_id);
    
    if (updateError) {
      throw updateError;
    }
    
    // Record assignment history
    await supabase
      .from("afroloc_request_assignments")
      .insert({
        request_id,
        assigned_to_user_id: assign_to_user_id,
        assigned_by_user_id: user.id,
        reassignment_reason: previousAssignee ? "Reatribuição manual" : null,
        notes,
      });
    
    // Send notification to assigned user
    await supabase
      .from("validator_notifications")
      .insert({
        user_id: assign_to_user_id,
        type: "afroloc_request_assigned",
        title: "Novo pedido AFROLOC atribuído",
        message: `Foi-lhe atribuído um pedido para ${request.street_name} ${request.house_number}`,
        priority: "high",
        metadata: {
          request_id,
          address: `${request.street_name} ${request.house_number}`,
          neighborhood: request.neighborhood,
        },
      });
    
    // Audit log
    await audit(supabase, user.id, "afroloc_request_assigned", "assign-afroloc-request", {
      request_id,
      assigned_to: assign_to_user_id,
      previous_assignee: previousAssignee,
    }, req);
    
    console.log("Request assigned successfully", { 
      request_id, 
      assigned_by: user.id, 
      assigned_to: assign_to_user_id 
    });
    
    return jsonResponse({ 
      success: true,
      message: "Pedido atribuído com sucesso"
    });
    
  } catch (error) {
    console.error("Error assigning request:", error);
    return errorResponse(error);
  }
};

serve(handler);
