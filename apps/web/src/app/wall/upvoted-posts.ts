const STORAGE_KEY = 'wall-upvoted-posts';

let memoryFallback: Set<number> | undefined;

/**
 * Which post ids this browser has already upvoted, per post rather than one global flag (see
 * `docs/specs/06-upvotes.md`) — survives the wall being pruned/reloaded. Mirrors
 * `client-token.ts`'s try/catch-with-in-memory-fallback shape: if `localStorage` throws (private
 * browsing) this falls back to an in-memory set for the session.
 */
function readIds(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    memoryFallback ??= new Set();
    return memoryFallback;
  }
}

function writeIds(ids: Set<number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    memoryFallback = ids;
  }
}

export function hasUpvoted(postId: number): boolean {
  return readIds().has(postId);
}

export function markUpvoted(postId: number): void {
  const ids = readIds();
  ids.add(postId);
  writeIds(ids);
}

/** Rolls back a `markUpvoted` call when the server request that earned it turns out to have
 * failed — the button must become clickable again, not stay stuck disabled on a vote that never
 * actually landed. */
export function unmarkUpvoted(postId: number): void {
  const ids = readIds();
  ids.delete(postId);
  writeIds(ids);
}
