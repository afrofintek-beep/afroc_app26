import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Types
export interface OfflineWitness {
  witness_afro_id: string;
  witness_name?: string;
  witness_phone?: string;
  signature?: string;
  photo?: string;
  captured_at: string;
  validation_method: 'otp' | 'signature' | 'photo' | 'in_person';
}

export interface OfflineAfroloc {
  id: string;
  idempotency_key: string; // SHA256 hash for deduplication
  code: string;
  zone: 'urban' | 'rural';
  grid_size: 10 | 25;
  country: string;
  level1_code?: string;
  level1_name?: string;
  level2_code?: string;
  level2_name?: string;
  level3_code?: string;
  level3_name?: string;
  level4_code?: string;
  level4_name?: string;
  street_name?: string;
  street_code?: string;
  number?: string;
  unit?: string;
  address_type?: 'formal' | 'informal'; // Tipo indicado pelo utilizador (Digital vem da certificação)
  property_type?: string;
  geo_lat?: number;
  geo_lon?: number;
  witnesses: OfflineWitness[];
  created_at: string;
  synced: boolean;
  sync_attempts: number;
  last_sync_error?: string;
  last_sync_attempt?: string;
  user_id: string;
  operator_id?: string; // Field operator mode
}

export interface SyncOutboxItem {
  id: string;
  type: 'afroloc' | 'witness' | 'document';
  action: 'insert' | 'update' | 'delete';
  payload: any;
  idempotency_key: string;
  conflict_hash: string; // Hash for 409 conflict detection
  created_at: string;
  attempts: number;
  max_attempts: number;
  next_retry_at: string;
  last_error?: string;
  error_type?: 'network' | 'conflict' | 'validation' | 'unknown';
  status: 'pending' | 'processing' | 'failed' | 'completed' | 'conflict';
}

export interface OperatorConfig {
  operator_id: string;
  operator_name: string;
  daily_quota: number;
  records_today: number;
  last_reset_date: string;
  jurisdiction_country: string;
  jurisdiction_level1?: string;
  jurisdiction_level2?: string;
}

interface AfrolocDB extends DBSchema {
  'offline-afrolocs': {
    key: string;
    value: OfflineAfroloc;
    indexes: { 
      'by-synced': 'synced';
      'by-user': 'user_id';
      'by-idempotency': 'idempotency_key';
    };
  };
  'sync-outbox': {
    key: string;
    value: SyncOutboxItem;
    indexes: {
      'by-status': 'status';
      'by-next-retry': 'next_retry_at';
    };
  };
  'operator-config': {
    key: string;
    value: OperatorConfig;
  };
  'urban-zones-cache': {
    key: string;
    value: {
      keywords: string[];
      updated_at: string;
    };
  };
}

let dbInstance: IDBPDatabase<AfrolocDB> | null = null;

const DB_VERSION = 2;

export async function getDB(): Promise<IDBPDatabase<AfrolocDB>> {
  if (!dbInstance) {
    dbInstance = await openDB<AfrolocDB>('afroloc-offline', DB_VERSION, {
      upgrade(db, oldVersion) {
        // Migrate from v1
        if (oldVersion < 1) {
          const afrolocStore = db.createObjectStore('offline-afrolocs', { keyPath: 'id' });
          afrolocStore.createIndex('by-synced', 'synced');
          afrolocStore.createIndex('by-user', 'user_id');
          afrolocStore.createIndex('by-idempotency', 'idempotency_key');
        }
        
        if (oldVersion < 2) {
          // Add outbox store
          if (!db.objectStoreNames.contains('sync-outbox')) {
            const outboxStore = db.createObjectStore('sync-outbox', { keyPath: 'id' });
            outboxStore.createIndex('by-status', 'status');
            outboxStore.createIndex('by-next-retry', 'next_retry_at');
          }
          
          // Add operator config store
          if (!db.objectStoreNames.contains('operator-config')) {
            db.createObjectStore('operator-config', { keyPath: 'operator_id' });
          }
          
          // Add urban zones cache
          if (!db.objectStoreNames.contains('urban-zones-cache')) {
            db.createObjectStore('urban-zones-cache', { keyPath: 'keywords' });
          }
        }
      },
    });
  }
  return dbInstance;
}

