import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sha256, verifyHash } from '../_shared/hash_utils.ts';
import { corsHeaders } from "../_shared/auth_rbac.ts";

interface DocumentRecord {
  id: string;
  title: string;
  category: string;
  language: string;
  version: string;
  visibility: string;
  file_path: string;
  sha256: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'list';

  console.log(`[v1-docs] Action: ${action}, Method: ${req.method}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // For admin operations, verify JWT
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let isAdmin = false;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && user) {
        userId = user.id;
        
        // Check admin role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .single();
        
        isAdmin = !!roleData;
      }
    }

    switch (action) {
      case 'list': {
        // List documents - public access for public docs
        const category = url.searchParams.get('category');
        const language = url.searchParams.get('language');
        const visibility = url.searchParams.get('visibility') || 'public';

        console.log(`[v1-docs] Listing documents: category=${category}, language=${language}, visibility=${visibility}`);

        let query = supabase
          .from('documents')
          .select('id, title, category, language, version, visibility, file_path, sha256, published_at, created_at, updated_at')
          .order('published_at', { ascending: false });

        // Filter by visibility based on auth status
        if (!userId) {
          query = query.eq('visibility', 'public');
        } else if (!isAdmin) {
          query = query.in('visibility', ['public', 'restricted']);
        }
        // Admins can see all visibility levels

        if (category) {
          query = query.eq('category', category);
        }
        if (language) {
          query = query.eq('language', language);
        }

        const { data: documents, error } = await query;

        if (error) {
          console.error('[v1-docs] List error:', error);
          throw error;
        }

        console.log(`[v1-docs] Found ${documents?.length || 0} documents`);

        return new Response(JSON.stringify({
          success: true,
          data: documents,
          count: documents?.length || 0,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get': {
        // Get single document by ID
        const docId = url.searchParams.get('id');
        
        if (!docId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Document ID required',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`[v1-docs] Getting document: ${docId}`);

        const { data: document, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', docId)
          .single();

        if (error) {
          console.error('[v1-docs] Get error:', error);
          throw error;
        }

        // Check visibility permissions
        if (!document) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Document not found',
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (document.visibility === 'restricted' && !userId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authentication required',
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (document.visibility === 'private' && !isAdmin) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Admin access required',
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          data: document,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'verify': {
        // Verify document integrity
        const docId = url.searchParams.get('id');
        
        if (!docId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Document ID required',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`[v1-docs] Verifying document: ${docId}`);

        // Get document metadata
        const { data: document, error: docError } = await supabase
          .from('documents')
          .select('*')
          .eq('id', docId)
          .single();

        if (docError || !document) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Document not found',
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Download file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('document-library')
          .download(document.file_path);

        if (downloadError || !fileData) {
          console.error('[v1-docs] Download error:', downloadError);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to download document for verification',
            stored_sha256: document.sha256,
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Calculate current hash
        const fileBuffer = await fileData.arrayBuffer();
        const currentHash = await sha256(fileBuffer);
        const isValid = await verifyHash(fileBuffer, document.sha256);

        console.log(`[v1-docs] Verification result: valid=${isValid}, stored=${document.sha256}, current=${currentHash}`);

        return new Response(JSON.stringify({
          success: true,
          data: {
            document_id: document.id,
            title: document.title,
            stored_sha256: document.sha256,
            current_sha256: currentHash,
            integrity_valid: isValid,
            verified_at: new Date().toISOString(),
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'upload': {
        // Upload document - admin only
        if (!isAdmin) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Admin access required',
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (req.method !== 'POST') {
          return new Response(JSON.stringify({
            success: false,
            error: 'POST method required for upload',
          }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const title = formData.get('title') as string;
        const category = formData.get('category') as string;
        const language = formData.get('language') as string;
        const version = formData.get('version') as string;
        const visibility = formData.get('visibility') as string || 'public';

        if (!file || !title || !category || !language || !version) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing required fields: file, title, category, language, version',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`[v1-docs] Uploading document: ${title} (${file.name})`);

        // Read file and calculate hash
        const fileBuffer = await file.arrayBuffer();
        const fileHash = await sha256(fileBuffer);

        // Generate file path
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${category}/${timestamp}-${safeName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('document-library')
          .upload(filePath, fileBuffer, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          console.error('[v1-docs] Upload error:', uploadError);
          throw uploadError;
        }

        // Create document record
        const { data: document, error: insertError } = await supabase
          .from('documents')
          .insert({
            title,
            category,
            language,
            version,
            visibility,
            file_path: filePath,
            sha256: fileHash,
            published_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('[v1-docs] Insert error:', insertError);
          // Cleanup uploaded file
          await supabase.storage.from('document-library').remove([filePath]);
          throw insertError;
        }

        console.log(`[v1-docs] Document created: ${document.id}`);

        return new Response(JSON.stringify({
          success: true,
          data: document,
          sha256: fileHash,
        }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete': {
        // Delete document - admin only
        if (!isAdmin) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Admin access required',
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const docId = url.searchParams.get('id');
        
        if (!docId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Document ID required',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`[v1-docs] Deleting document: ${docId}`);

        // Get document to find file path
        const { data: document, error: getError } = await supabase
          .from('documents')
          .select('file_path')
          .eq('id', docId)
          .single();

        if (getError || !document) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Document not found',
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('document-library')
          .remove([document.file_path]);

        if (storageError) {
          console.warn('[v1-docs] Storage delete warning:', storageError);
        }

        // Delete document record
        const { error: deleteError } = await supabase
          .from('documents')
          .delete()
          .eq('id', docId);

        if (deleteError) {
          console.error('[v1-docs] Delete error:', deleteError);
          throw deleteError;
        }

        console.log(`[v1-docs] Document deleted: ${docId}`);

        return new Response(JSON.stringify({
          success: true,
          message: 'Document deleted successfully',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'download': {
        // Download document file
        const docId = url.searchParams.get('id');
        
        if (!docId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Document ID required',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`[v1-docs] Downloading document: ${docId}`);

        // Get document metadata
        const { data: document, error: docError } = await supabase
          .from('documents')
          .select('*')
          .eq('id', docId)
          .single();

        if (docError || !document) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Document not found',
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Check visibility permissions
        if (document.visibility === 'restricted' && !userId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authentication required',
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (document.visibility === 'private' && !isAdmin) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Admin access required',
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Download file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('document-library')
          .download(document.file_path);

        if (downloadError || !fileData) {
          console.error('[v1-docs] Download error:', downloadError);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to download document',
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Determine content type
        const extension = document.file_path.split('.').pop()?.toLowerCase();
        const contentTypes: Record<string, string> = {
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'txt': 'text/plain',
          'csv': 'text/csv',
        };
        const contentType = contentTypes[extension || ''] || 'application/octet-stream';

        // Generate filename
        const safeTitle = document.title.replace(/[^a-zA-Z0-9-_]/g, '_');
        const filename = `${safeTitle}_${document.version}.${extension || 'pdf'}`;

        console.log(`[v1-docs] Serving file: ${filename}`);

        return new Response(fileData, {
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        });
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: `Unknown action: ${action}. Valid actions: list, get, download, verify, upload, delete`,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('[v1-docs] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
