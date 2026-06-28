import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RegistrationBatch {
  id: string;
  batch_number: string;
  created_by_user_id: string;
  submitted_to_user_id: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  jurisdiction_country: string;
  jurisdiction_level1_code: string | null;
  jurisdiction_level1_name: string | null;
  jurisdiction_level2_code: string | null;
  jurisdiction_level2_name: string | null;
  jurisdiction_level3_code: string | null;
  jurisdiction_level3_name: string | null;
  jurisdiction_level4_code: string | null;
  jurisdiction_level4_name: string | null;
  record_count: number;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  approved_by_user_id: string | null;
  updated_at: string;
}

export const useMyBatches = () => {
  return useQuery({
    queryKey: ["my-batches"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("registration_batches")
        .select("*")
        .eq("created_by_user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as RegistrationBatch[];
    },
  });
};

export const usePendingApprovals = () => {
  return useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("registration_batches")
        .select("*, profiles!registration_batches_created_by_user_id_fkey(full_name)")
        .eq("submitted_to_user_id", user.id)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
};

export const useCreateBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchData: Omit<RegistrationBatch, 'id' | 'batch_number' | 'created_by_user_id' | 'created_at' | 'updated_at'> & Partial<Pick<RegistrationBatch, 'status' | 'notes'>>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Generate batch number
      const { data: batchNumber, error: fnError } = await supabase
        .rpc("generate_batch_number");

      if (fnError) throw fnError;

      const { data, error } = await supabase
        .from("registration_batches")
        .insert([{
          batch_number: batchNumber as string,
          created_by_user_id: user.id,
          jurisdiction_country: batchData.jurisdiction_country,
          jurisdiction_level1_code: batchData.jurisdiction_level1_code,
          jurisdiction_level1_name: batchData.jurisdiction_level1_name,
          jurisdiction_level2_code: batchData.jurisdiction_level2_code,
          jurisdiction_level2_name: batchData.jurisdiction_level2_name,
          jurisdiction_level3_code: batchData.jurisdiction_level3_code,
          jurisdiction_level3_name: batchData.jurisdiction_level3_name,
          jurisdiction_level4_code: batchData.jurisdiction_level4_code,
          jurisdiction_level4_name: batchData.jurisdiction_level4_name,
          status: batchData.status || 'draft',
          notes: batchData.notes || null,
          submitted_to_user_id: batchData.submitted_to_user_id || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-batches"] });
      toast.success("Pacote criado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao criar pacote: " + error.message);
    },
  });
};

export const useSubmitBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ batchId, superiorId }: { batchId: string; superiorId: string }) => {
      const { error } = await supabase
        .from("registration_batches")
        .update({
          status: "submitted",
          submitted_to_user_id: superiorId,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", batchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-batches"] });
      toast.success("Pacote submetido para aprovação");
    },
    onError: (error) => {
      toast.error("Erro ao submeter pacote: " + error.message);
    },
  });
};

export const useApproveBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("registration_batches")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by_user_id: user.id,
        })
        .eq("id", batchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      toast.success("Pacote aprovado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao aprovar pacote: " + error.message);
    },
  });
};

export const useRejectBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ batchId, reason }: { batchId: string; reason: string }) => {
      const { error } = await supabase
        .from("registration_batches")
        .update({
          status: "rejected",
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", batchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      toast.success("Pacote rejeitado");
    },
    onError: (error) => {
      toast.error("Erro ao rejeitar pacote: " + error.message);
    },
  });
};
