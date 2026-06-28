import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth_rbac.ts";

// Comprehensive test users configuration
const TEST_USERS = [
  {
    email: "admin.nacional@afroloc.test",
    password: "Admin123!",
    full_name: "Administrador Nacional",
    phone: "+244900000001",
    roles: ["admin", "admin_national"],
    level: 5,
    country: "AO"
  },
  // 21 Provincial Admins
  {
    email: "admin.luanda@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Luanda",
    phone: "+244900100001",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-LUA",
    level1_name: "Luanda"
  },
  {
    email: "admin.bengo@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Bengo",
    phone: "+244900100002",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-BGO",
    level1_name: "Bengo"
  },
  {
    email: "admin.benguela@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Benguela",
    phone: "+244900100003",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-BGU",
    level1_name: "Benguela"
  },
  {
    email: "admin.bie@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Bié",
    phone: "+244900100004",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-BIE",
    level1_name: "Bié"
  },
  {
    email: "admin.cabinda@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Cabinda",
    phone: "+244900100005",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-CAB",
    level1_name: "Cabinda"
  },
  {
    email: "admin.cubango@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Cubango",
    phone: "+244900100006",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-CUB",
    level1_name: "Cubango"
  },
  {
    email: "admin.cuando@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Cuando",
    phone: "+244900100007",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-CUA",
    level1_name: "Cuando"
  },
  {
    email: "admin.cuanzanorte@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Cuanza Norte",
    phone: "+244900100008",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-CNO",
    level1_name: "Cuanza Norte"
  },
  {
    email: "admin.cuanzasul@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Cuanza Sul",
    phone: "+244900100009",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-CUS",
    level1_name: "Cuanza Sul"
  },
  {
    email: "admin.cunene@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Cunene",
    phone: "+244900100010",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-CNN",
    level1_name: "Cunene"
  },
  {
    email: "admin.huambo@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Huambo",
    phone: "+244900100011",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-HUA",
    level1_name: "Huambo"
  },
  {
    email: "admin.huila@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Huíla",
    phone: "+244900100012",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-HUI",
    level1_name: "Huíla"
  },
  {
    email: "admin.icoloebengo@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Icolo e Bengo",
    phone: "+244900100013",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-ICO",
    level1_name: "Icolo e Bengo"
  },
  {
    email: "admin.lundanorte@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Lunda Norte",
    phone: "+244900100014",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-LNO",
    level1_name: "Lunda Norte"
  },
  {
    email: "admin.lundasul@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Lunda Sul",
    phone: "+244900100015",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-LSU",
    level1_name: "Lunda Sul"
  },
  {
    email: "admin.malanje@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Malanje",
    phone: "+244900100016",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-MAL",
    level1_name: "Malanje"
  },
  {
    email: "admin.moxico@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Moxico",
    phone: "+244900100017",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-MOX",
    level1_name: "Moxico"
  },
  {
    email: "admin.moxicoleste@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Moxico Leste",
    phone: "+244900100018",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-MXL",
    level1_name: "Moxico Leste"
  },
  {
    email: "admin.namibe@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Namibe",
    phone: "+244900100019",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-NAM",
    level1_name: "Namibe"
  },
  {
    email: "admin.uige@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Uíge",
    phone: "+244900100020",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-UIG",
    level1_name: "Uíge"
  },
  {
    email: "admin.zaire@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Provincial Zaire",
    phone: "+244900100021",
    roles: ["admin_province"],
    level: 4,
    country: "AO",
    level1_code: "AO-ZAI",
    level1_name: "Zaire"
  },
  // Sample Municipal Admins (21 sample municipalities - one per province capital)
  {
    email: "admin.mun.ingombota@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Ingombota",
    phone: "+244900200001",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-LUA",
    level1_name: "Luanda",
    level2_code: "ING",
    level2_name: "Ingombota"
  },
  {
    email: "admin.mun.dande@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Dande",
    phone: "+244900200002",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-BGO",
    level1_name: "Bengo",
    level2_code: "DAN",
    level2_name: "Dande"
  },
  {
    email: "admin.mun.benguela@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Benguela",
    phone: "+244900200003",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-BGU",
    level1_name: "Benguela",
    level2_code: "BEN",
    level2_name: "Benguela"
  },
  {
    email: "admin.mun.cuito@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Cuíto",
    phone: "+244900200004",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-BIE",
    level1_name: "Bié",
    level2_code: "CUI",
    level2_name: "Cuíto"
  },
  {
    email: "admin.mun.cabinda@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Cabinda",
    phone: "+244900200005",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-CAB",
    level1_name: "Cabinda",
    level2_code: "CAB",
    level2_name: "Cabinda"
  },
  {
    email: "admin.mun.menongue@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Menongue",
    phone: "+244900200006",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-CUB",
    level1_name: "Cubango",
    level2_code: "MEN",
    level2_name: "Menongue"
  },
  {
    email: "admin.mun.mavinga@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Mavinga",
    phone: "+244900200007",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-CUA",
    level1_name: "Cuando",
    level2_code: "MAV",
    level2_name: "Mavinga"
  },
  {
    email: "admin.mun.cazengo@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Cazengo",
    phone: "+244900200008",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-CNO",
    level1_name: "Cuanza Norte",
    level2_code: "CAZ",
    level2_name: "Cazengo"
  },
  {
    email: "admin.mun.sumbe@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Sumbe",
    phone: "+244900200009",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-CUS",
    level1_name: "Cuanza Sul",
    level2_code: "SUM",
    level2_name: "Sumbe"
  },
  {
    email: "admin.mun.ondjiva@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Ondjiva",
    phone: "+244900200010",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-CNN",
    level1_name: "Cunene",
    level2_code: "OND",
    level2_name: "Ondjiva"
  },
  {
    email: "admin.mun.huambo@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Huambo",
    phone: "+244900200011",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-HUA",
    level1_name: "Huambo",
    level2_code: "HUA",
    level2_name: "Huambo"
  },
  {
    email: "admin.mun.lubango@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Lubango",
    phone: "+244900200012",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-HUI",
    level1_name: "Huíla",
    level2_code: "LUB",
    level2_name: "Lubango"
  },
  {
    email: "admin.mun.catete@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Catete",
    phone: "+244900200013",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-ICO",
    level1_name: "Icolo e Bengo",
    level2_code: "CAT",
    level2_name: "Catete"
  },
  {
    email: "admin.mun.dundo@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Dundo",
    phone: "+244900200014",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-LNO",
    level1_name: "Lunda Norte",
    level2_code: "DUN",
    level2_name: "Dundo"
  },
  {
    email: "admin.mun.saurimo@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Saurimo",
    phone: "+244900200015",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-LSU",
    level1_name: "Lunda Sul",
    level2_code: "SAU",
    level2_name: "Saurimo"
  },
  {
    email: "admin.mun.malanje@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Malanje",
    phone: "+244900200016",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-MAL",
    level1_name: "Malanje",
    level2_code: "MAL",
    level2_name: "Malanje"
  },
  {
    email: "admin.mun.luena@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Luena",
    phone: "+244900200017",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-MOX",
    level1_name: "Moxico",
    level2_code: "LUE",
    level2_name: "Luena"
  },
  {
    email: "admin.mun.cazombo@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Cazombo",
    phone: "+244900200018",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-MXL",
    level1_name: "Moxico Leste",
    level2_code: "CZB",
    level2_name: "Cazombo"
  },
  {
    email: "admin.mun.mocamedes@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Moçâmedes",
    phone: "+244900200019",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-NAM",
    level1_name: "Namibe",
    level2_code: "MOC",
    level2_name: "Moçâmedes"
  },
  {
    email: "admin.mun.uige@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Uíge",
    phone: "+244900200020",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-UIG",
    level1_name: "Uíge",
    level2_code: "UIG",
    level2_name: "Uíge"
  },
  {
    email: "admin.mun.mbanzakongo@afroloc.test",
    password: "Admin123!",
    full_name: "Admin Municipal Mbanza Kongo",
    phone: "+244900200021",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-ZAI",
    level1_name: "Zaire",
    level2_code: "MBK",
    level2_name: "Mbanza Kongo"
  },
  // Municipal Admin
  {
    email: "admin.municipal@afroloc.test",
    password: "Admin123!",
    full_name: "Administrador Municipal Talatona",
    phone: "+244900000003",
    roles: ["admin_municipality"],
    level: 3,
    country: "AO",
    level1_code: "AO-LUA",
    level1_name: "Luanda",
    level2_code: "TAL",
    level2_name: "Talatona"
  },
  {
    email: "operador.campo@afroloc.test",
    password: "Oper123!",
    full_name: "Operador de Campo",
    phone: "+244900000004",
    roles: ["operator_field"],
    level: 2,
    country: "AO",
    level1_code: "AO-LUA",
    level1_name: "Luanda"
  },
  {
    email: "cidadao1@afroloc.test",
    password: "Cid123!",
    full_name: "Maria Santos",
    phone: "+244900000005",
    roles: ["citizen"],
    level: 1,
    country: "AO"
  },
  {
    email: "cidadao2@afroloc.test",
    password: "Cid123!",
    full_name: "João Pereira",
    phone: "+244900000006",
    roles: ["citizen"],
    level: 1,
    country: "AO"
  },
  {
    email: "cidadao3@afroloc.test",
    password: "Cid123!",
    full_name: "Ana Costa",
    phone: "+244900000007",
    roles: ["citizen"],
    level: 1,
    country: "AO"
  },
  {
    email: "auditor@afroloc.test",
    password: "Audit123!",
    full_name: "Auditor Externo",
    phone: "+244900000008",
    roles: ["auditor_read"],
    level: 2,
    country: "AO"
  },
  {
    email: "validador.bengo@afroloc.test",
    password: "Valid123!",
    full_name: "Validador Bengo",
    phone: "+244900000009",
    roles: ["validator"],
    level: 3,
    country: "AO",
    level1_code: "AO-BGO",
    level1_name: "Bengo"
  },
  {
    email: "testemunha1@afroloc.test",
    password: "Test123!",
    full_name: "Testemunha Vizinho 1",
    phone: "+244900000010",
    roles: ["citizen"],
    level: 1,
    country: "AO"
  },
  {
    email: "testemunha2@afroloc.test",
    password: "Test123!",
    full_name: "Testemunha Vizinho 2",
    phone: "+244900000011",
    roles: ["citizen"],
    level: 1,
    country: "AO"
  }
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const results = {
    users: [] as { email: string; password: string; role: string; status: string }[],
    addresses: [] as { code: string; status: string; type: string; owner: string }[],
    witnesses: 0,
    validations: 0,
    fraud_flags: 0,
    telecom_operators: 0,
    cell_towers: 0,
    divisions: 0,
    documents: 0,
    errors: [] as string[]
  };

  const userIdMap: Record<string, string> = {};

  try {
    // ============ CREATE TEST USERS ============
    console.log("Creating test users...");
    for (const user of TEST_USERS) {
      try {
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === user.email);

        let userId: string;

        if (existingUser) {
          await supabase.auth.admin.updateUserById(existingUser.id, {
            password: user.password
          });
          userId = existingUser.id;
          results.users.push({ 
            email: user.email, 
            password: user.password, 
            role: user.roles[0],
            status: "updated" 
          });
        } else {
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: user.password,
            email_confirm: true,
            user_metadata: { full_name: user.full_name }
          });

          if (createError) {
            results.errors.push(`User ${user.email}: ${createError.message}`);
            continue;
          }
          userId = newUser.user.id;
          results.users.push({ 
            email: user.email, 
            password: user.password, 
            role: user.roles[0],
            status: "created" 
          });
        }

        userIdMap[user.email] = userId;

        // Create AFRO ID for user
        const afroId = `AO-${user.full_name.substring(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        // Ensure profile exists
        await supabase.from("profiles").upsert({
          user_id: userId,
          full_name: user.full_name,
          phone: user.phone,
          country: user.country,
          afro_id: afroId,
          onboarding_completed: true
        }, { onConflict: "user_id" });

        // Set roles
        await supabase.from("user_roles").delete().eq("user_id", userId);
        for (const role of user.roles) {
          await supabase.from("user_roles").insert({
            user_id: userId,
            role: role
          });
        }

        // Set authorization level
        await supabase.from("user_authorization_levels").upsert({
          user_id: userId,
          current_level: user.level,
          jurisdiction_country: user.country,
          jurisdiction_level1_code: user.level1_code || null,
          jurisdiction_level1_name: user.level1_name || null,
          jurisdiction_level2_code: user.level2_code || null,
          jurisdiction_level2_name: user.level2_name || null,
          administrative_role: user.roles[0]
        }, { onConflict: "user_id" });

      } catch (err) {
        results.errors.push(`User ${user.email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ============ CREATE ADMINISTRATIVE DIVISIONS ============
    console.log("Creating administrative divisions...");
    const divisions = [
      { country_code: "AO", code: "LUA", name: "Luanda", level: 1 },
      { country_code: "AO", code: "BGO", name: "Bengo", level: 1 },
      { country_code: "AO", code: "CBN", name: "Cabinda", level: 1 },
      { country_code: "AO", code: "HUI", name: "Huíla", level: 1 },
      { country_code: "AO", code: "TAL", name: "Talatona", level: 2, parent_code: "LUA", parent_level: 1 },
      { country_code: "AO", code: "VIA", name: "Viana", level: 2, parent_code: "LUA", parent_level: 1 },
      { country_code: "AO", code: "MAI", name: "Maianga", level: 2, parent_code: "LUA", parent_level: 1 },
      { country_code: "AO", code: "CAZ", name: "Cazenga", level: 2, parent_code: "LUA", parent_level: 1 },
      { country_code: "AO", code: "RAN", name: "Rangel", level: 2, parent_code: "LUA", parent_level: 1 },
      { country_code: "AO", code: "DAD", name: "Dande", level: 2, parent_code: "BGO", parent_level: 1 },
      { country_code: "AO", code: "CAX", name: "Caxito", level: 2, parent_code: "BGO", parent_level: 1 },
    ];

    for (const div of divisions) {
      const { error } = await supabase.from("administrative_divisions").upsert(div, { 
        onConflict: "country_code,code" 
      });
      if (!error) results.divisions++;
    }

    // ============ CREATE TELECOM OPERATORS ============
    console.log("Creating telecom operators...");
    const { data: luandaDiv } = await supabase
      .from("administrative_divisions")
      .select("id")
      .eq("code", "LUA")
      .eq("country_code", "AO")
      .single();

    const telecomOperators = [
      {
        operator_code: "UNITEL",
        operator_name: "Unitel Angola",
        country_code: "AO",
        phone_prefixes: ["+244923", "+244924", "+244925", "+244926"],
        otp_provider: "twilio",
        is_active: true,
        administrative_division_id: luandaDiv?.id
      },
      {
        operator_code: "MOVICEL",
        operator_name: "Movicel Angola",
        country_code: "AO",
        phone_prefixes: ["+244912", "+244913", "+244914", "+244915"],
        otp_provider: "twilio",
        is_active: true,
        administrative_division_id: luandaDiv?.id
      },
      {
        operator_code: "AFRICELL",
        operator_name: "Africell Angola",
        country_code: "AO",
        phone_prefixes: ["+244931", "+244932", "+244933"],
        otp_provider: "twilio",
        is_active: true,
        administrative_division_id: luandaDiv?.id
      }
    ];

    for (const op of telecomOperators) {
      const { error } = await supabase.from("telecom_operators").upsert(op, {
        onConflict: "country_code,operator_code"
      });
      if (!error) results.telecom_operators++;
    }

    // Get operator IDs for cell towers
    const { data: operators } = await supabase
      .from("telecom_operators")
      .select("id, operator_code")
      .eq("country_code", "AO");

    // ============ CREATE CELL TOWERS ============
    console.log("Creating cell towers...");
    const unitelId = operators?.find(o => o.operator_code === "UNITEL")?.id;
    const movicelId = operators?.find(o => o.operator_code === "MOVICEL")?.id;

    const cellTowers = [
      // Talatona towers
      {
        cell_id: "AO-LUA-TAL-001",
        country_code: "AO",
        mcc: "631",
        mnc: "02",
        latitude: -8.9230,
        longitude: 13.1920,
        technology: "4G",
        coverage_radius_meters: 2000,
        level1_code: "LUA",
        level1_name: "Luanda",
        level2_code: "TAL",
        level2_name: "Talatona",
        telecom_operator_id: unitelId,
        is_active: true
      },
      {
        cell_id: "AO-LUA-TAL-002",
        country_code: "AO",
        mcc: "631",
        mnc: "02",
        latitude: -8.9180,
        longitude: 13.2050,
        technology: "4G",
        coverage_radius_meters: 1500,
        level1_code: "LUA",
        level1_name: "Luanda",
        level2_code: "TAL",
        level2_name: "Talatona",
        telecom_operator_id: movicelId,
        is_active: true
      },
      // Viana towers
      {
        cell_id: "AO-LUA-VIA-001",
        country_code: "AO",
        mcc: "631",
        mnc: "02",
        latitude: -8.9050,
        longitude: 13.3720,
        technology: "3G",
        coverage_radius_meters: 3000,
        level1_code: "LUA",
        level1_name: "Luanda",
        level2_code: "VIA",
        level2_name: "Viana",
        telecom_operator_id: unitelId,
        is_active: true
      },
      // Maianga towers
      {
        cell_id: "AO-LUA-MAI-001",
        country_code: "AO",
        mcc: "631",
        mnc: "02",
        latitude: -8.8380,
        longitude: 13.2340,
        technology: "4G",
        coverage_radius_meters: 1000,
        level1_code: "LUA",
        level1_name: "Luanda",
        level2_code: "MAI",
        level2_name: "Maianga",
        telecom_operator_id: unitelId,
        is_active: true
      },
      // Bengo towers
      {
        cell_id: "AO-BGO-DAD-001",
        country_code: "AO",
        mcc: "631",
        mnc: "02",
        latitude: -8.4650,
        longitude: 13.5420,
        technology: "2G",
        coverage_radius_meters: 5000,
        level1_code: "BGO",
        level1_name: "Bengo",
        level2_code: "DAD",
        level2_name: "Dande",
        telecom_operator_id: movicelId,
        is_active: true
      }
    ];

    for (const tower of cellTowers) {
      const { error } = await supabase.from("cell_towers").upsert(tower, {
        onConflict: "cell_id,mcc,mnc"
      });
      if (!error) results.cell_towers++;
    }

    // ============ CREATE TEST ADDRESSES ============
    console.log("Creating test addresses...");
    
    // Get user IDs
    const mariaSantosId = userIdMap["cidadao1@afroloc.test"];
    const joaoPereiraId = userIdMap["cidadao2@afroloc.test"];
    const anaCostaId = userIdMap["cidadao3@afroloc.test"];

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const testAddresses = [
      // Maria Santos - 3 addresses (different statuses and verification cycles)
      {
        user_id: mariaSantosId,
        code: "AO-ZU-G10-XTEST1-YTEST1",
        status: "certified",
        address_type: "formal",
        property_type: "house",
        street_name: "Rua Major Kanhangulo",
        number: "78",
        level1_code: "LUA",
        level1_name: "Luanda",
        level2_code: "TAL",
        level2_name: "Talatona",
        geo_lat: -8.9230,
        geo_lon: 13.1920,
        photo_exif_gps_lat: -8.9231,
        photo_exif_gps_lon: 13.1921,
        photo_exif_device_make: "Samsung",
        photo_exif_device_model: "Galaxy S21",
        last_verified_at: new Date(now - 170 * DAY).toISOString(),
        next_verification_due: new Date(now + 4 * DAY).toISOString(), // RED - urgent
        gps_validated_at: new Date(now - 170 * DAY).toISOString()
      },
      {
        user_id: mariaSantosId,
        code: "AO-ZU-G10-XTEST2-YTEST2",
        status: "certified",
        address_type: "formal",
        property_type: "commercial",
        street_name: "Avenida Central",
        number: "88",
        level1_code: "LUA",
        level1_name: "Luanda",
        level2_code: "MAI",
        level2_name: "Maianga",
        geo_lat: -8.8380,
        geo_lon: 13.2340,
        last_verified_at: new Date(now - 60 * DAY).toISOString(),
        next_verification_due: new Date(now + 30 * DAY).toISOString(), // YELLOW - upcoming
        gps_validated_at: new Date(now - 60 * DAY).toISOString()
      },
      {
        user_id: mariaSantosId,
        code: "AO-ZU-G10-XTEST3-YTEST3",
        status: "certified",
        address_type: "formal",
        property_type: "apartment",
        street_name: "Rua da Missão",
        number: "45",
        level1_code: "LUA",
        level1_name: "Luanda",
        level2_code: "VIA",
        level2_name: "Viana",
        geo_lat: -8.9050,
        geo_lon: 13.3720,
        last_verified_at: new Date(now - 30 * DAY).toISOString(),
        next_verification_due: new Date(now + 150 * DAY).toISOString(), // GREEN - ok
        gps_validated_at: new Date(now - 30 * DAY).toISOString()
      },
      // João Pereira - 2 addresses
      {
        user_id: joaoPereiraId,
        code: "AO-ZU-G10-XTEST4-YTEST4",
        status: "draft",
        address_type: "formal",
        property_type: "house",
        street_name: "Travessa dos Flores",
        number: "12",
        level1_code: "LUA",
        level1_name: "Luanda",
        level2_code: "TAL",
        level2_name: "Talatona",
        geo_lat: -8.9150,
        geo_lon: 13.2050
      },
      {
        user_id: joaoPereiraId,
        code: "AO-ZU-G10-XTEST5-YTEST5",
        status: "verified",
        address_type: "digital",
        property_type: "house",
        level1_code: "LUA",
        level1_name: "Luanda",
        level2_code: "CAZ",
        level2_name: "Cazenga",
        geo_lat: -8.8450,
        geo_lon: 13.2890
      },
      // Ana Costa - 2 addresses (including high-risk digital)
      {
        user_id: anaCostaId,
        code: "AO-ZU-G10-XTEST6-YTEST6",
        status: "certified",
        address_type: "digital",
        property_type: "house",
        level1_code: "LUA",
        level1_name: "Luanda",
        level2_code: "RAN",
        level2_name: "Rangel",
        geo_lat: -8.8520,
        geo_lon: 13.2180,
        last_verified_at: new Date(now - 100 * DAY).toISOString(),
        next_verification_due: new Date(now + 20 * DAY).toISOString() // HIGH RISK digital
      },
      {
        user_id: anaCostaId,
        code: "AO-ZR-G25-XTEST7-YTEST7",
        status: "draft",
        address_type: "digital",
        property_type: "land",
        level1_code: "BGO",
        level1_name: "Bengo",
        level2_code: "DAD",
        level2_name: "Dande",
        geo_lat: -8.4650,
        geo_lon: 13.5420
      },
      // Draft address for testing
      {
        user_id: anaCostaId,
        code: "AO-ZR-G25-XTEST8-YTEST8",
        status: "draft",
        address_type: "digital",
        property_type: "other",
        level1_code: "BGO",
        level1_name: "Bengo",
        level2_code: "CAX",
        level2_name: "Caxito",
        geo_lat: -8.5780,
        geo_lon: 13.6610
      }
    ];

    for (const addr of testAddresses) {
      if (!addr.user_id) continue;
      
      const { data: existing } = await supabase
        .from("afroloc_records")
        .select("id")
        .eq("code", addr.code)
        .single();

      if (!existing) {
        const { error } = await supabase.from("afroloc_records").insert({
          ...addr,
          country: "AO"
        });

        if (!error) {
          results.addresses.push({
            code: addr.code,
            status: addr.status,
            type: addr.address_type,
            owner: addr.user_id === mariaSantosId ? "Maria Santos" : 
                   addr.user_id === joaoPereiraId ? "João Pereira" : "Ana Costa"
          });
        } else {
          results.errors.push(`Address ${addr.code}: ${error.message}`);
        }
      } else {
        await supabase.from("afroloc_records").update(addr).eq("code", addr.code);
        results.addresses.push({
          code: addr.code,
          status: addr.status,
          type: addr.address_type + " (updated)",
          owner: "updated"
        });
      }
    }

    // ============ CREATE WITNESSES ============
    console.log("Creating witnesses...");
    const testemunha1Id = userIdMap["testemunha1@afroloc.test"];
    const testemunha2Id = userIdMap["testemunha2@afroloc.test"];
    const operadorId = userIdMap["operador.campo@afroloc.test"];

    // Get profiles with AFRO IDs
    const { data: witnessProfiles } = await supabase
      .from("profiles")
      .select("user_id, afro_id")
      .in("user_id", [testemunha1Id, testemunha2Id, operadorId].filter(Boolean));

    // Get certified addresses for witnesses
    const { data: certifiedAddresses } = await supabase
      .from("afroloc_records")
      .select("id, code")
      .in("code", ["AO-ZU-G10-XTEST1-YTEST1", "AO-ZU-G10-XTEST2-YTEST2", "AO-ZU-G10-XTEST3-YTEST3"]);

    if (certifiedAddresses && witnessProfiles) {
      for (const addr of certifiedAddresses) {
        for (const witness of witnessProfiles) {
          if (!witness.user_id) continue;
          
          const { data: existingWitness } = await supabase
            .from("afroloc_witnesses")
            .select("id")
            .eq("afroloc_record_id", addr.id)
            .eq("witness_user_id", witness.user_id)
            .single();

          if (!existingWitness) {
            await supabase.from("afroloc_witnesses").insert({
              afroloc_record_id: addr.id,
              witness_user_id: witness.user_id,
              witness_afro_id: witness.afro_id || "AO-TEST-WIT-001",
              status: "confirmed",
              confirmed_at: new Date(now - 35 * DAY).toISOString(),
              witness_reputation_score: 75 + Math.floor(Math.random() * 25)
            });
            results.witnesses++;
          }
        }
      }
    }

    // Add pending witnesses to pending_witness address
    const { data: pendingAddr } = await supabase
      .from("afroloc_records")
      .select("id")
      .eq("code", "AO-ZU-G10-XTEST4-YTEST4")
      .single();

    if (pendingAddr && testemunha1Id) {
      const witProfile = witnessProfiles?.find(p => p.user_id === testemunha1Id);
      const { data: existingPending } = await supabase
        .from("afroloc_witnesses")
        .select("id")
        .eq("afroloc_record_id", pendingAddr.id)
        .eq("witness_user_id", testemunha1Id)
        .single();

      if (!existingPending) {
        await supabase.from("afroloc_witnesses").insert({
          afroloc_record_id: pendingAddr.id,
          witness_user_id: testemunha1Id,
          witness_afro_id: witProfile?.afro_id || "AO-TEST-WIT-001",
          status: "pending"
        });
        results.witnesses++;
      }
    }

    // ============ CREATE VALIDATIONS ============
    console.log("Creating validations...");
    const validadorId = userIdMap["admin.municipal@afroloc.test"];

    if (certifiedAddresses) {
      for (const addr of certifiedAddresses) {
        const { data: existingValidation } = await supabase
          .from("afroloc_validations")
          .select("id")
          .eq("afroloc_record_id", addr.id)
          .single();

        if (!existingValidation) {
          await supabase.from("afroloc_validations").insert({
            afroloc_record_id: addr.id,
            validation_method: "authority_gps",
            verified_at: new Date(now - 30 * DAY).toISOString(),
            authority_role: "admin_municipality",
            authority_signature: validadorId,
            notes: "Validação oficial - GPS verificado presencialmente"
          });
          results.validations++;
        }
      }
    }

    // ============ CREATE FRAUD FLAGS ============
    console.log("Creating fraud flags...");
    const fraudFlags = [
      {
        witness_user_id: testemunha1Id,
        flag_type: "rapid_confirmations",
        severity: "medium",
        description: "5 confirmações em menos de 1 hora",
        resolved: false
      },
      {
        witness_user_id: testemunha2Id,
        flag_type: "cross_region",
        severity: "high",
        description: "Testemunho em 3 províncias diferentes no mesmo dia",
        resolved: true,
        resolved_at: new Date(now - 5 * DAY).toISOString(),
        resolution_notes: "Verificado - utilizador é transportador com viagens frequentes"
      }
    ];

    for (const flag of fraudFlags) {
      if (!flag.witness_user_id) continue;
      
      const { error } = await supabase.from("witness_fraud_flags").insert(flag);
      if (!error) results.fraud_flags++;
    }

    // ============ CREATE DOCUMENTS ============
    console.log("Creating test documents...");
    const documents = [
      {
        title: "Manual de Registo AFROLOC",
        category: "Técnico",
        language: "pt",
        version: "1.0",
        published_at: new Date(now - 60 * DAY).toISOString(),
        file_path: "documents/manual-registo-afroloc-v1.pdf",
        sha256: "abc123def456789",
        visibility: "public"
      },
      {
        title: "Regulamento Legal AFROLOC",
        category: "Jurídico",
        language: "pt",
        version: "2.0",
        published_at: new Date(now - 30 * DAY).toISOString(),
        file_path: "documents/regulamento-legal-v2.pdf",
        sha256: "xyz789abc123456",
        visibility: "public"
      },
      {
        title: "Guia do Operador de Campo",
        category: "Governo",
        language: "pt",
        version: "1.5",
        published_at: new Date(now - 15 * DAY).toISOString(),
        file_path: "documents/guia-operador-v1.5.pdf",
        sha256: "qwe456rty789012",
        visibility: "internal"
      }
    ];

    for (const doc of documents) {
      const { data: existing } = await supabase
        .from("documents")
        .select("id")
        .eq("title", doc.title)
        .eq("version", doc.version)
        .single();

      if (!existing) {
        const { error } = await supabase.from("documents").insert(doc);
        if (!error) results.documents++;
      }
    }

    // ============ CREATE SECURITY AUDIT LOG ENTRIES ============
    console.log("Creating audit log entries...");
    const auditEntries = [
      {
        user_id: userIdMap["admin.nacional@afroloc.test"],
        action: "USER_ROLE_CHANGE",
        function_name: "admin-users",
        details: { target_user: "cidadao1@afroloc.test", old_role: "citizen", new_role: "validator" }
      },
      {
        user_id: userIdMap["operador.campo@afroloc.test"],
        action: "ADDRESS_CREATED",
        function_name: "address-create",
        details: { code: "AO-ZU-G10-XTEST1-YTEST1", type: "formal" }
      },
      {
        user_id: userIdMap["admin.municipal@afroloc.test"],
        action: "GPS_VALIDATION",
        function_name: "address-verify",
        details: { code: "AO-ZU-G10-XTEST1-YTEST1", method: "authority_gps" }
      }
    ];

    for (const entry of auditEntries) {
      if (entry.user_id) {
        await supabase.from("security_audit_log").insert(entry);
      }
    }

    // ============ CREATE COUNTRY CONFIG ============
    console.log("Creating country config...");
    await supabase.from("countries").upsert({
      country_code: "AO",
      country_name: "Angola",
      phone_country_code: "+244",
      phone_number_format: "9XX XXX XXX",
      afro_id_prefix: "AO",
      afro_id_format: "AO-XXX-XXXXXXXX",
      admin_levels_count: 4,
      level1_label: "Província",
      level2_label: "Município",
      level3_label: "Comuna",
      level4_label: "Bairro",
      min_witnesses_required: 2,
      requires_witness_validation: true,
      requires_authority_validation: true,
      language_codes: ["pt", "kmb", "umb", "kg"],
      timezone: "Africa/Luanda",
      currency: "AOA",
      is_active: true
    }, { onConflict: "country_code" });

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          users_processed: results.users.length,
          addresses_created: results.addresses.length,
          witnesses_created: results.witnesses,
          validations_created: results.validations,
          fraud_flags_created: results.fraud_flags,
          telecom_operators: results.telecom_operators,
          cell_towers: results.cell_towers,
          divisions: results.divisions,
          documents: results.documents
        },
        test_credentials: results.users.map(u => ({
          email: u.email,
          password: u.password,
          role: u.role,
          status: u.status
        })),
        test_addresses: results.addresses,
        errors: results.errors.length > 0 ? results.errors : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Seed error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        partial_results: results
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
