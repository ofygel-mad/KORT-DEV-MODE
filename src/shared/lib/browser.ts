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
