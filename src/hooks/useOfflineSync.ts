import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNetworkStatus } from './useNetworkStatus';
import {
  getUnsyncedAfrolocs,
  markAsSynced,
  updateSyncAttempt,
  getPendingOutboxItems,
  updateOutboxItem,
  calculateNextRetry,
  getOfflineCount,
  getOutboxCount,
  OfflineAfroloc,
  SyncOutboxItem
} from '@/utils/offlineStorage';

interface SyncResult {
  success: number;
  failed: number;
  pending: number;
  errors: string[];
}

export const useOfflineSync = (userId: string | undefined) => {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [outboxCount, setOutboxCount] = useState(0);
  const { isOnline } = useNetworkStatus();
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update counts
  const updateCounts = useCallback(async () => {
    const pending = await getOfflineCount();
    const outbox = await getOutboxCount();
    setPendingCount(pending);
    setOutboxCount(outbox);
  }, []);

  // Initialize and set up periodic sync
  useEffect(() => {
    updateCounts();
    
    // Auto-sync every 30 seconds when online
    if (isOnline && userId) {
      syncIntervalRef.current = setInterval(() => {
        syncData();
      }, 30000);
    }
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isOnline, userId]);

  // Sync when coming online
  useEffect(() => {
    if (isOnline && userId) {
      syncData();
    }
  }, [isOnline, userId]);

  // Sync a single AFROLOC record
  const syncAfrolocRecord = async (record: OfflineAfroloc): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log(`[sync] Processing AFROLOC: ${record.code}`);
      
      // Call address-gateway or address-create endpoint
      const { data, error } = await supabase.functions.invoke('address-gateway', {
        body: {
          action: 'create',
          code: record.code,
          country: record.country,
          level1_name: record.level1_name,
          level2_name: record.level2_name,
          level3_name: record.level3_name,
          level4_name: record.level4_name,
          street_name: record.street_name,
          number: record.number,
          unit: record.unit,
          address_type: record.address_type,
          property_type: record.property_type,
          geo_lat: record.geo_lat,
          geo_lon: record.geo_lon,
          user_id: record.user_id,
          idempotency_key: record.idempotency_key,
          witnesses: record.witnesses
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Check for idempotency (already exists)
      if (data?.already_exists) {
        console.log(`[sync] Record already exists (idempotent): ${record.code}`);
      }

      await markAsSynced(record.id);
      return { success: true };
      
    } catch (error: any) {
      console.error(`[sync] Failed to sync ${record.code}:`, error);
      await updateSyncAttempt(record.id, error.message);
      return { success: false, error: error.message };
    }
  };

  // Process outbox with batch sync to sync-places endpoint
  const processOutbox = async (): Promise<{ processed: number; failed: number }> => {
    const items = await getPendingOutboxItems();
    let processed = 0;
    let failed = 0;

    if (items.length === 0) return { processed, failed };

    // Batch all afroloc items into a single sync request
    const afrolocItems = items.filter(item => item.type === 'afroloc' && item.action === 'insert');
    
    if (afrolocItems.length === 0) return { processed, failed };

    const syncItems = afrolocItems.map(item => ({
      idempotency_key: item.idempotency_key,
      conflict_hash: item.conflict_hash,
      local_afroloc: item.payload.code,
      lat: item.payload.geo_lat,
      lon: item.payload.geo_lon,
      admin_path: [
        item.payload.level1_name,
        item.payload.level2_name,
        item.payload.level3_name,
        item.payload.level4_name
      ].filter(Boolean).join('/'),
      kind: item.payload.property_type,
      captured_at: item.payload.created_at,
      property_type: item.payload.property_type,
      address_type: item.payload.address_type,
      street_name: item.payload.street_name,
      number: item.payload.number,
      unit: item.payload.unit,
      level1_name: item.payload.level1_name,
      level2_name: item.payload.level2_name,
      level3_name: item.payload.level3_name,
      level4_name: item.payload.level4_name,
      witnesses: item.payload.witnesses,
    }));

    try {
      // Call the sync-places endpoint with batch
      const { data, error } = await supabase.functions.invoke('sync-places', {
        body: {
          device_id: `WEB-${navigator.userAgent.slice(0, 20)}`,
          items: syncItems
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Process results from server
      for (const result of data?.results || []) {
        const item = afrolocItems.find(i => i.idempotency_key === result.idempotency_key);
        if (!item) continue;

        if (result.status === 'ok' || result.status === 'idempotent') {
          await updateOutboxItem(item.id, { 
            status: 'completed',
            last_error: undefined
          });
          processed++;
          
          // Log if server corrected the AFROLOC code
          if (result.afroloc_official && result.afroloc_official !== item.payload.code) {
            console.log(`[sync] Official code: ${result.afroloc_official} (local: ${item.payload.code})`);
          }
        } else if (result.status === 'conflict') {
          await updateOutboxItem(item.id, {
            status: 'conflict',
            attempts: item.attempts + 1,
            last_error: result.error || 'Conflito: registo já existe',
            error_type: 'conflict'
          });
          failed++;
        } else {
          const newAttempts = item.attempts + 1;
          if (newAttempts >= item.max_attempts) {
            await updateOutboxItem(item.id, {
              status: 'failed',
              attempts: newAttempts,
              last_error: result.error,
              error_type: 'unknown'
            });
            failed++;
          } else {
            const nextRetry = await calculateNextRetry(newAttempts);
            await updateOutboxItem(item.id, {
              status: 'pending',
              attempts: newAttempts,
              next_retry_at: nextRetry,
              last_error: result.error,
              error_type: 'network'
            });
          }
        }
      }

    } catch (error: any) {
      console.error(`[outbox] Batch sync failed:`, error);
      
      // Mark all items for retry with backoff
      for (const item of afrolocItems) {
        const newAttempts = item.attempts + 1;
        const isConflict = error.message?.includes('409');
        
        if (isConflict) {
          await updateOutboxItem(item.id, {
            status: 'conflict',
            attempts: newAttempts,
            last_error: 'Conflito detectado',
            error_type: 'conflict'
          });
          failed++;
        } else if (newAttempts >= item.max_attempts) {
          await updateOutboxItem(item.id, {
            status: 'failed',
            attempts: newAttempts,
            last_error: error.message,
            error_type: 'unknown'
          });
          failed++;
        } else {
          const nextRetry = await calculateNextRetry(newAttempts);
          await updateOutboxItem(item.id, {
            status: 'pending',
            attempts: newAttempts,
            next_retry_at: nextRetry,
            last_error: error.message,
            error_type: 'network'
          });
        }
      }
    }

    return { processed, failed };
  };

  // Main sync function
  const syncData = useCallback(async (): Promise<SyncResult> => {
    if (!userId || syncing || !isOnline) {
      return { success: 0, failed: 0, pending: pendingCount, errors: [] };
    }

    setSyncing(true);
    const errors: string[] = [];
    let successCount = 0;
    let failedCount = 0;

    try {
      // 1. Sync unsynced AFROLOC records
      const unsyncedRecords = await getUnsyncedAfrolocs();
      console.log(`[sync] Found ${unsyncedRecords.length} unsynced records`);

      for (const record of unsyncedRecords) {
        // Skip records that have exceeded max attempts
        if (record.sync_attempts >= 5) {
          console.log(`[sync] Skipping ${record.code} - max attempts reached`);
          continue;
        }

        const result = await syncAfrolocRecord(record);
        if (result.success) {
          successCount++;
        } else {
          failedCount++;
          if (result.error) {
            errors.push(`${record.code}: ${result.error}`);
          }
        }
      }

      // 2. Process outbox queue
      const outboxResult = await processOutbox();
      successCount += outboxResult.processed;
      failedCount += outboxResult.failed;

      // 3. Update sync metadata
      await supabase
        .from('offline_cache_metadata')
        .upsert({
          user_id: userId,
          cache_key: 'last_sync',
          data_type: 'afroloc',
          last_synced_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,cache_key'
        });

      setLastSyncTime(new Date());
      
    } catch (error: any) {
      console.error('[sync] Error during sync:', error);
      errors.push(`Sync error: ${error.message}`);
    } finally {
      setSyncing(false);
      await updateCounts();
    }

    const result: SyncResult = {
      success: successCount,
      failed: failedCount,
      pending: await getOfflineCount(),
      errors
    };

    setSyncResult(result);
    return result;
  }, [userId, syncing, isOnline, pendingCount]);

  // Force sync (manual trigger)
  const forceSync = useCallback(async () => {
    if (!isOnline) {
      console.log('[sync] Cannot sync - offline');
      return null;
    }
    return syncData();
  }, [isOnline, syncData]);

  // Retry failed items
  const retryFailed = useCallback(async () => {
    const unsyncedRecords = await getUnsyncedAfrolocs();
    
    // Reset attempt counters for records that exceeded max
    for (const record of unsyncedRecords) {
      if (record.sync_attempts >= 5) {
        await updateSyncAttempt(record.id, undefined);
      }
    }
    
    return syncData();
  }, [syncData]);

  return {
    syncing,
    lastSyncTime,
    syncResult,
    pendingCount,
    outboxCount,
    syncData,
    forceSync,
    retryFailed,
    updateCounts,
    isOnline,
    isOfflineReady: true
  };
};
