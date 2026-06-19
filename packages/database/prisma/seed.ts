// Seed: 1 demo user, 1 business, 5 parties (~19 transactions), 10 cashbook
// entries, 3 inventory items — so logging in shows a populated screen instantly.
// All money is integer paise. Re-runnable (wipes the demo data first).
import {
  PrismaClient,
  PartyType,
  TransactionType,
  CashDirection,
} from "../generated/client/index.js";

const prisma = new PrismaClient();

const DEMO_PHONE = "+919999999999";

/** A date `n` days before now — used to spread entries over time. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

interface SeedTxn {
  type: TransactionType;
  amountPaise: number;
  note: string;
  day: number;
}

interface SeedParty {
  name: string;
  phone: string;
  type: PartyType;
  txns: SeedTxn[];
}

const PARTIES: SeedParty[] = [
  {
    name: "Ramesh Kumar",
    phone: "+919811111111",
    type: PartyType.CUSTOMER,
    txns: [
      { type: TransactionType.CREDIT, amountPaise: 50000, note: "Groceries on credit", day: 20 },
      { type: TransactionType.DEBIT, amountPaise: 20000, note: "Part payment", day: 15 },
      { type: TransactionType.CREDIT, amountPaise: 30000, note: "Rice + oil", day: 7 },
      { type: TransactionType.DEBIT, amountPaise: 30000, note: "Cash received", day: 2 },
    ], // balance = +30000 (₹300 due)
  },
  {
    name: "Sunita Devi",
    phone: "+919822222222",
    type: PartyType.CUSTOMER,
    txns: [
      { type: TransactionType.CREDIT, amountPaise: 100000, note: "Monthly supplies", day: 25 },
      { type: TransactionType.DEBIT, amountPaise: 25000, note: "Payment", day: 18 },
      { type: TransactionType.CREDIT, amountPaise: 25000, note: "Snacks", day: 10 },
      { type: TransactionType.DEBIT, amountPaise: 25000, note: "Payment", day: 3 },
    ], // balance = +75000 (₹750 due)
  },
  {
    name: "Vijay Store",
    phone: "+919833333333",
    type: PartyType.CUSTOMER,
    txns: [
      { type: TransactionType.CREDIT, amountPaise: 150000, note: "Bulk order", day: 22 },
      { type: TransactionType.DEBIT, amountPaise: 30000, note: "Advance", day: 16 },
      { type: TransactionType.CREDIT, amountPaise: 50000, note: "Refill", day: 9 },
      { type: TransactionType.DEBIT, amountPaise: 50000, note: "UPI payment", day: 1 },
    ], // balance = +120000 (₹1200 due)
  },
  {
    name: "Anil Traders",
    phone: "+919844444444",
    type: PartyType.SUPPLIER,
    txns: [
      { type: TransactionType.DEBIT, amountPaise: 200000, note: "Stock purchased", day: 28 },
      { type: TransactionType.CREDIT, amountPaise: 50000, note: "Paid to supplier", day: 20 },
      { type: TransactionType.DEBIT, amountPaise: 50000, note: "More stock", day: 12 },
      { type: TransactionType.CREDIT, amountPaise: 50000, note: "Paid to supplier", day: 4 },
    ], // balance = -150000 (₹1500 payable)
  },
  {
    name: "Meena Wholesale",
    phone: "+919855555555",
    type: PartyType.SUPPLIER,
    txns: [
      { type: TransactionType.DEBIT, amountPaise: 80000, note: "Wholesale order", day: 26 },
      { type: TransactionType.DEBIT, amountPaise: 40000, note: "Top-up order", day: 14 },
      { type: TransactionType.CREDIT, amountPaise: 40000, note: "Paid", day: 5 },
    ], // balance = -80000 (₹800 payable)
  },
];

const CASHBOOK: {
  direction: CashDirection;
  amountPaise: number;
  category: string;
  note: string;
  day: number;
}[] = [
  { direction: CashDirection.IN, amountPaise: 500000, category: "Sales", note: "Counter sales", day: 1 },
  { direction: CashDirection.IN, amountPaise: 350000, category: "Sales", note: "Counter sales", day: 3 },
  { direction: CashDirection.IN, amountPaise: 420000, category: "Sales", note: "Counter sales", day: 6 },
  { direction: CashDirection.IN, amountPaise: 80000, category: "Misc", note: "Scrap sale", day: 8 },
  { direction: CashDirection.IN, amountPaise: 600000, category: "Sales", note: "Festival sales", day: 10 },
  { direction: CashDirection.OUT, amountPaise: 1000000, category: "Rent", note: "Shop rent", day: 1 },
  { direction: CashDirection.OUT, amountPaise: 600000, category: "Salary", note: "Helper salary", day: 2 },
  { direction: CashDirection.OUT, amountPaise: 45000, category: "Electricity", note: "Power bill", day: 5 },
  { direction: CashDirection.OUT, amountPaise: 120000, category: "Supplies", note: "Packaging", day: 7 },
  { direction: CashDirection.OUT, amountPaise: 5000, category: "Misc", note: "Tea", day: 9 },
]; // net = 1950000 - 1770000 = +180000 (₹1800)

const INVENTORY = [
  { name: "Rice 25kg bag", stockQty: 40, lowStockThreshold: 10, pricePaise: 120000 },
  { name: "Cooking Oil 1L", stockQty: 8, lowStockThreshold: 12, pricePaise: 18000 }, // LOW
  { name: "Sugar 1kg", stockQty: 100, lowStockThreshold: 20, pricePaise: 4500 },
];

async function main() {
  // Wipe demo data in FK-safe order so the seed is re-runnable.
  await prisma.reminder.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.cashbookEntry.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.party.deleteMany();
  await prisma.business.deleteMany();
  await prisma.user.deleteMany({ where: { phone: DEMO_PHONE } });

  const user = await prisma.user.create({
    data: { phone: DEMO_PHONE, name: "Demo Shopkeeper" },
  });

  const business = await prisma.business.create({
    data: { userId: user.id, name: "Sharma General Store" },
  });

  let txnCount = 0;
  for (const p of PARTIES) {
    const party = await prisma.party.create({
      data: { businessId: business.id, name: p.name, phone: p.phone, type: p.type },
    });
    for (const t of p.txns) {
      await prisma.transaction.create({
        data: {
          partyId: party.id,
          type: t.type,
          amountPaise: t.amountPaise,
          note: t.note,
          txnDate: daysAgo(t.day),
        },
      });
      txnCount++;
    }
  }

  for (const c of CASHBOOK) {
    await prisma.cashbookEntry.create({
      data: {
        businessId: business.id,
        direction: c.direction,
        amountPaise: c.amountPaise,
        category: c.category,
        note: c.note,
        entryDate: daysAgo(c.day),
      },
    });
  }

  for (const item of INVENTORY) {
    await prisma.inventoryItem.create({ data: { businessId: business.id, ...item } });
  }

  console.log("Seed complete:");
  console.log(`  user        ${DEMO_PHONE} (${user.id})`);
  console.log(`  business    ${business.name}`);
  console.log(`  parties     ${PARTIES.length}`);
  console.log(`  transactions ${txnCount}`);
  console.log(`  cashbook    ${CASHBOOK.length}`);
  console.log(`  inventory   ${INVENTORY.length}`);
  console.log("Expected: receivable ₹2250, payable ₹2300, cashbook net ₹1800, 1 low-stock item.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
