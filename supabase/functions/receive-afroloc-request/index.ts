import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";
import { sendSms } from "../_shared/sms.ts";

// Generate a 6-digit OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Basic-auth do webhook inbound da Infobip
const isAuthorized = (req: Request): boolean => {
  const user = Deno.env.get("INFOBIP_INBOUND_USER");
  const pass = Deno.env.get("INFOBIP_INBOUND_PASS");
  if (!user || !pass) { console.warn("INFOBIP_INBOUND_USER/PASS não configurados — auth do webhook ignorada"); return true; }
  return (req.headers.get("authorization") || "") === "Basic " + btoa(`${user}:${pass}`);
};

// Parse address from SMS body
// Expected format: "AFROLOC Rua Nome 123 Bairro Cidade"
// Or structured: "AFROLOC|Rua Nome|123|Bairro|Cidade|-8.839988|13.289437"
const parseAddressFromSMS = (body: string): {
  street_name: string;
  house_number: string;
  neighborhood?: string;
  city?: string;
  geo_lat?: number;
  geo_lon?: number;
} | null => {
  const cleanBody = body.replace(/^AFROLOC\s*/i, '').trim();
  
  // Try structured format first (pipe-separated)
  if (cleanBody.includes('|')) {
    const parts = cleanBody.split('|').map(p => p.trim());
    if (parts.length >= 2) {
      return {
        street_name: parts[0],
        house_number: parts[1],
        neighborhood: parts[2] || undefined,
        city: parts[3] || undefined,
        geo_lat: parts[4] ? parseFloat(parts[4]) : undefined,
        geo_lon: parts[5] ? parseFloat(parts[5]) : undefined,
      };
    }
  }
  
  // Try natural format: "Rua Nome 123 Bairro"
  const numberMatch = cleanBody.match(/\b(\d+[A-Za-z]?)\b/);
  if (numberMatch) {
    const numberIndex = cleanBody.indexOf(numberMatch[1]);
    const streetPart = cleanBody.substring(0, numberIndex).trim();
    const afterNumber = cleanBody.substring(numberIndex + numberMatch[1].length).trim();
    
    // Try to extract coordinates if present
    const coordMatch = afterNumber.match(/([-]?\d+\.?\d*)\s*[,\s]\s*([-]?\d+\.?\d*)$/);
    let neighborhood = afterNumber;
    let geo_lat, geo_lon;
    
    if (coordMatch) {
      geo_lat = parseFloat(coordMatch[1]);
      geo_lon = parseFloat(coordMatch[2]);
      neighborhood = afterNumber.replace(coordMatch[0], '').trim();
    }
    
    return {
      street_name: streetPart || 'Não especificada',
      house_number: numberMatch[1],
      neighborhood: neighborhood || undefined,
      geo_lat,
      geo_lon,
    };
  }
  
  // Allow addresses without house number (digital addresses)
  if (cleanBody.length > 2) {
    return {
      street_name: cleanBody,
      house_number: 'S/N',
      neighborhood: undefined,
    };
  }
  
  return null;
};

