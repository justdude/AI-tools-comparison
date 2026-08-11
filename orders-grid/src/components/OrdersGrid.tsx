import { useCallback, useMemo, useRef, useState } from 'react';
import DataGrid, {
  Editing,
  Export,
  FilterRow,
  Item,
  LoadPanel,
  MasterDetail,
  Pager,
  Paging,
  RemoteOperations,
  Sorting,
  Toolbar,
} from 'devextreme-react/data-grid';
import type { DataGridRef } from 'devextreme-react/data-grid';
import type { ExportingEvent, RowClickEvent } from 'devextreme/ui/data_grid';
import { createOrdersStore } from '../api/ordersStore';
import type { Order } from '../api/types';
import { exportFileName, orderColumns } from '../grid/columns';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { OrderItemsDetail } from './OrderItemsDetail';

export function OrdersGrid() {
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const gridRef = useRef<DataGridRef<Order, number>>(null);

  const store = useMemo(() => createOrdersStore(setError), []);

  const handleRowClick = useCallback((e: RowClickEvent<Order, number>) => {
    if (e.rowType === 'data') {
      setSelectedOrder(e.data);
    }
  }, []);

  const handleExporting = useCallback((e: ExportingEvent<Order, number>) => {
    e.cancel = true;
    void (async () => {
      const [{ Workbook }, { saveAs }, { exportDataGrid }] = await Promise.all([
        import('exceljs'),
        import('file-saver'),
        import('devextreme/excel_exporter'),
      ]);
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Orders');
      await exportDataGrid({ component: e.component, worksheet, autoFilterEnabled: true });
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer], { type: 'application/octet-stream' }), exportFileName(new Date()));
    })();
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    void gridRef.current?.instance().refresh();
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedOrder(null);
  }, []);

  return (
    <div className="orders-grid-container">
      {error !== null && (
        <div role="alert" data-testid="error-banner" className="error-banner">
          <span>{error}</span>
          <button type="button" onClick={handleRetry}>
            Retry
          </button>
        </div>
      )}
      <DataGrid<Order, number>
        ref={gridRef}
        dataSource={store}
        height="calc(100vh - 140px)"
        showBorders
        columnAutoWidth
        repaintChangesOnly
        columns={orderColumns}
        noDataText="No orders match the current filter"
        onRowClick={handleRowClick}
        onExporting={handleExporting}
      >
        <RemoteOperations filtering sorting paging />
        <Paging defaultPageSize={20} />
        <Pager visible showInfo showPageSizeSelector allowedPageSizes={[10, 20, 50]} />
        <Sorting mode="multiple" />
        <FilterRow visible />
        <LoadPanel enabled showIndicator text="Loading orders..." />
        <Export enabled />
        <Editing mode="popup" allowAdding allowUpdating allowDeleting useIcons />
        <MasterDetail enabled component={OrderItemsDetail} />
        <Toolbar>
          <Item location="before" text="Orders" />
          <Item name="addRowButton" showText="always" />
          <Item name="exportButton" />
        </Toolbar>
      </DataGrid>
      <OrderDetailDrawer order={selectedOrder} onClose={handleCloseDrawer} />
    </div>
  );
}
