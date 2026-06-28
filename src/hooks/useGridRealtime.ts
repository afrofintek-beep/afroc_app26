/**
 * AFROLOC - African Digital Address Identification System
 * Real-time Grid Updates Hook
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface GridRealtimeEvent {
  id: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  timestamp: Date;
  payload: {
    afroloc_code?: string;
    status?: string;
    zone?: string;
    country?: string;
    old_status?: string;
    new_status?: string;
  };
}

interface UseGridRealtimeOptions {
  countryCode?: string;
  onEvent?: (event: GridRealtimeEvent) => void;
  maxEvents?: number;
}

export function useGridRealtime(options: UseGridRealtimeOptions = {}) {
  const { countryCode, onEvent, maxEvents = 50 } = options;
  const [events, setEvents] = useState<GridRealtimeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);

  const addEvent = useCallback((event: GridRealtimeEvent) => {
    setEvents(prev => {
      const newEvents = [event, ...prev].slice(0, maxEvents);
      return newEvents;
    });
    setLastEventTime(new Date());
    onEvent?.(event);
  }, [maxEvents, onEvent]);

  useEffect(() => {
    const channel = supabase
      .channel('grid-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'afroloc_records',
        },
        (payload: RealtimePostgresChangesPayload<{
          id: string;
          afroloc_code: string;
          status: string;
          metadata: Record<string, unknown>;
          country: string;
        }>) => {
          const newRecord = payload.new as Record<string, unknown> | undefined;
          const oldRecord = payload.old as Record<string, unknown> | undefined;
          
          // Filter by country if specified
          if (countryCode && newRecord?.country !== countryCode && oldRecord?.country !== countryCode) {
            return;
          }

          const metadata = (newRecord?.metadata || {}) as Record<string, unknown>;
          
          const event: GridRealtimeEvent = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            table: 'afroloc_records',
            timestamp: new Date(),
            payload: {
              afroloc_code: newRecord?.afroloc_code as string,
              status: newRecord?.status as string,
              zone: metadata.zone as string,
              country: (newRecord?.country || oldRecord?.country) as string,
              old_status: oldRecord?.status as string,
              new_status: newRecord?.status as string,
            },
          };

          addEvent(event);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [countryCode, addEvent]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    events,
    isConnected,
    lastEventTime,
    clearEvents,
  };
}
