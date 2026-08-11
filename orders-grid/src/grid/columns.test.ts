import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES } from '../api/types';
import { exportFileName, orderColumns } from './columns';

describe('orderColumns', () => {
  it('declares fields in the expected order with no duplicates', () => {
    const fields = orderColumns.map((column) => column.dataField);
    expect(fields).toEqual(['orderNumber', 'customer', 'country', 'status', 'orderDate', 'amount']);
    expect(new Set(fields).size).toBe(fields.length);
  });

  it('requires every column', () => {
    for (const column of orderColumns) {
      const rules = column.validationRules ?? [];
      expect(rules.some((rule) => rule.type === 'required')).toBe(true);
    }
  });

  it('matches the status lookup to ORDER_STATUSES', () => {
    const statusColumn = orderColumns.find((column) => column.dataField === 'status');
    expect(statusColumn?.lookup?.dataSource).toEqual([...ORDER_STATUSES]);
  });

  it('formats amount as currency', () => {
    const amountColumn = orderColumns.find((column) => column.dataField === 'amount');
    expect(amountColumn?.format).toEqual({ type: 'currency', precision: 2 });
  });
});

describe('exportFileName', () => {
  it('formats the export file name from a date', () => {
    expect(exportFileName(new Date('2026-07-27T10:00:00Z'))).toBe('orders-2026-07-27.xlsx');
  });
});