// SHA-256 hash utility
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Stable JSON stringify for deterministic hashing
function stableStringify(obj: Record<string, unknown>): string {
  const allKeys: string[] = [];
  JSON.stringify(obj, (k, v) => { allKeys.push(k); return v; });
  allKeys.sort();
  return JSON.stringify(obj, allKeys);
}

// Generate idempotency key (includes volatile fields like timestamp)
export async function generateIdempotencyKey(data: {
  user_id: string;
  geo_lat?: number;
  geo_lon?: number;
  country: string;
  level1_name?: string;
  created_at: string;
}): Promise<string> {
  const payload = stableStringify({
    user_id: data.user_id,
    lat: data.geo_lat?.toFixed(5),
    lon: data.geo_lon?.toFixed(5),
    country: data.country,
    level1: data.level1_name,
    date: data.created_at.split('T')[0]
  });
  return sha256Hex(payload);
}

// Generate conflict hash (ignores volatile fields - for 409 detection)
export async function generateConflictHash(data: {
  geo_lat?: number;
  geo_lon?: number;
  country: string;
  level1_name?: string;
  property_type?: string;
}): Promise<string> {
  const payload = stableStringify({
    lat: data.geo_lat?.toFixed(5),
    lon: data.geo_lon?.toFixed(5),
    country: data.country,
    level1: data.level1_name,
    property_type: data.property_type
  });
  return sha256Hex(payload);
}

// Urban zone keywords for offline detection
const URBAN_KEYWORDS = [
  'LUANDA', 'TALATONA', 'VIANA', 'CAZENGA', 'BELAS', 'KILAMBA',
  'BENGUELA', 'LOBITO', 'HUAMBO', 'CABINDA', 'LUBANGO',
  'MALANJE', 'NAMIBE', 'SOYO', 'UIGE', 'SUMBE',
  'KINSHASA', 'LUBUMBASHI', 'MBUJI-MAYI', 'KANANGA', 'KISANGANI',
  'BRAZZAVILLE', 'POINTE-NOIRE', 'MAPUTO', 'BEIRA', 'NAMPULA'
];

// Resolve zone offline using keywords (fallback when no polygon data)
export function resolveZoneOffline(adminPath: string | undefined): { zone: 'urban' | 'rural'; gridSize: 10 | 25 } {
  if (!adminPath) {
    return { zone: 'rural', gridSize: 25 };
  }
  
  const upperPath = adminPath.toUpperCase();
  for (const keyword of URBAN_KEYWORDS) {
    if (upperPath.includes(keyword)) {
      return { zone: 'urban', gridSize: 10 };
    }
  }
  
  return { zone: 'rural', gridSize: 25 };
}

// Generate AFROLOC code offline (same algorithm as backend)
export function generateAfrolocCodeOffline(
  lat: number,
  lon: number,
  countryCode: string,
  zone: 'urban' | 'rural'
): string {
  const gridSize = zone === 'urban' ? 10 : 25;
  const zoneTag = zone === 'urban' ? 'ZU' : 'ZR';
  const gridTag = zone === 'urban' ? 'G10' : 'G25';
  
  // Web Mercator projection constants
  const EARTH_RADIUS = 6378137;
  const MAX_LAT = 85.0511287798;
  
  // Clamp latitude
  const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  
  // Convert to Web Mercator
  const x = EARTH_RADIUS * (lon * Math.PI / 180);
  const y = EARTH_RADIUS * Math.log(Math.tan((Math.PI / 4) + (clampedLat * Math.PI / 360)));
  
  // Calculate grid cell indices
  const ix = Math.floor(x / gridSize);
  const iy = Math.floor(y / gridSize);
  
  // Convert to base36
  const encodeCoord = (n: number): string => {
    const prefix = n < 0 ? 'N' : '';
    const absVal = Math.abs(n).toString(36).toUpperCase();
    return prefix + absVal;
  };
  
  return `${countryCode}-${zoneTag}-${gridTag}-X${encodeCoord(ix)}-Y${encodeCoord(iy)}`;
}

