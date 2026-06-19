import { session } from "./auth";
import type {
  AuthResult,
  Business,
  Cashbook,
  InventoryItem,
  Invoice,
  InvoiceLineItem,
  Ledger,
  PartyListItem,
  Summary,
  User,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const BASE = API_BASE;

export function rangeQuery(range?: { from?: string; to?: string }): string {
  const qs = new URLSearchParams();
  if (range?.from) qs.set("from", range.from);
  if (range?.to) qs.set("to", range.to);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = session.getAccess();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string })?.error ?? res.statusText);
  }
  return data as T;
}

export interface PartyAddress {
  flat?: string;
  area?: string;
  pincode?: string;
  city?: string;
  state?: string;
  shippingSameAsBilling?: boolean;
}

export interface CreatePartyPayload {
  id: string;
  name: string;
  phone?: string;
  type: "CUSTOMER" | "SUPPLIER";
  gstin?: string;
  address?: PartyAddress;
  openingBalancePaise?: number;
  openingBalanceType?: "GAVE" | "GOT";
}

export interface CreateTransactionPayload {
  id: string;
  partyId: string;
  type: "CREDIT" | "DEBIT";
  amountPaise: number;
  note?: string;
  attachments?: string[];
  txnDate?: string;
  dueDate?: string;
}

export interface CreateCashbookPayload {
  id: string;
  businessId: string;
  direction: "IN" | "OUT";
  amountPaise: number;
  category?: string;
  paymentMode?: "CASH" | "ONLINE";
  note?: string;
  attachments?: string[];
}

export const api = {
  requestOtp: (phone: string) => request<{ ok: boolean }>("POST", "/auth/request-otp", { phone }),
  verifyOtp: (phone: string, otp: string) =>
    request<AuthResult>("POST", "/auth/verify-otp", { phone, otp }),
  getMe: () => request<User>("GET", "/auth/me"),
  updateProfile: (data: { name?: string; email?: string }) =>
    request<User>("PATCH", "/auth/profile", data),

  getBusinesses: () => request<Business[]>("GET", "/businesses"),
  createBusiness: (data: { id: string; name: string }) =>
    request<Business>("POST", "/businesses", data),
  updateBusiness: (id: string, data: { name: string }) =>
    request<Business>("PATCH", `/businesses/${id}`, data),
  getParties: (businessId: string) =>
    request<PartyListItem[]>("GET", `/businesses/${businessId}/parties`),
  createParty: (businessId: string, data: CreatePartyPayload) =>
    request<unknown>("POST", `/businesses/${businessId}/parties`, data),
  getLedger: (partyId: string) => request<Ledger>("GET", `/parties/${partyId}/ledger`),
  createTransaction: (data: CreateTransactionPayload) =>
    request<unknown>("POST", "/transactions", data),
  getCashbook: (businessId: string, range?: { from?: string; to?: string }) =>
    request<Cashbook>("GET", `/businesses/${businessId}/cashbook${rangeQuery(range)}`),
  createCashbook: (data: CreateCashbookPayload) =>
    request<unknown>("POST", "/cashbook", data),
  getSummary: (businessId: string, range?: { from?: string; to?: string }) =>
    request<Summary>("GET", `/businesses/${businessId}/reports/summary${rangeQuery(range)}`),
  remind: (partyId: string) =>
    request<{ ok: boolean }>("POST", `/parties/${partyId}/remind`),

  getInventory: (businessId: string) =>
    request<InventoryItem[]>("GET", `/businesses/${businessId}/inventory`),
  createInventory: (data: {
    id: string;
    businessId: string;
    name: string;
    stockQty: number;
    lowStockThreshold: number;
    pricePaise: number;
  }) => request<unknown>("POST", "/inventory", data),
  updateInventory: (id: string, data: { stockDelta?: number; name?: string; pricePaise?: number; lowStockThreshold?: number }) =>
    request<unknown>("PATCH", `/inventory/${id}`, data),

  getInvoices: (businessId: string, range?: { from?: string; to?: string }) =>
    request<Invoice[]>("GET", `/businesses/${businessId}/invoices${rangeQuery(range)}`),
  createInvoice: (data: {
    id: string;
    businessId: string;
    partyId?: string;
    items: InvoiceLineItem[];
  }) => request<Invoice>("POST", "/invoices", data),

  async uploadImage(file: File): Promise<{ attachmentUrl: string }> {
    const token = session.getAccess();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/uploads`, {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: fd, // browser sets multipart content-type + boundary
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error ?? "Upload failed");
    return data as { attachmentUrl: string };
  },

  setPin: (pin: string) => request<{ ok: boolean }>("POST", "/auth/set-pin", { pin }),
  syncPush: (changes: { parties: unknown[]; transactions: unknown[]; cashbook: unknown[] }) =>
    request<{ applied: number; skipped: number }>("POST", "/sync/push", { changes }),
  syncPull: (since?: string) =>
    request<unknown>("GET", `/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ""}`),
};
