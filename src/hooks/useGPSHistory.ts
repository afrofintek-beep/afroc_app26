import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { calculateDistance } from '@/utils/gpsDistance';

export interface GPSHistoryEntry {
  id: string;
  afroloc_record_id: string;
  user_id: string;
  previous_lat: number | null;
  previous_lon: number | null;
  new_lat: number;
  new_lon: number;
  distance_meters: number | null;
  accuracy_meters: number | null;
  update_reason: string | null;
  photo_path: string | null;
  device_info: Record<string, unknown>;
  created_at: string;
}

export function useGPSHistory() {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<GPSHistoryEntry[]>([]);
  const { toast } = useToast();

  const fetchHistory = useCallback(async (afrolocRecordId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('afroloc_gps_history')
        .select('*')
        .eq('afroloc_record_id', afrolocRecordId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory((data as GPSHistoryEntry[]) || []);
      return data as GPSHistoryEntry[];
    } catch (error: any) {
      console.error('Error fetching GPS history:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar histórico GPS',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const recordGPSUpdate = useCallback(async (params: {
    afrolocRecordId: string;
    userId: string;
    previousLat: number | null;
    previousLon: number | null;
    newLat: number;
    newLon: number;
    accuracy?: number;
    updateReason?: string;
    photoPath?: string;
    deviceInfo?: Record<string, unknown>;
  }) => {
    try {
      const {
        afrolocRecordId,
        userId,
        previousLat,
        previousLon,
        newLat,
        newLon,
        accuracy,
        updateReason,
        photoPath,
        deviceInfo,
      } = params;

      // Calculate distance if we have previous coordinates
      let distanceMeters: number | null = null;
      if (previousLat !== null && previousLon !== null) {
        distanceMeters = calculateDistance(previousLat, previousLon, newLat, newLon);
      }

      const insertData = {
        afroloc_record_id: afrolocRecordId,
        user_id: userId,
        previous_lat: previousLat,
        previous_lon: previousLon,
        new_lat: newLat,
        new_lon: newLon,
        distance_meters: distanceMeters,
        accuracy_meters: accuracy || null,
        update_reason: updateReason || null,
        photo_path: photoPath || null,
        device_info: deviceInfo || {},
      };

      const { data, error } = await supabase
        .from('afroloc_gps_history')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return data as GPSHistoryEntry;
    } catch (error: any) {
      console.error('Error recording GPS update:', error);
      throw error;
    }
  }, []);

  return {
    history,
    loading,
    fetchHistory,
    recordGPSUpdate,
  };
}
