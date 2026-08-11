export const ORDER_STATUSES = ['New', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderItem {
  sku: string;
  product: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  customer: string;
  country: string;
  status: OrderStatus;
  orderDate: string;
  amount: number;
  items: OrderItem[];
}

export interface PagedResult<T> {
  data: T[];
  totalCount: number;
}
