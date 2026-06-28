import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/auth_rbac.ts";

/**
 * Escapes a CSV field value (handles quotes, commas, newlines)
 */
function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Converts rows to CSV string
 */
function objectsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.map(escapeCSVField).join(',');
  const dataLines = rows.map(row => 
    headers.map(h => escapeCSVField(String(row[h] ?? ''))).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filename, headers, rows } = await req.json();

    // Validate input
    if (!filename || !headers || !rows) {
      console.error('Missing required fields:', { filename: !!filename, headers: !!headers, rows: !!rows });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: filename, headers, rows' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!Array.isArray(headers) || !Array.isArray(rows)) {
      console.error('Invalid data types:', { headersIsArray: Array.isArray(headers), rowsIsArray: Array.isArray(rows) });
      return new Response(
        JSON.stringify({ error: 'headers and rows must be arrays' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Generating CSV: ${filename} with ${rows.length} rows and ${headers.length} columns`);

    // Generate CSV content with BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';
    const csvContent = bom + objectsToCsv(headers, rows);

    // Create streaming response
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
      },
    });

  } catch (error) {
    console.error('Error in csv-export function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
