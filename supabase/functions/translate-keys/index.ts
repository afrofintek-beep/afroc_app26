import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

interface TranslationRequest {
  sourceLanguage: string;
  targetLanguage: string;
  keys: Record<string, string>; // key -> Portuguese value
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sourceLanguage, targetLanguage, keys }: TranslationRequest = await req.json();
    
    const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY");
    if (!AI_GATEWAY_API_KEY) {
      throw new Error("AI_GATEWAY_API_KEY is not configured");
    }

    const languageNames: Record<string, string> = {
      'en': 'English',
      'fr': 'French',
      'ar': 'Arabic',
      'am': 'Amharic',
      'sw': 'Swahili',
      'ln': 'Lingala',
      'yo': 'Yoruba',
      'sn': 'Shona',
      'zu': 'Zulu',
      'kmb': 'Kimbundu',
      'umb': 'Umbundu',
      'kg': 'Kikongo',
      'pt': 'Portuguese'
    };

    const targetLangName = languageNames[targetLanguage] || targetLanguage;
    const keysList = Object.entries(keys);
    
    console.log(`Translating ${keysList.length} keys to ${targetLangName}`);

    // Process in batches of 50 to avoid token limits
    const batchSize = 50;
    const results: Record<string, string> = {};
    
    for (let i = 0; i < keysList.length; i += batchSize) {
      const batch = keysList.slice(i, i + batchSize);
      const batchObject = Object.fromEntries(batch);
      
      const prompt = `You are a professional translator. Translate these UI strings from Portuguese to ${targetLangName}.

IMPORTANT RULES:
1. Preserve all placeholders like {count}, {days}, {hours}, {name}, etc. exactly as they are
2. Keep the same JSON key names - only translate the values
3. Maintain the same tone (formal/informal) as the original
4. For technical terms like "AFROLOC", "GPS", "OTP", "API", keep them in English
5. Return ONLY valid JSON, no explanations

Input (Portuguese):
${JSON.stringify(batchObject, null, 2)}

Return the translated JSON object with the same keys but ${targetLangName} values:`;

      const response = await fetch("https://ai.gateway.example/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "user", content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI gateway error for batch ${i / batchSize}:`, response.status, errorText);
        
        if (response.status === 429) {
          return new Response(JSON.stringify({ 
            error: "Rate limit exceeded. Please try again later.",
            partial: results,
            remaining: keysList.length - i
          }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        // Continue with next batch on error
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const translated = JSON.parse(jsonMatch[0]);
          Object.assign(results, translated);
          console.log(`Batch ${Math.floor(i / batchSize) + 1} completed: ${Object.keys(translated).length} translations`);
        } catch (parseError) {
          console.error(`JSON parse error for batch ${i / batchSize}:`, parseError);
        }
      }
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < keysList.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Translation completed: ${Object.keys(results).length} of ${keysList.length} keys translated`);

    return new Response(JSON.stringify({ 
      translations: results,
      totalRequested: keysList.length,
      totalTranslated: Object.keys(results).length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
