import { supabase } from "@/integrations/supabase/client";

export interface Document {
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

export interface DocumentListParams {
  category?: string | null;
  language?: string | null;
  visibility?: string | null;
}

export interface DocumentVerification {
  document_id: string;
  title: string;
  stored_sha256: string;
  current_sha256: string;
  integrity_valid: boolean;
  verified_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  count?: number;
  error?: string;
  message?: string;
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/v1-docs`;

async function callDocsApi<T>(
  action: string,
  params: Record<string, string | null | undefined> = {},
  options: {
    method?: string;
    body?: FormData | null;
    auth?: boolean;
  } = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body = null, auth = false } = options;

  // Build query string
  const qs = new URLSearchParams();
  qs.set('action', action);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) qs.set(key, value);
  });

  const headers: Record<string, string> = {
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };

  // Add auth header if needed
  if (auth) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  }

  // Don't set Content-Type for FormData
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${FUNCTION_URL}?${qs.toString()}`, {
    method,
    headers,
    body: body || undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    return { success: false, error: errorData.error || `HTTP ${response.status}` };
  }

  return await response.json();
}

export const documentsApi = {
  /**
   * List documents with optional filters
   */
  listDocs: async (params: DocumentListParams = {}): Promise<ApiResponse<Document[]>> => {
    return callDocsApi<Document[]>('list', {
      category: params.category,
      language: params.language,
      visibility: params.visibility,
    });
  },

  /**
   * Get single document by ID
   */
  getDoc: async (docId: string): Promise<ApiResponse<Document>> => {
    return callDocsApi<Document>('get', { id: docId });
  },

  /**
   * Download document file
   */
  downloadDoc: async (docId: string): Promise<Blob | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers: Record<string, string> = {
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(
      `${FUNCTION_URL}?action=download&id=${docId}`,
      { headers }
    );

    if (!response.ok) {
      console.error('Download failed:', response.status);
      return null;
    }

    return await response.blob();
  },

  /**
   * Verify document integrity (SHA-256 check)
   */
  verifyDoc: async (docId: string): Promise<ApiResponse<DocumentVerification>> => {
    return callDocsApi<DocumentVerification>('verify', { id: docId }, { auth: true });
  },

  /**
   * Upload new document (admin only)
   */
  uploadDoc: async (
    file: File,
    metadata: {
      title: string;
      category: string;
      language: string;
      version: string;
      visibility?: string;
    }
  ): Promise<ApiResponse<Document>> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', metadata.title);
    formData.append('category', metadata.category);
    formData.append('language', metadata.language);
    formData.append('version', metadata.version);
    if (metadata.visibility) {
      formData.append('visibility', metadata.visibility);
    }

    return callDocsApi<Document>('upload', {}, {
      method: 'POST',
      body: formData,
      auth: true,
    });
  },

  /**
   * Delete document (admin only)
   */
  deleteDoc: async (docId: string): Promise<ApiResponse<null>> => {
    return callDocsApi<null>('delete', { id: docId }, { auth: true });
  },
};

/**
 * Hook for using documents API with React Query pattern
 */
export function useDocumentsApi() {
  return documentsApi;
}
