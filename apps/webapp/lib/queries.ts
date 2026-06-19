import {
  computePartyBalance,
  computeRunningBalance,
  describeBalance,
} from "@khatabook/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type CreateCashbookPayload,
  type CreatePartyPayload,
  type CreateTransactionPayload,
} from "./api";
import { offlineCreate } from "./sync";
import type { Cashbook, Ledger, LedgerEntry } from "./types";

export const useBusinesses = () =>
  useQuery({ queryKey: ["businesses"], queryFn: api.getBusinesses });

export const useParties = (businessId?: string) =>
  useQuery({
    queryKey: ["parties", businessId],
    queryFn: () => api.getParties(businessId!),
    enabled: !!businessId,
  });

export const useLedger = (partyId: string) =>
  useQuery({ queryKey: ["ledger", partyId], queryFn: () => api.getLedger(partyId) });

export const useCashbook = (businessId?: string) =>
  useQuery({
    queryKey: ["cashbook", businessId],
    queryFn: () => api.getCashbook(businessId!),
    enabled: !!businessId,
  });

export const useSummary = (businessId?: string) =>
  useQuery({
    queryKey: ["summary", businessId],
    queryFn: () => api.getSummary(businessId!),
    enabled: !!businessId,
  });

/** Add a ledger transaction — optimistic on the party's ledger (instant feel). */
export function useCreateTransaction(businessId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransactionPayload) =>
      offlineCreate("transaction", input, () => api.createTransaction(input)),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["ledger", input.partyId] });
      const prev = qc.getQueryData<Ledger>(["ledger", input.partyId]);
      if (prev) {
        const optimistic: LedgerEntry = {
          id: input.id,
          type: input.type,
          amountPaise: input.amountPaise,
          note: input.note ?? null,
          attachmentUrl: null,
          attachments: input.attachments ?? null,
          txnDate: input.txnDate ?? new Date().toISOString(),
          dueDate: input.dueDate ?? null,
          runningBalancePaise: 0,
        };
        const merged = [...prev.entries, optimistic];
        const rows = computeRunningBalance(merged);
        const entries = rows.map((r) => ({
          ...(r.txn as LedgerEntry),
          runningBalancePaise: r.balancePaise,
        }));
        const balancePaise = computePartyBalance(merged);
        qc.setQueryData<Ledger>(["ledger", input.partyId], {
          ...prev,
          entries,
          balancePaise,
          balance: describeBalance(balancePaise),
        });
      }
      return { prev };
    },
    onError: (_err, input, ctx) => {
      if (ctx?.prev) qc.setQueryData(["ledger", input.partyId], ctx.prev);
    },
    onSettled: (_d, _e, input) => {
      qc.invalidateQueries({ queryKey: ["ledger", input.partyId] });
      if (businessId) {
        qc.invalidateQueries({ queryKey: ["parties", businessId] });
        qc.invalidateQueries({ queryKey: ["summary", businessId] });
      }
    },
  });
}

/** Add a party — optimistic append to the customers list. */
export function useCreateParty(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePartyPayload) =>
      offlineCreate("party", { ...input, businessId }, () => api.createParty(businessId, input)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["parties", businessId] });
      qc.invalidateQueries({ queryKey: ["summary", businessId] });
    },
  });
}

export const useInventory = (businessId?: string) =>
  useQuery({
    queryKey: ["inventory", businessId],
    queryFn: () => api.getInventory(businessId!),
    enabled: !!businessId,
  });

export function useCreateInventory(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createInventory,
    onSettled: () => qc.invalidateQueries({ queryKey: ["inventory", businessId] }),
  });
}

export function useUpdateInventory(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; stockDelta?: number }) =>
      api.updateInventory(id, data),
    onSettled: () => qc.invalidateQueries({ queryKey: ["inventory", businessId] }),
  });
}

export const useInvoices = (businessId?: string) =>
  useQuery({
    queryKey: ["invoices", businessId],
    queryFn: () => api.getInvoices(businessId!),
    enabled: !!businessId,
  });

export function useCreateInvoice(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createInvoice,
    onSettled: () => qc.invalidateQueries({ queryKey: ["invoices", businessId] }),
  });
}

/** Add a cashbook entry — optimistic prepend + running net. */
export function useCreateCashbook(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCashbookPayload) =>
      offlineCreate("cashbook", input, () => api.createCashbook(input)),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["cashbook", businessId] });
      const prev = qc.getQueryData<Cashbook>(["cashbook", businessId]);
      if (prev) {
        const optimistic = {
          id: input.id,
          direction: input.direction,
          amountPaise: input.amountPaise,
          category: input.category ?? null,
          paymentMode: input.paymentMode ?? null,
          note: input.note ?? null,
          attachments: input.attachments ?? null,
          entryDate: new Date().toISOString(),
        };
        const delta = input.direction === "IN" ? input.amountPaise : -input.amountPaise;
        qc.setQueryData<Cashbook>(["cashbook", businessId], {
          entries: [optimistic, ...prev.entries],
          netPaise: prev.netPaise + delta,
        });
      }
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(["cashbook", businessId], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["cashbook", businessId] });
      qc.invalidateQueries({ queryKey: ["summary", businessId] });
    },
  });
}
