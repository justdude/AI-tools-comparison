import type { Column } from 'devextreme/ui/data_grid';
import { ORDER_STATUSES } from '../api/types';
import type { Order } from '../api/types';

export const orderColumns: Column<Order, number>[] = [
  {
    dataField: 'orderNumber',
    caption: 'Order #',
    width: 130,
    allowEditing: false,
    sortOrder: 'asc',
    validationRules: [{ type: 'required', message: 'Order number is required' }],
  },
  {
    dataField: 'customer',
    caption: 'Customer',
    minWidth: 180,
    validationRules: [
      { type: 'required', message: 'Customer is required' },
      { type: 'stringLength', min: 2, max: 80, message: 'Customer must be 2-80 characters' },
    ],
  },
  {
    dataField: 'country',
    caption: 'Country',
    width: 120,
    validationRules: [{ type: 'required', message: 'Country is required' }],
  },
  {
    dataField: 'status',
    caption: 'Status',
    lookup: { dataSource: [...ORDER_STATUSES] },
    validationRules: [{ type: 'required', message: 'Status is required' }],
  },
  {
    dataField: 'orderDate',
    caption: 'Order Date',
    dataType: 'date',
    format: 'yyyy-MM-dd',
    validationRules: [{ type: 'required', message: 'Order date is required' }],
  },
  {
    dataField: 'amount',
    caption: 'Amount',
    format: { type: 'currency', precision: 2 },
    validationRules: [
      { type: 'required', message: 'Amount is required' },
      { type: 'range', min: 0, max: 1_000_000, message: 'Amount must be between 0 and 1,000,000' },
    ],
  },
];

export function exportFileName(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `orders-${year}-${month}-${day}.xlsx`;
}
