import { api } from "./api";
import { session } from "./auth";
import { getDb, type OutboxItem, type OutboxKind } from "./db";

function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

/** Persist a pending write to the outbox (survives reload / offline). */
async function enqueue<T extends { id: string }>(kind: OutboxKind, payload: T) {
  await getDb().outbox.put({
    id: payload.id,
    kind,
    payload: payload as unknown as OutboxItem["payload"],
    updatedAt: new Date().toISOString(),
    syncStatus: "pending",
  });
}

/**
 * Durable create: write to the outbox first, then try the direct API call.
 * - online + success: drop from outbox (already persisted server-side).
 * - online + real error: rethrow so the UI can roll back the optimistic update.
 * - offline: resolve anyway — the optimistic UI stays and the outbox flushes later.
 */
export async function offlineCreate<T extends { id: string }>(
  kind: OutboxKind,
  payload: T,
  onlineFn: () => Promise<unknown>,
): Promise<void> {
  await enqueue(kind, payload);
  try {
    await onlineFn();
    await getDb().outbox.delete(payload.id);
  } catch (err) {
    if (online()) throw err; // genuine failure while online
    // offline: keep it pending; flushOutbox() will push it on reconnect
  }
}

/** Push all pending outbox items to the server (last-write-wins, batched). */
export async function flushOutbox(): Promise<{ pushed: number }> {
  if (!session.getAccess() || !online()) return { pushed: 0 };
  const db = getDb();
  const pending = await db.outbox.where("syncStatus").equals("pending").toArray();
  if (pending.length === 0) return { pushed: 0 };

  const changes = {
    parties: [] as unknown[],
    transactions: [] as unknown[],
    cashbook: [] as unknown[],
  };
  for (const item of pending) {
    const rec = { ...item.payload, updatedAt: item.updatedAt };
    if (item.kind === "party") changes.parties.push(rec);
    else if (item.kind === "transaction") changes.transactions.push(rec);
    else if (item.kind === "cashbook") changes.cashbook.push(rec);
  }

  await api.syncPush(changes);
  await db.outbox.bulkDelete(pending.map((p) => p.id));
  return { pushed: pending.length };
}

/** Start the sync loop: flush now and whenever connectivity returns. */
export function startSync(onSynced?: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const run = () => {
    flushOutbox()
      .then((r) => {
        if (r.pushed > 0) onSynced?.();
      })
      .catch(() => {});
  };
  window.addEventListener("online", run);
  run();
  return () => window.removeEventListener("online", run);
}
