/**
 * AFROLOC — Proof of Daily Presence (PoDP) sampler.
 *
 * Silent background GPS sampler. NOT exposed to the holder via UI/toasts/notifications.
 * Stores samples in IndexedDB; sync layer uploads them via the podp-sample edge function.
 *
 * Activation rules:
 *  - User must be authenticated.
 *  - User must have at least one afroloc_records row (geo_lat/geo_lon).
 *  - Runs in Capacitor native or installed PWA. Skips preview / iframe / dev.
 */
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

const DB_NAME = 'afroloc-podp';
const STORE = 'outbox';
const DB_VERSION = 1;
const DEFAULT_INTERVAL_MIN = 15;

interface OutboxRecord {
  clientGeneratedId: string;
  afrolocRecordId: string;
  lat: number;
  lon: number;
  accuracy?: number;
  capturedAt: string;
  deviceFingerprint?: string;
}

function isSilentContextAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return true;
  try {
    if (window.self !== window.top) return false; // iframe
  } catch { return false; }
  const host = window.location.hostname;
  if (host.startsWith('id-preview--') || host.startsWith('preview--')) return false;
  if (host.endsWith('.preview.example') || host.endsWith('.preview-dev.example')) return false;
  if (host.endsWith('.beta.example')) return false;
  // Web: only run when installed as PWA (standalone) to keep silent and battery-friendly.
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // @ts-expect-error iOS
    window.navigator.standalone === true;
  return standalone;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'clientGeneratedId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueSample(rec: OutboxRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function drainOutbox(max = 50): Promise<OutboxRecord[]> {
  const db = await openDb();
  const items = await new Promise<OutboxRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as OutboxRecord[]).slice(0, max));
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items;
}

export async function removeFromOutbox(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

let sampleTimer: number | null = null;
let syncTimer: number | null = null;
let activeRecords: Array<{ id: string; geo_lat: number; geo_lon: number; metadata?: any }> = [];

async function takeSample(): Promise<void> {
  if (activeRecords.length === 0) return;
  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60000,
    });
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const accuracy = pos.coords.accuracy;
    const capturedAt = new Date().toISOString();
    // Enqueue one sample per active record (sync layer dedupes on the server)
    for (const rec of activeRecords) {
      const clientGeneratedId = `${rec.id}-${capturedAt}`;
      await enqueueSample({
        clientGeneratedId,
        afrolocRecordId: rec.id,
        lat, lon, accuracy,
        capturedAt,
      });
    }
    // Try a sync right after capture
    void syncOnce();
  } catch (e) {
    console.debug('[podp] sample skipped', e);
  }
}

async function syncOnce(): Promise<void> {
  try {
    if (!navigator.onLine) return;
    const batch = await drainOutbox(50);
    if (batch.length === 0) return;
    const { data, error } = await supabase.functions.invoke('podp-sample', {
      body: { samples: batch },
    });
    if (error) { console.debug('[podp] sync error', error); return; }
    // Remove successfully sent regardless of accepted/rejected (server keeps audit)
    await removeFromOutbox(batch.map((b) => b.clientGeneratedId));
    console.debug('[podp] sync ok', data);
  } catch (e) {
    console.debug('[podp] sync failed', e);
  }
}

async function loadActiveRecords(userId: string): Promise<void> {
  const { data } = await supabase
    .from('afroloc_records')
    .select('id, geo_lat, geo_lon, metadata')
    .eq('user_id', userId)
    .limit(10);
  activeRecords = (data ?? []).filter(
    (r: any) => typeof r.geo_lat === 'number' && typeof r.geo_lon === 'number',
  );
}

let started = false;

export async function startPodpSampler(userId: string): Promise<void> {
  if (started) return;
  if (!isSilentContextAllowed()) return;
  started = true;
  try {
    // Best-effort permission (silent: no UI). On web/PWA the browser prompt may surface once.
    await Geolocation.checkPermissions().catch(() => null);
  } catch { /* noop */ }

  await loadActiveRecords(userId);
  if (activeRecords.length === 0) {
    // No records yet — try again later (records may be created during the session)
    setTimeout(() => { void loadActiveRecords(userId); }, 10 * 60 * 1000);
  }

  // Load interval from config (best-effort)
  let intervalMin = DEFAULT_INTERVAL_MIN;
  try {
    const { data } = await supabase
      .from('podp_config')
      .select('sample_interval_minutes, enabled')
      .eq('scope', 'global')
      .maybeSingle();
    if (data?.enabled === false) { stopPodpSampler(); return; }
    if (data?.sample_interval_minutes) intervalMin = data.sample_interval_minutes;
  } catch { /* noop */ }

  const intervalMs = intervalMin * 60 * 1000;
  // Stagger the first sample by a small random delay
  setTimeout(() => { void takeSample(); }, 30_000 + Math.floor(Math.random() * 30_000));
  sampleTimer = window.setInterval(() => { void takeSample(); }, intervalMs);
  // Background sync every 5 minutes regardless of capture
  syncTimer = window.setInterval(() => { void syncOnce(); }, 5 * 60 * 1000);
  // Sync on regain network
  window.addEventListener('online', () => { void syncOnce(); });
}

export function stopPodpSampler(): void {
  if (sampleTimer) { clearInterval(sampleTimer); sampleTimer = null; }
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  activeRecords = [];
  started = false;
}
