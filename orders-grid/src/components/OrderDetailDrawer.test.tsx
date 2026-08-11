import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Order } from '../api/types';
import { OrderDetailDrawer } from './OrderDetailDrawer';

const order: Order = {
  id: 1,
  orderNumber: 'ORD-10001',
  customer: 'Acme Corp',
  country: 'United States',
  status: 'New',
  orderDate: '2026-01-01',
  amount: 123.45,
  items: [],
};

describe('OrderDetailDrawer', () => {
  it('renders nothing when no order is selected', () => {
    const { container } = render(<OrderDetailDrawer order={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the order number and customer', () => {
    render(<OrderDetailDrawer order={order} onClose={() => {}} />);
    expect(screen.getByTestId('order-drawer')).toBeInTheDocument();
    expect(screen.getByText('ORD-10001')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('calls onClose once when Close details is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<OrderDetailDrawer order={order} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close details' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
