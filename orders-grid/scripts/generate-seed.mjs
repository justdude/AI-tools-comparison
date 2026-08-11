import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(__dirname, '..', 'src', 'data', 'orders.seed.json');

const CUSTOMERS = [
  'Acme Corp',
  'Globex Inc',
  'Initech',
  'Umbrella Corp',
  'Soylent Ltd',
  'Stark Industries',
  'Wayne Enterprises',
  'Wonka Industries',
  'Hooli',
  'Vandelay Industries',
];

const COUNTRIES = [
  'United States',
  'Germany',
  'France',
  'United Kingdom',
  'Canada',
  'Australia',
  'Japan',
  'Brazil',
];

const STATUSES = ['New', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

const PRODUCTS = [
  { sku: 'SKU-001', product: 'Widget A', unitPrice: 12.5 },
  { sku: 'SKU-002', product: 'Widget B', unitPrice: 24.99 },
  { sku: 'SKU-003', product: 'Gadget C', unitPrice: 8.75 },
  { sku: 'SKU-004', product: 'Gadget D', unitPrice: 45.0 },
  { sku: 'SKU-005', product: 'Gizmo E', unitPrice: 99.99 },
  { sku: 'SKU-006', product: 'Gizmo F', unitPrice: 3.25 },
  { sku: 'SKU-007', product: 'Doohickey G', unitPrice: 150.0 },
  { sku: 'SKU-008', product: 'Doohickey H', unitPrice: 19.95 },
  { sku: 'SKU-009', product: 'Thingamajig I', unitPrice: 67.4 },
  { sku: 'SKU-010', product: 'Thingamajig J', unitPrice: 5.0 },
  { sku: 'SKU-011', product: 'Contraption K', unitPrice: 32.15 },
  { sku: 'SKU-012', product: 'Contraption L', unitPrice: 88.0 },
];

// Fixed-seed linear congruential generator — deterministic, no Math.random.
function makeLcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const rand = makeLcg(20260101);

function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function pad(n, width) {
  return String(n).padStart(width, '0');
}

function randomDate2025to2026() {
  const start = Date.UTC(2025, 0, 1);
  const end = Date.UTC(2026, 11, 31);
  const t = start + Math.floor(rand() * (end - start));
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
}

function buildOrder(id) {
  const itemCount = randInt(1, 4);
  const usedSkus = new Set();
  const items = [];
  while (items.length < itemCount) {
    const candidate = pick(PRODUCTS);
    if (usedSkus.has(candidate.sku)) continue;
    usedSkus.add(candidate.sku);
    const quantity = randInt(1, 10);
    items.push({
      sku: candidate.sku,
      product: candidate.product,
      quantity,
      unitPrice: candidate.unitPrice,
    });
  }
  const amount = Math.round(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100) / 100;

  return {
    id,
    orderNumber: `ORD-${10000 + id}`,
    customer: pick(CUSTOMERS),
    country: pick(COUNTRIES),
    status: pick(STATUSES),
    orderDate: randomDate2025to2026(),
    amount,
    items,
  };
}

function generateOrders() {
  const orders = [];
  for (let id = 1; id <= 500; id += 1) {
    orders.push(buildOrder(id));
  }
  return orders;
}

function hashOf(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const orders = generateOrders();
const json = `${JSON.stringify(orders, null, 2)}\n`;
const hash = hashOf(json);

const isCheck = process.argv.includes('--check');

if (isCheck) {
  const existing = readFileSync(outFile);
  const existingHash = hashOf(existing);
  if (existingHash === hash) {
    console.log(`Seed is deterministic sha256=${hash}`);
    process.exit(0);
  }
  console.log(`Existing sha256=${existingHash}`);
  console.log(`Regenerated sha256=${hash}`);
  process.exit(1);
} else {
  writeFileSync(outFile, json);
  console.log(`Wrote 500 orders sha256=${hash}`);
}
