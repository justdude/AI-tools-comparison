import { CustomStore } from 'devextreme/common/data';
import type { LoadOptions, LoadResult } from 'devextreme/common/data';
import { createOrder, deleteOrder, getOrder, loadOrders, updateOrder } from './ordersApi';
import type { Order } from './types';

export const createOrdersStore = (onError?: (message: string) => void): CustomStore<Order, number> =>
  new CustomStore<Order, number>({
    key: 'id',
    loadMode: 'processed',
    load: async (options: LoadOptions<Order>): Promise<LoadResult<Order>> => {
      try {
        const page = await loadOrders(options);
        return { data: page.data, totalCount: page.totalCount };
      } catch (error) {
        onError?.((error as Error).message);
        throw error;
      }
    },
    byKey: (key: number) => getOrder(key),
    insert: (values) => createOrder(values),
    update: (key: number, values) => updateOrder(key, values),
    remove: (key: number) => deleteOrder(key),
  });