// Save offline AFROLOC with idempotency
export async function saveOfflineAfroloc(
  afroloc: Omit<OfflineAfroloc, 'id' | 'idempotency_key' | 'created_at' | 'synced' | 'sync_attempts' | 'zone' | 'grid_size'>
): Promise<{ id: string; code: string }> {
  const db = await getDB();
  const created_at = new Date().toISOString();
  
  // Generate idempotency key
  const idempotency_key = await generateIdempotencyKey({
    user_id: afroloc.user_id,
    geo_lat: afroloc.geo_lat,
    geo_lon: afroloc.geo_lon,
    country: afroloc.country,
    level1_name: afroloc.level1_name,
    created_at
  });
  
  // Generate conflict hash (ignores volatile fields)
  const conflict_hash = await generateConflictHash({
    geo_lat: afroloc.geo_lat,
    geo_lon: afroloc.geo_lon,
    country: afroloc.country,
    level1_name: afroloc.level1_name,
    property_type: afroloc.property_type
  });
  
  // Check for duplicate
  const allRecords = await db.getAll('offline-afrolocs');
  const existing = allRecords.find(r => r.idempotency_key === idempotency_key);
  if (existing) {
    console.log('Duplicate detected, returning existing record:', existing.id);
    return { id: existing.id, code: existing.code };
  }
  
  // Resolve zone
  const adminPath = [afroloc.level1_name, afroloc.level2_name, afroloc.level3_name].filter(Boolean).join('/');
  const { zone, gridSize } = resolveZoneOffline(adminPath);
  
  // Generate AFROLOC code
  let code: string;
  if (afroloc.geo_lat && afroloc.geo_lon) {
    code = generateAfrolocCodeOffline(afroloc.geo_lat, afroloc.geo_lon, afroloc.country, zone);
  } else {
    // Fallback for no GPS
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    code = `${afroloc.country}-${zone === 'urban' ? 'ZU' : 'ZR'}-NOGPS-${timestamp}-${random}`;
  }
  
  const id = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const record: OfflineAfroloc = {
    ...afroloc,
    id,
    idempotency_key,
    code,
    zone,
    grid_size: gridSize,
    created_at,
    synced: false,
    sync_attempts: 0,
  };
  
  await db.add('offline-afrolocs', record);
  
  // Add to outbox with conflict_hash
  await addToOutbox({
    type: 'afroloc',
    action: 'insert',
    payload: record,
    idempotency_key,
    conflict_hash
  });
  
  console.log('Saved offline AFROLOC:', id, code);
  return { id, code };
}

