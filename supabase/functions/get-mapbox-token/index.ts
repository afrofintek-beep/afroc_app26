import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        },
      );
    }

    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    
    if (!mapboxToken) {
      throw new Error('MAPBOX_PUBLIC_TOKEN not configured');
    }

    let body;
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error('Failed to parse request body:', e);
      body = {};
    }
    
    const { latitude, longitude, search, country } = body;
    
    console.log('Request body:', body);

    // Reverse geocoding (coordinates to location)
    if (latitude !== undefined && longitude !== undefined) {
      console.log(`Reverse geocoding: ${longitude},${latitude}`);
      
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}&types=place,locality`;
      console.log('Mapbox URL:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('Mapbox response:', JSON.stringify(data));
      
      if (data.features && data.features.length > 0) {
        const location = data.features[0];
        const countryContext = location.context?.find((c: any) => c.id.startsWith('country'));
        
        const result = {
          location: {
            place_name: location.place_name,
            text: location.text,
            country: countryContext?.text || null
          }
        };
        
        console.log('Returning location:', JSON.stringify(result));
        
        return new Response(
          JSON.stringify(result),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        );
      } else {
        console.log('No features found in response');
        return new Response(
          JSON.stringify({ error: 'No location found for coordinates' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          },
        );
      }
    }

    // Forward geocoding (search for cities)
    if (search) {
      console.log(`Searching for: ${search} in country: ${country}`);
      
      let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(search)}.json?access_token=${mapboxToken}&types=place,locality&limit=5`;
      
      // Add country filter if provided
      if (country) {
        const countryMap: { [key: string]: string } = {
          'AO': 'ao', // Angola
          'MZ': 'mz', // Mozambique
          'ZA': 'za', // South Africa
          'KE': 'ke', // Kenya
          'NG': 'ng', // Nigeria
          'GH': 'gh', // Ghana
          'ET': 'et', // Ethiopia
          'TZ': 'tz', // Tanzania
          'UG': 'ug', // Uganda
          'ZW': 'zw', // Zimbabwe
          'CD': 'cd', // DR Congo
          'CM': 'cm', // Cameroon
          'MA': 'ma', // Morocco
        };
        
        if (countryMap[country]) {
          url += `&country=${countryMap[country]}`;
        }
      }
      
      console.log('Search URL:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('Search results:', JSON.stringify(data));
      
      if (data.features) {
        const suggestions = data.features.map((feature: any) => ({
          place_name: feature.place_name,
          text: feature.text,
        }));
        
        console.log('Returning suggestions:', JSON.stringify(suggestions));
        
        return new Response(
          JSON.stringify({ suggestions }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        );
      }
    }

    console.log('No specific action, returning token');
    
    return new Response(
      JSON.stringify({ token: mapboxToken }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Edge function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
