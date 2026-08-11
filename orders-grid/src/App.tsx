import { USE_LOCAL } from './api/ordersApi';
import { OrdersGrid } from './components/OrdersGrid';

export function App() {
  return (
    <div className="app">
      {USE_LOCAL && (
        <div className="local-mode-banner" data-testid="local-mode-banner" role="status">
          Using the seeded local dataset. Set VITE_API_BASE_URL to switch to the REST backend.
        </div>
      )}
      <OrdersGrid />
    </div>
  );
}