// Outbox management
export async function addToOutbox(item: Omit<SyncOutboxItem, 'id' | 'created_at' | 'attempts' | 'max_attempts' | 'next_retry_at' | 'status' | 'error_type'>): Promise<string> {
  const db = await getDB();
  const id = `outbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const outboxItem: SyncOutboxItem = {
    ...item,
    id,
    created_at: new Date().toISOString(),
    attempts: 0,
    max_attempts: 5,
    next_retry_at: new Date().toISOString(),
    status: 'pending'
  };
  
  await db.add('sync-outbox', outboxItem);
  console.log('Added to outbox:', id);
  return id;
}

export async function getPendingOutboxItems(): Promise<SyncOutboxItem[]> {
  const db = await getDB();
  const now = new Date().toISOString();
  const all = await db.getAll('sync-outbox');
  return all.filter(item => item.status === 'pending' && item.next_retry_at <= now);
}

export async function updateOutboxItem(id: string, updates: Partial<SyncOutboxItem>): Promise<void> {
  const db = await getDB();
  const item = await db.get('sync-outbox', id);
  if (item) {
    await db.put('sync-outbox', { ...item, ...updates });
  }
}

export async function calculateNextRetry(attempts: number): Promise<string> {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s...
  const delayMs = Math.min(Math.pow(2, attempts) * 1000, 60000); // Max 1 minute
  return new Date(Date.now() + delayMs).toISOString();
}

// Operator mode
export async function getOperatorConfig(operatorId: string): Promise<OperatorConfig | undefined> {
  const db = await getDB();
  return db.get('operator-config', operatorId);
}

export async function saveOperatorConfig(config: OperatorConfig): Promise<void> {
  const db = await getDB();
  
  // Reset daily quota if new day
  const today = new Date().toISOString().split('T')[0];
  if (config.last_reset_date !== today) {
    config.records_today = 0;
    config.last_reset_date = today;
  }
  
  await db.put('operator-config', config);
}

export async function incrementOperatorCount(operatorId: string): Promise<{ allowed: boolean; remaining: number }> {
  const config = await getOperatorConfig(operatorId);
  if (!config) {
    return { allowed: false, remaining: 0 };
  }
  
  // Check daily reset
  const today = new Date().toISOString().split('T')[0];
  if (config.last_reset_date !== today) {
    config.records_today = 0;
    config.last_reset_date = today;
  }
  
  if (config.records_today >= config.daily_quota) {
    return { allowed: false, remaining: 0 };
  }
  
  config.records_today += 1;
  await saveOperatorConfig(config);
  
  return { 
    allowed: true, 
    remaining: config.daily_quota - config.records_today 
  };
}

// Existing functions (maintained for compatibility)
export async function getUnsyncedAfrolocs(): Promise<OfflineAfroloc[]> {
  const db = await getDB();
  const all = await db.getAll('offline-afrolocs');
  return all.filter(record => !record.synced);
}

export async function getAllOfflineAfrolocs(userId: string): Promise<OfflineAfroloc[]> {
  const db = await getDB();
  const all = await db.getAll('offline-afrolocs');
  return all.filter(record => record.user_id === userId);
}

export async function markAsSynced(id: string): Promise<void> {
  const db = await getDB();
  const record = await db.get('offline-afrolocs', id);
  if (record) {
    record.synced = true;
    await db.put('offline-afrolocs', record);
    console.log('Marked as synced:', id);
  }
}

export async function updateSyncAttempt(id: string, error?: string): Promise<void> {
  const db = await getDB();
  const record = await db.get('offline-afrolocs', id);
  if (record) {
    record.sync_attempts += 1;
    record.last_sync_attempt = new Date().toISOString();
    record.last_sync_error = error;
    await db.put('offline-afrolocs', record);
  }
}

export async function deleteOfflineAfroloc(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('offline-afrolocs', id);
  console.log('Deleted offline AFROLOC:', id);
}

export async function getOfflineCount(): Promise<number> {
  const db = await getDB();
  const all = await db.getAll('offline-afrolocs');
  return all.filter(record => !record.synced).length;
}

export async function getOutboxCount(): Promise<number> {
  const db = await getDB();
  const all = await db.getAll('sync-outbox');
  return all.filter(item => item.status === 'pending').length;
}

// Conflict resolution
export type ConflictResolution = 'server_wins' | 'client_wins' | 'discard';

export async function getConflictItems(): Promise<SyncOutboxItem[]> {
  const db = await getDB();
  const all = await db.getAll('sync-outbox');
  return all.filter(item => item.status === 'conflict');
}

export async function resolveConflict(
  itemId: string,
  resolution: ConflictResolution
): Promise<void> {
  const db = await getDB();
  const item = await db.get('sync-outbox', itemId);
  if (!item) return;

  switch (resolution) {
    case 'server_wins':
      // Accept server version — mark outbox completed and local record synced
      await db.put('sync-outbox', { ...item, status: 'completed', last_error: 'Resolved: server wins' });
      if (item.payload?.id) {
        await markAsSynced(item.payload.id);
      }
      break;

    case 'client_wins':
      // Re-queue with a new conflict_hash so server treats it as a fresh submission
      const newHash = await generateConflictHash({
        geo_lat: item.payload?.geo_lat,
        geo_lon: item.payload?.geo_lon,
        country: item.payload?.country,
        level1_name: item.payload?.level1_name,
        property_type: item.payload?.property_type,
      });
      await db.put('sync-outbox', {
        ...item,
        status: 'pending',
        attempts: 0,
        next_retry_at: new Date().toISOString(),
        conflict_hash: newHash + '-force',
        last_error: undefined,
        error_type: undefined,
      });
      break;

    case 'discard':
      // Delete both outbox entry and local record
      await db.delete('sync-outbox', itemId);
      if (item.payload?.id) {
        await deleteOfflineAfroloc(item.payload.id);
      }
      break;
  }
}

export async function resolveAllConflicts(resolution: ConflictResolution): Promise<number> {
  const conflicts = await getConflictItems();
  for (const item of conflicts) {
    await resolveConflict(item.id, resolution);
  }
  return conflicts.length;
}
