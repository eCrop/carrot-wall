const STORAGE_KEY = 'wall-client-token';

let memoryFallback: string | undefined;

/**
 * A random id this browser sends as `X-Client-Token` so the API can rate-limit per-browser
 * instead of per-IP — the whole classroom shares one public IP behind Railway. Not auth: if
 * `localStorage` throws (private browsing) this falls back to an in-memory id for the session.
 */
export function getClientToken(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const created = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    memoryFallback ??= crypto.randomUUID();
    return memoryFallback;
  }
}
