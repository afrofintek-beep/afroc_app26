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
import { Capacitor, registerPlugin } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

// Plugin nativo de geolocalização em SEGUNDO PLANO
// (@capacitor-community/background-geolocation). Registado via registerPlugin
// para não afetar o build web: no browser não há implementação e só é chamado
// quando Capacitor.isNativePlatform() é verdadeiro. Requer permissões nativas
// (iOS: NSLocationAlwaysAndWhenInUseUsageDescription + background mode; Android:
// ACCESS_BACKGROUND_LOCATION + foreground service) — a configurar no projeto
// nativo quando for gerado (npx cap add ios/android).
interface BGLocation { latitude: number; longitude: number; accuracy?: number }
interface BackgroundGeolocationPlugin {
  addWatcher(
    options: { backgroundMessage?: string; backgroundTitle?: string; requestPermissions?: boolean; stale?: boolean; distanceFilter?: number },
    callback: (location?: BGLocation, error?: { code?: string }) => void,
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
}
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

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
let bgWatcherId: string | null = null;
let lastBgSampleAt = 0;
let activeRecords: Array<{ id: string; geo_lat: number; geo_lon: number; metadata?: any }> = [];

// Enfileira uma amostra por registo ativo a partir de uma posição já obtida.
async function enqueueFromLocation(lat: number, lon: number, accuracy?: number): Promise<void> {
  if (activeRecords.length === 0) return;
  const capturedAt = new Date().toISOString();
  for (const rec of activeRecords) {
    await enqueueSample({
      clientGeneratedId: `${rec.id}-${capturedAt}`,
      afrolocRecordId: rec.id,
      lat, lon, accuracy, capturedAt,
    });
  }
  // Try a sync right after capture
  void syncOnce();
}

// Caminho WEB / primeiro plano: pede a posição atual e enfileira.
async function takeSample(): Promise<void> {
  if (activeRecords.length === 0) return;
  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60000,
    });
    await enqueueFromLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
  } catch (e) {
    console.debug('[podp] sample skipped', e);
  }
}

// Caminho NATIVO / segundo plano: um watcher que dispara mesmo com a app fechada.
// Estrangula as amostras ao intervalo da config para não sobre-amostrar.
async function startNativeBackground(intervalMs: number): Promise<void> {
  try {
    bgWatcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: 'A confirmar a presença no seu endereço AFROLOC.',
        backgroundTitle: 'AFROLOC',
        requestPermissions: true,
        stale: false,
        distanceFilter: 50,
      },
      (location, error) => {
        if (error || !location) return;
        const now = Date.now();
        if (now - lastBgSampleAt < intervalMs) return; // estrangular ao intervalo
        lastBgSampleAt = now;
        void enqueueFromLocation(location.latitude, location.longitude, location.accuracy);
      },
    );
  } catch (e) {
    console.debug('[podp] background watcher indisponível (fallback foreground)', e);
    bgWatcherId = null;
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

  // NATIVO: watcher de localização em SEGUNDO PLANO (funciona com a app fechada).
  // WEB/PWA: intervalo em PRIMEIRO PLANO (só corre com a app aberta). Se o watcher
  // nativo não estiver disponível, cai para o intervalo.
  if (Capacitor.isNativePlatform()) {
    await startNativeBackground(intervalMs);
  }
  if (bgWatcherId == null) {
    // Stagger the first sample by a small random delay
    setTimeout(() => { void takeSample(); }, 30_000 + Math.floor(Math.random() * 30_000));
    sampleTimer = window.setInterval(() => { void takeSample(); }, intervalMs);
  }
  // Background sync every 5 minutes regardless of capture
  syncTimer = window.setInterval(() => { void syncOnce(); }, 5 * 60 * 1000);
  // Sync on regain network
  window.addEventListener('online', () => { void syncOnce(); });
}

export function stopPodpSampler(): void {
  if (sampleTimer) { clearInterval(sampleTimer); sampleTimer = null; }
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  if (bgWatcherId) { void BackgroundGeolocation.removeWatcher({ id: bgWatcherId }); bgWatcherId = null; }
  activeRecords = [];
  started = false;
}
