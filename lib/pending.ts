/**
 * In-memory bridge between /api/search (which waits) and /api/workflow-callback
 * (which the HappyRobot workflow POSTs to when it finishes).
 *
 * Works because Railway runs a single Node process, so both routes share memory.
 * If you ever scale to multiple instances, move this to Redis or similar.
 */
type Resolver = (ids: string[] | null) => void;

const pending = new Map<string, Resolver>();

/** Register a wait for `requestId`; resolves with the ids when the callback
 *  arrives, or null on timeout. */
export function waitForCallback(requestId: string, timeoutMs = 45000): Promise<string[] | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      resolve(null);
    }, timeoutMs);

    pending.set(requestId, (ids) => {
      clearTimeout(timer);
      pending.delete(requestId);
      resolve(ids);
    });
  });
}

/** Called by the callback route. Returns true if a waiter was found. */
export function deliverCallback(requestId: string, ids: string[]): boolean {
  const resolver = pending.get(requestId);
  if (!resolver) return false;
  resolver(ids);
  return true;
}
