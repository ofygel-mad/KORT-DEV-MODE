const hasWindow = typeof window !== 'undefined';

export const isBrowser = hasWindow;

export function getWindow() {
  return hasWindow ? window : undefined;
}

export function getDocument() {
  return hasWindow ? window.document : undefined;
}

export function getNavigator() {
  return hasWindow ? window.navigator : undefined;
}

export type DevicePerformanceTier = 'low' | 'balanced' | 'high';

export interface DevicePerformanceProfile {
  tier: DevicePerformanceTier;
  reducedMotion: boolean;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  maxPixelRatio: number;
  antialias: boolean;
  enableBloom: boolean;
  preferMinimalMotion: boolean;
  flightProjectionIntervalMs: number;
}

export function getDevicePerformanceProfile(): DevicePerformanceProfile {
  const nav = getNavigator() as (Navigator & { deviceMemory?: number }) | undefined;
  const hardwareConcurrency = typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null;
  const deviceMemory = typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : null;
  const reducedMotion = hasWindow && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const lowTier = reducedMotion
    || (hardwareConcurrency !== null && hardwareConcurrency <= 4)
    || (deviceMemory !== null && deviceMemory <= 4);
  const balancedTier = !lowTier && (
    (hardwareConcurrency !== null && hardwareConcurrency <= 8)
    || (deviceMemory !== null && deviceMemory <= 8)
  );
  const tier: DevicePerformanceTier = lowTier ? 'low' : balancedTier ? 'balanced' : 'high';

  return {
    tier,
    reducedMotion,
    hardwareConcurrency,
    deviceMemory,
    maxPixelRatio: tier === 'low' ? 1 : tier === 'balanced' ? 1.25 : 1.5,
    antialias: tier === 'high',
    enableBloom: tier !== 'low',
    preferMinimalMotion: reducedMotion || tier === 'low',
    flightProjectionIntervalMs: tier === 'low' ? 96 : tier === 'balanced' ? 64 : 48,
  };
}

export function addDocumentListener<K extends keyof DocumentEventMap>(
  type: K,
  listener: (event: DocumentEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
) {
  const doc = getDocument();
  if (!doc) return () => undefined;
  doc.addEventListener(type, listener as EventListener, options);
  return () => doc.removeEventListener(type, listener as EventListener, options);
}

type StorageType = 'local' | 'session';

function getStorage(type: StorageType = 'local') {
  const win = getWindow();
  if (!win) return undefined;
  return type === 'session' ? win.sessionStorage : win.localStorage;
}

export function readStorage(key: string, type: StorageType = 'local') {
  try {
    return getStorage(type)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string, type: StorageType = 'local') {
  try {
    getStorage(type)?.setItem(key, value);
  } catch {
    // ignore storage quota/private mode errors
  }
}

export function removeStorage(key: string, type: StorageType = 'local') {
  try {
    getStorage(type)?.removeItem(key);
  } catch {
    // ignore storage quota/private mode errors
  }
}

export function runTimeout(callback: () => void, delay: number) {
  const win = getWindow();
  if (!win) return 0;
  return win.setTimeout(callback, delay);
}

export function reloadWindow() {
  getWindow()?.location.reload();
}

export function redirectTo(path: string) {
  const win = getWindow();
  if (!win) return;
  win.location.assign(path);
}

export function openExternal(url: string, target = '_blank') {
  getWindow()?.open(url, target, 'noopener,noreferrer');
}

export async function copyToClipboard(value: string) {
  const nav = getNavigator();
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(value);
      return true;
    } catch {
      // fallback below
    }
  }

  const doc = getDocument();
  if (!doc) return false;

  const textarea = doc.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  doc.body.appendChild(textarea);
  textarea.select();

  try {
    return doc.execCommand('copy');
  } catch {
    return false;
  } finally {
    doc.body.removeChild(textarea);
  }
}
