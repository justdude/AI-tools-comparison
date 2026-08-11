import type { LoadOptions } from 'devextreme/common/data';
import { queryLocal } from './localQuery';
import seedOrdersJson from '../data/orders.seed.json';
import type { Order, PagedResult } from './types';

const seedOrders = seedOrdersJson as Order[];

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
export const USE_LOCAL = API_BASE === '';

function cloneSeed(): Order[] {
  return seedOrders.map((order) => ({ ...order, items: order.items.map((item) => ({ ...item })) }));
}

let localRows: Order[] = cloneSeed();

export function resetLocalRows(): void {
  localRows = cloneSeed();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function nextLocalId(): number {
  return localRows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}

export function buildQuery(options: LoadOptions<Order>): string {
  const params = new URLSearchParams();
  if (options.skip !== undefined) params.set('skip', String(options.skip));
  if (options.take !== undefined) params.set('take', String(options.take));
  if (options.sort !== undefined) params.set('sort', JSON.stringify(options.sort));
  if (options.filter !== undefined) params.set('filter', JSON.stringify(options.filter));
  if (options.requireTotalCount !== undefined) {
    params.set('requireTotalCount', String(options.requireTotalCount));
  }
  return params.toString();
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export async function loadOrders(options: LoadOptions<Order>): Promise<PagedResult<Order>> {
  if (USE_LOCAL) {
    await delay(120);
    return queryLocal(localRows, options);
  }
  return requestJson<PagedResult<Order>>(`${API_BASE}/api/orders?${buildQuery(options)}`);
}

export async function getOrder(id: number): Promise<Order> {
  if (USE_LOCAL) {
    await Promise.resolve();
    const found = localRows.find((row) => row.id === id);
    if (!found) throw new Error(`Order ${id} not found`);
    return found;
  }
  return requestJson<Order>(`${API_BASE}/api/orders/${String(id)}`);
}

export async function createOrder(values: Partial<Order>): Promise<Order> {
  if (USE_LOCAL) {
    await Promise.resolve();
    const created: Order = {
      id: nextLocalId(),
      orderNumber: values.orderNumber ?? '',
      customer: values.customer ?? '',
      country: values.country ?? '',
      status: values.status ?? 'New',
      orderDate: values.orderDate ?? new Date().toISOString().slice(0, 10),
      amount: values.amount ?? 0,
      items: values.items ?? [],
    };
    localRows = [...localRows, created];
    return created;
  }
  return requestJson<Order>(`${API_BASE}/api/orders`, { method: 'POST', body: JSON.stringify(values) });
}

export async function updateOrder(id: number, values: Partial<Order>): Promise<Order> {
  if (USE_LOCAL) {
    await Promise.resolve();
    const index = localRows.findIndex((row) => row.id === id);
    if (index === -1) throw new Error(`Order ${id} not found`);
    const updated: Order = { ...localRows[index], ...values, id };
    localRows = localRows.map((row, i) => (i === index ? updated : row));
    return updated;
  }
  return requestJson<Order>(`${API_BASE}/api/orders/${String(id)}`, {
    method: 'PUT',
    body: JSON.stringify(values),
  });
}

export async function deleteOrder(id: number): Promise<void> {
  if (USE_LOCAL) {
    await Promise.resolve();
    localRows = localRows.filter((row) => row.id !== id);
    return;
  }
  const response = await fetch(`${API_BASE}/api/orders/${String(id)}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
}
