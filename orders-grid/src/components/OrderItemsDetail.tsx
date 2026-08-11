import type { Order } from '../api/types';

interface OrderItemsDetailProps {
  data: { data: Order };
}

export function OrderItemsDetail({ data }: OrderItemsDetailProps) {
  const { items } = data.data;

  return (
    <table data-testid="master-detail" className="order-items-detail">
      <thead>
        <tr>
          <th>SKU</th>
          <th>Product</th>
          <th>Quantity</th>
          <th>Unit price</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.sku}>
            <td>{item.sku}</td>
            <td>{item.product}</td>
            <td>{item.quantity}</td>
            <td>{item.unitPrice.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