// Try to geocode address using administrative divisions in the database
async function tryGeocode(
  supabase: any,
  streetName: string,
  neighborhood?: string,
  city?: string,
  countryCode = 'AO'
): Promise<{ lat: number; lon: number; level1_code?: string; level1_name?: string; level2_code?: string; level2_name?: string; level3_code?: string; level3_name?: string; level4_code?: string; level4_name?: string } | null> {
  try {
    // Try to find matching administrative divisions
    const searchTerms = [neighborhood, city, streetName].filter(Boolean);
    
    for (const term of searchTerms) {
      if (!term) continue;
      
      // Search administrative_divisions for a match
      const { data: divisions } = await supabase
        .from("administrative_divisions")
        .select("*")
        .eq("country_code", countryCode)
        .ilike("name", `%${term}%`)
        .order("level", { ascending: false })
        .limit(5);
      
      if (divisions && divisions.length > 0) {
        // Found a matching division - build hierarchy
        const division = divisions[0];
        const result: any = {};
        
        // Walk up the hierarchy to populate level codes
        let current = division;
        while (current) {
          if (current.level === 1) {
            result.level1_code = current.code;
            result.level1_name = current.name;
          } else if (current.level === 2) {
            result.level2_code = current.code;
            result.level2_name = current.name;
          } else if (current.level === 3) {
            result.level3_code = current.code;
            result.level3_name = current.name;
          } else if (current.level === 4) {
            result.level4_code = current.code;
            result.level4_name = current.name;
          }
          
          // Try to get parent
          if (current.parent_code) {
            const { data: parent } = await supabase
              .from("administrative_divisions")
              .select("*")
              .eq("country_code", countryCode)
              .eq("code", current.parent_code)
              .eq("level", current.parent_level)
              .single();
            
            current = parent;
          } else {
            current = null;
          }
        }
        
        // Try to find existing AFROLOC records in same area for approximate coordinates
        const levelFilter = result.level4_code || result.level3_code || result.level2_code || result.level1_code;
        const levelField = result.level4_code ? 'level4_code' : 
                          result.level3_code ? 'level3_code' : 
                          result.level2_code ? 'level2_code' : 'level1_code';
        
        if (levelFilter) {
          const { data: nearbyRecords } = await supabase
            .from("afroloc_records")
            .select("geo_lat, geo_lon")
            .eq(levelField, levelFilter)
            .not("geo_lat", "is", null)
            .not("geo_lon", "is", null)
            .limit(10);
          
          if (nearbyRecords && nearbyRecords.length > 0) {
            // Use average of nearby records as approximate geocode
            const avgLat = nearbyRecords.reduce((sum: number, r: any) => sum + r.geo_lat, 0) / nearbyRecords.length;
            const avgLon = nearbyRecords.reduce((sum: number, r: any) => sum + r.geo_lon, 0) / nearbyRecords.length;
            
            return { lat: avgLat, lon: avgLon, ...result };
          }
        }
        
        // Return hierarchy without coordinates (admin will need to provide or confirm)
        return { lat: 0, lon: 0, ...result };
      }
    }
    
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

// Send SMS via Infobip (shared helper)
async function sendSMS(to: string, message: string): Promise<boolean> {
  const res = await sendSms(to, message);
  if (!res.ok) { console.error("Falha ao enviar SMS (Infobip):", res.error); return false; }
  console.log("SMS sent successfully to", to);
  return true;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    let from = "";
    let body = "";
    let isInboundSms = false;
    let json: any = null;

    // Parse JSON once
    json = await req.json().catch(() => ({}));

    if (Array.isArray(json?.results)) {
      // Infobip inbound (MO) message
      if (!isAuthorized(req)) {
        return new Response(
          JSON.stringify({ error: "unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      const m = json.results[0] ?? {};
      from = m.from || "";
      body = (m.text || "").trim();
      isInboundSms = true;
      json = null;
    } else {
      // App/web caller
      from = json.phone_number || "";
      body = json.address_text || "";
    }

    const smsReply = async (text: string): Promise<Response> => {
      if (isInboundSms && from) { await sendSMS(from, text); }
      return new Response(JSON.stringify({ ok: true, message: text }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    };

    // Direct structured data
    if (json && json.street_name && json.house_number) {
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        
        // Try to geocode the address
        const geocodeResult = await tryGeocode(
          supabaseAdmin, 
          json.street_name, 
          json.neighborhood, 
          json.city, 
          json.country_code || 'AO'
        );
        
        // Create request with geocoded data
        const { data: request, error: insertError } = await supabaseAdmin
          .from("afroloc_requests")
          .insert({
            requester_phone: from,
            requester_name: json.requester_name,
            street_name: json.street_name,
            house_number: json.house_number,
            neighborhood: json.neighborhood,
            city: json.city,
            country_code: json.country_code || 'AO',
            level1_code: json.level1_code || geocodeResult?.level1_code,
            level1_name: json.level1_name || geocodeResult?.level1_name,
            level2_code: json.level2_code || geocodeResult?.level2_code,
            level2_name: json.level2_name || geocodeResult?.level2_name,
            level3_code: json.level3_code || geocodeResult?.level3_code,
            level3_name: json.level3_name || geocodeResult?.level3_name,
            level4_code: json.level4_code || geocodeResult?.level4_code,
            level4_name: json.level4_name || geocodeResult?.level4_name,
            geo_lat: json.geo_lat || geocodeResult?.lat || null,
            geo_lon: json.geo_lon || geocodeResult?.lon || null,
            facade_photo_path: json.facade_photo_path,
            otp_code: otp,
            otp_expires_at: expiresAt.toISOString(),
            status: 'pending_otp',
          })
          .select()
          .single();
        
        if (insertError) {
          console.error("Error creating request:", insertError);
          throw insertError;
        }
        
        // Send OTP via SMS
        await sendSMS(from, `AFROLOC: Seu código de verificação é ${otp}. Válido por 10 minutos. Não partilhe este código.`);
        
        // Log audit
        await supabaseAdmin.from("security_audit_log").insert({
          action: "afroloc_request_created",
          function_name: "receive-afroloc-request",
          details: {
            request_id: request.id,
            phone: from,
            address: `${json.street_name} ${json.house_number}`,
            geocoded: !!geocodeResult,
          },
        });
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            request_id: request.id,
            geocoded: !!geocodeResult,
            message: "Código de verificação enviado por SMS" 
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }

    // Process SMS body for AFROLOC request
    if (!body.toUpperCase().startsWith("AFROLOC")) {
      // Check if this is an OTP verification response
      const otpMatch = body.match(/^\d{6}$/);
      if (otpMatch) {
        // Find pending request for this phone with valid OTP
        const { data: requests } = await supabaseAdmin
          .from("afroloc_requests")
          .select("*")
          .eq("requester_phone", from)
          .eq("status", "pending_otp")
          .gt("otp_expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1);
        
        if (requests && requests.length > 0) {
          const request = requests[0];
          
          if (request.otp_code === body) {
            // OTP verified - auto-geocode and set to pending admin approval
            const geocodeResult = await tryGeocode(
              supabaseAdmin,
              request.street_name,
              request.neighborhood,
              request.city,
              request.country_code || 'AO'
            );
            
            const updateData: any = {
              otp_verified_at: new Date().toISOString(),
              status: 'pending', // Ready for remote admin approval (no field operator needed)
            };
            
            // Apply geocoded data if found
            if (geocodeResult) {
              if (!request.level1_code && geocodeResult.level1_code) updateData.level1_code = geocodeResult.level1_code;
              if (!request.level1_name && geocodeResult.level1_name) updateData.level1_name = geocodeResult.level1_name;
              if (!request.level2_code && geocodeResult.level2_code) updateData.level2_code = geocodeResult.level2_code;
              if (!request.level2_name && geocodeResult.level2_name) updateData.level2_name = geocodeResult.level2_name;
              if (!request.level3_code && geocodeResult.level3_code) updateData.level3_code = geocodeResult.level3_code;
              if (!request.level3_name && geocodeResult.level3_name) updateData.level3_name = geocodeResult.level3_name;
              if (!request.level4_code && geocodeResult.level4_code) updateData.level4_code = geocodeResult.level4_code;
              if (!request.level4_name && geocodeResult.level4_name) updateData.level4_name = geocodeResult.level4_name;
              if (!request.geo_lat && geocodeResult.lat) updateData.geo_lat = geocodeResult.lat;
              if (!request.geo_lon && geocodeResult.lon) updateData.geo_lon = geocodeResult.lon;
            }
            
            await supabaseAdmin
              .from("afroloc_requests")
              .update(updateData)
              .eq("id", request.id);
            
            console.log("OTP verified, request set to pending admin approval", { 
              request_id: request.id, 
              geocoded: !!geocodeResult 
            });
            
            return await smsReply("Código verificado! O seu pedido AFROLOC está a ser processado. Receberá o seu código por SMS quando aprovado.");
          } else {
            // Wrong OTP
            await supabaseAdmin
              .from("afroloc_requests")
              .update({ otp_attempts: (request.otp_attempts || 0) + 1 })
              .eq("id", request.id);
            
            if ((request.otp_attempts || 0) >= 2) {
              await supabaseAdmin
                .from("afroloc_requests")
                .update({ status: 'cancelled' })
                .eq("id", request.id);
              
              return await smsReply("Código expirado. Faça um novo pedido enviando AFROLOC seguido do seu endereço.");
            }
            
            return await smsReply("Código incorreto. Tente novamente.");
          }
        }
      }
      
      // Check for document info: "DOC BI 123456789 Nome Completo"
      const docMatch = body.match(/^DOC\s+(\w+)\s+(\S+)\s+(.+)$/i);
      if (docMatch) {
        const [, docType, docNumber, requesterName] = docMatch;
        
        // Find pending request for this phone
        const { data: requests } = await supabaseAdmin
          .from("afroloc_requests")
          .select("*")
          .eq("requester_phone", from)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1);
        
        if (requests && requests.length > 0) {
          await supabaseAdmin
            .from("afroloc_requests")
            .update({
              requester_name: requesterName.trim(),
              requester_document_type: docType.toUpperCase(),
              requester_document_number: docNumber,
            })
            .eq("id", requests[0].id);
          
          return await smsReply("Documento registado. O seu pedido está em análise. Receberá o seu código AFROLOC por SMS.");
        }
      }
      
      // Not an AFROLOC request
      return await smsReply("Para solicitar um AFROLOC, envie: AFROLOC Rua Nome 123 Bairro. Para registar documento: DOC BI 123456789 Nome Completo");
    }
    
    // Parse address from SMS
    const addressData = parseAddressFromSMS(body);
    
    if (!addressData) {
      return await smsReply("Formato inválido. Envie: AFROLOC Rua Nome 123 Bairro");
    }
    
    // Try to geocode the address
    const geocodeResult = await tryGeocode(supabaseAdmin, addressData.street_name, addressData.neighborhood, addressData.city);
    
    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    // Create request with geocoded data
    const { data: request, error: insertError } = await supabaseAdmin
      .from("afroloc_requests")
      .insert({
        requester_phone: from,
        street_name: addressData.street_name,
        house_number: addressData.house_number,
        neighborhood: addressData.neighborhood,
        city: addressData.city,
        geo_lat: addressData.geo_lat || geocodeResult?.lat || null,
        geo_lon: addressData.geo_lon || geocodeResult?.lon || null,
        level1_code: geocodeResult?.level1_code,
        level1_name: geocodeResult?.level1_name,
        level2_code: geocodeResult?.level2_code,
        level2_name: geocodeResult?.level2_name,
        level3_code: geocodeResult?.level3_code,
        level3_name: geocodeResult?.level3_name,
        level4_code: geocodeResult?.level4_code,
        level4_name: geocodeResult?.level4_name,
        otp_code: otp,
        otp_expires_at: expiresAt.toISOString(),
        status: 'pending_otp',
      })
      .select()
      .single();
    
    if (insertError) {
      console.error("Error creating request:", insertError);
      throw insertError;
    }
    
    console.log("AFROLOC request created via SMS", { 
      id: request.id, 
      phone: from, 
      address: `${addressData.street_name} ${addressData.house_number}`,
      geocoded: !!geocodeResult,
    });
    
    // Log audit
    await supabaseAdmin.from("security_audit_log").insert({
      action: "afroloc_request_created_sms",
      function_name: "receive-afroloc-request",
      details: {
        request_id: request.id,
        phone: from,
        address: `${addressData.street_name} ${addressData.house_number}`,
        geocoded: !!geocodeResult,
      },
    });
    
    // Send OTP confirmation
    return await smsReply(`Pedido recebido para ${addressData.street_name} ${addressData.house_number}. Seu código de verificação é: ${otp}. Responda com este código.`);
    
  } catch (error) {
    console.error("Error processing AFROLOC request:", error);
    return new Response(
      JSON.stringify({ ok: false, message: "Erro ao processar pedido. Tente novamente." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
