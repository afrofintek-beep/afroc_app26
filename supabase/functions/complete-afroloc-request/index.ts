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
    
    // Require minimum level 2
    if (user.authorization_level < 2) {
      return errorResponse(new Error("Nível de autorização insuficiente"), 403);
    }
    
    const { 
      request_id, 
      site_visit_geo_lat, 
      site_visit_geo_lon, 
      site_visit_photo_path,
      site_visit_notes,
      action, // 'approve' | 'reject'
      rejection_reason
    } = await req.json();
    
    if (!request_id || !action) {
      return errorResponse(new Error("request_id e action são obrigatórios"), 400);
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
    
    // Verify assignment
    if (request.assigned_to_user_id !== user.id && user.authorization_level < 4) {
      return errorResponse(new Error("Não tem permissão para processar este pedido"), 403);
    }
    
    if (action === 'reject') {
      if (!rejection_reason) {
        return errorResponse(new Error("Motivo de rejeição é obrigatório"), 400);
      }
      
      await supabase
        .from("afroloc_requests")
        .update({
          status: 'rejected',
          rejection_reason,
          site_visit_at: new Date().toISOString(),
          site_visit_by_user_id: user.id,
          site_visit_geo_lat,
          site_visit_geo_lon,
          site_visit_notes,
        })
        .eq("id", request_id);
      
      // Send SMS notification to requester
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
      
      if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const message = `AFROLOC: Lamentamos informar que o seu pedido para ${request.street_name} ${request.house_number} foi rejeitado. Motivo: ${rejection_reason}`;
        
        await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
          },
          body: new URLSearchParams({
            To: request.requester_phone,
            From: twilioPhoneNumber,
            Body: message,
          }),
        });
      }
      
      await audit(supabase, user.id, "afroloc_request_rejected", "complete-afroloc-request", {
        request_id,
        rejection_reason,
      }, req);
      
      return jsonResponse({ success: true, message: "Pedido rejeitado" });
    }
    
    // Approve - create AFROLOC record
    if (action === 'approve') {
      // Use site visit coordinates if provided, otherwise fall back to request's geocoded coordinates
      const finalLat = site_visit_geo_lat || request.geo_lat;
      const finalLon = site_visit_geo_lon || request.geo_lon;
      
      if (!finalLat || !finalLon) {
        return errorResponse(new Error("Coordenadas GPS não disponíveis. Forneça coordenadas ou geocodifique o endereço."), 400);
      }
      
      const isRemoteApproval = !site_visit_geo_lat && !site_visit_geo_lon;
      
      // Generate AFROLOC code using QG engine
      const { data: qgData, error: qgError } = await supabase.functions.invoke("qg-engine", {
        body: {
          lat: finalLat,
          lon: finalLon,
          country_code: request.country_code,
        },
      });
      
      if (qgError || !qgData?.code) {
        console.error("QG engine error:", qgError);
        return errorResponse(new Error("Erro ao gerar código AFROLOC"), 500);
      }
      
      // Create AFROLOC record
      const { data: afrolocRecord, error: createError } = await supabase
        .from("afroloc_records")
        .insert({
          code: qgData.code,
          user_id: user.id, // Will need to be updated when requester creates account
          country: request.country_code,
          level1_code: request.level1_code,
          level1_name: request.level1_name,
          level2_code: request.level2_code,
          level2_name: request.level2_name,
          level3_code: request.level3_code,
          level3_name: request.level3_name,
          level4_code: request.level4_code,
          level4_name: request.level4_name,
          street_name: request.street_name,
          number: request.house_number,
          geo_lat: finalLat,
          geo_lon: finalLon,
          registered_by_user_id: user.id,
          status: 'pending',
          metadata: {
            source: isRemoteApproval ? 'sms_remote_approval' : 'sms_request',
            remote_approval: isRemoteApproval,
            request_id: request_id,
            requester_phone: request.requester_phone,
            requester_name: request.requester_name,
            requester_document_type: request.requester_document_type,
            requester_document_number: request.requester_document_number,
          },
        })
        .select()
        .single();
      
      if (createError) {
        console.error("Error creating AFROLOC record:", createError);
        throw createError;
      }
      
      // Update request as completed
      await supabase
        .from("afroloc_requests")
        .update({
          status: 'completed',
          resulting_afroloc_id: afrolocRecord.id,
          site_visit_at: isRemoteApproval ? null : new Date().toISOString(),
          site_visit_by_user_id: isRemoteApproval ? null : user.id,
          site_visit_geo_lat: site_visit_geo_lat || null,
          site_visit_geo_lon: site_visit_geo_lon || null,
          site_visit_photo_path,
          site_visit_notes: site_visit_notes || (isRemoteApproval ? 'Aprovação remota sem visita ao local' : null),
        })
        .eq("id", request_id);
      
      // Send SMS notification to requester
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
      
      if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const message = `AFROLOC: Parabéns! O seu código AFROLOC foi criado: ${qgData.code}. Visite afroloc.com para registar a sua conta.`;
        
        await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
          },
          body: new URLSearchParams({
            To: request.requester_phone,
            From: twilioPhoneNumber,
            Body: message,
          }),
        });
      }
      
      await audit(supabase, user.id, "afroloc_request_completed", "complete-afroloc-request", {
        request_id,
        afroloc_id: afrolocRecord.id,
        afroloc_code: qgData.code,
      }, req);
      
      console.log("AFROLOC request completed", { 
        request_id, 
        afroloc_code: qgData.code,
        completed_by: user.id 
      });
      
      return jsonResponse({ 
        success: true, 
        message: "AFROLOC criado com sucesso",
        afroloc_code: qgData.code,
        afroloc_id: afrolocRecord.id
      });
    }
    
    return errorResponse(new Error("Ação inválida"), 400);
    
  } catch (error) {
    console.error("Error completing request:", error);
    return errorResponse(error);
  }
};

serve(handler);
