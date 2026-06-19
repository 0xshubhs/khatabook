import type {
  BalanceDescription,
  CashDirection,
  PartyType,
  TransactionType,
} from "@khatabook/shared";

export interface User {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  hasPin: boolean;
}

export interface Business {
  id: string;
  name: string;
}

export interface PartyListItem {
  id: string;
  name: string;
  phone: string | null;
  type: PartyType;
  balancePaise: number;
  balance: BalanceDescription;
}

export interface LedgerEntry {
  id: string;
  type: TransactionType;
  amountPaise: number;
  note: string | null;
  attachmentUrl: string | null;
  attachments: string[] | null;
  txnDate: string;
  dueDate: string | null;
  runningBalancePaise: number;
}

export interface Ledger {
  party: {
    id: string;
    name: string;
    phone: string | null;
    type: PartyType;
    businessId: string;
  };
  balancePaise: number;
  balance: BalanceDescription;
  entries: LedgerEntry[];
}

export interface CashEntry {
  id: string;
  direction: CashDirection;
  amountPaise: number;
  category: string | null;
  paymentMode?: string | null;
  note: string | null;
  attachments: string[] | null;
  entryDate: string;
}

export interface Cashbook {
  entries: CashEntry[];
  netPaise: number;
}

export interface Summary {
  receivablePaise: number;
  payablePaise: number;
  cashbookNetPaise: number;
  salesPaise: number;
  purchasesPaise: number;
  parties: { name: string; type: PartyType; balancePaise: number }[];
  from: string | null;
  to: string | null;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface InventoryItem {
  id: string;
  name: string;
  stockQty: number;
  lowStockThreshold: number;
  pricePaise: number;
  lowStock: boolean;
}

export interface InvoiceLineItem {
  name: string;
  qty: number;
  ratePaise: number;
}

export interface Invoice {
  id: string;
  number: string;
  partyId: string | null;
  items: InvoiceLineItem[];
  totalPaise: number;
  createdAt: string;
}
