import type { Order } from '../api/types';

interface OrderDetailDrawerProps {
  order: Order | null;
  onClose: () => void;
}

export function OrderDetailDrawer({ order, onClose }: OrderDetailDrawerProps) {
  if (order === null) return null;

  return (
    <aside className="order-drawer" data-testid="order-drawer">
      <button type="button" aria-label="Close details" onClick={onClose}>
        Close details
      </button>
      <h2>{order.orderNumber}</h2>
      <dl>
        <dt>Customer</dt>
        <dd>{order.customer}</dd>
        <dt>Country</dt>
        <dd>{order.country}</dd>
        <dt>Status</dt>
        <dd>{order.status}</dd>
        <dt>Order date</dt>
        <dd>{order.orderDate}</dd>
        <dt>Amount</dt>
        <dd>{order.amount.toFixed(2)}</dd>
      </dl>
    </aside>
  );
}
