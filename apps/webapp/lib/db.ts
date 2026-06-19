import Dexie, { type Table } from "dexie";

// Local-first store (SPEC §6). For offline durability we keep an outbox of
// pending writes (each with a client-generated UUID + syncStatus); the sync
// engine flushes it to /sync/push on reconnect. Lazily instantiated so it never
// touches IndexedDB during SSR.

export type OutboxKind = "party" | "transaction" | "cashbook";
export type SyncStatus = "pending" | "synced" | "error";

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  payload: Record<string, unknown> & { id: string };
  updatedAt: string;
  syncStatus: SyncStatus;
}

class KhatabookDB extends Dexie {
  outbox!: Table<OutboxItem, string>;

  constructor() {
    super("khatabook");
    this.version(1).stores({ outbox: "id, kind, syncStatus" });
  }
}

let instance: KhatabookDB | null = null;

export function getDb(): KhatabookDB {
  if (!instance) instance = new KhatabookDB();
  return instance;
}
