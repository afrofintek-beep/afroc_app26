import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Country {
  id: string;
  country_code: string;
  country_name: string;
  is_active: boolean;
  admin_levels_count: number;
  level1_label: string;
  level2_label: string;
  level3_label: string;
  level4_label: string;
  level5_label?: string;
  afro_id_format: string;
  afro_id_prefix?: string;
  requires_authority_validation: boolean;
  requires_witness_validation: boolean;
  min_witnesses_required: number;
  address_format: any;
  phone_country_code?: string;
  phone_number_format?: string;
  timezone: string;
  currency?: string;
  language_codes: string[];
  created_at: string;
  updated_at: string;
}

export function useCountries() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: countries, isLoading } = useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .eq('is_active', true)
        .order('country_name');

      if (error) throw error;
      return data as Country[];
    },
  });

  const createCountry = useMutation({
    mutationFn: async (country: any) => {
      const { data, error } = await supabase
        .from('countries')
        .insert([country])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['countries'] });
      toast({
        title: 'Country Added',
        description: 'Country configuration created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create country',
        variant: 'destructive',
      });
    },
  });

  const updateCountry = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Country> }) => {
      const { data, error } = await supabase
        .from('countries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['countries'] });
      toast({
        title: 'Country Updated',
        description: 'Country configuration updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update country',
        variant: 'destructive',
      });
    },
  });

  const toggleCountryStatus = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('countries')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['countries'] });
      toast({
        title: 'Status Updated',
        description: 'Country status changed successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    },
  });

  return {
    countries,
    isLoading,
    createCountry: createCountry.mutate,
    updateCountry: updateCountry.mutate,
    toggleCountryStatus: toggleCountryStatus.mutate,
    isCreating: createCountry.isPending,
    isUpdating: updateCountry.isPending,
  };
}
