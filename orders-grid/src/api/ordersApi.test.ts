import { beforeEach, describe, expect, it } from 'vitest';
import { buildQuery, createOrder, deleteOrder, loadOrders, resetLocalRows, updateOrder } from './ordersApi';

describe('buildQuery', () => {
  it('round-trips skip, take, sort, filter and requireTotalCount', () => {
    const query = buildQuery({
      skip: 20,
      take: 10,
      sort: [{ selector: 'orderDate', desc: true }],
      filter: ['status', '=', 'New'],
      requireTotalCount: true,
    });
    const params = new URLSearchParams(query);
    expect(params.get('skip')).toBe('20');
    expect(params.get('take')).toBe('10');
    expect(JSON.parse(params.get('sort') ?? '[]')).toEqual([{ selector: 'orderDate', desc: true }]);
    expect(JSON.parse(params.get('filter') ?? '[]')).toEqual(['status', '=', 'New']);
    expect(params.get('requireTotalCount')).toBe('true');
  });

  it('returns an empty string for an empty options object', () => {
    expect(buildQuery({})).toBe('');
  });
});

describe('local data fallback', () => {
  beforeEach(() => {
    resetLocalRows();
  });

  it('returns a default page of 20 rows out of 500', async () => {
    const page = await loadOrders({ take: 20, skip: 0 });
    expect(page.data).toHaveLength(20);
    expect(page.totalCount).toBe(500);
  });

  it('leaves the total back at 500 after insert, update and delete', async () => {
    const created = await createOrder({
      orderNumber: 'ORD-99999',
      customer: 'Test Co',
      country: 'Testland',
      status: 'New',
      orderDate: '2026-01-01',
      amount: 42,
      items: [],
    });
    const afterInsert = await loadOrders({ take: 1, requireTotalCount: true });
    expect(afterInsert.totalCount).toBe(501);

    await updateOrder(created.id, { status: 'Shipped' });
    await deleteOrder(created.id);

    const afterDelete = await loadOrders({ take: 1, requireTotalCount: true });
    expect(afterDelete.totalCount).toBe(500);
  });
});
