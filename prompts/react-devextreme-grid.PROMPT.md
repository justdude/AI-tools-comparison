# Build an Orders screen: a production React SPA whose main view is a DevExtreme DataGrid

## ⚠️ Licence — read before you start

**DevExtreme is a commercial product from DevExpress.** There is no free tier.

- **Trial:** 30 days, full functionality, no card. Get it at https://js.devexpress.com/Download/
- **Without a key the app still builds and runs**, but it injects a `<dx-license>` banner element
  into `<body>` and logs `W0019` / `W0021` in the console. Nothing here is blocked by the missing
  key — you can complete and verify this entire task with no licence at all.
- With a key: put it in `.env.local` as `VITE_DEVEXTREME_LICENSE_KEY=...` (git-ignored).
  Licensing FAQ: https://js.devexpress.com/Licensing/
- The npm packages install from the public registry without authentication.

Everything else in this stack is MIT/free.

## Context

- **Stack:** React 19 + TypeScript + Vite (SPA — no Next.js, there is no SSR requirement and
  DevExtreme is a client-only widget suite).
- **Target folder:** create `orders-grid/` in the current directory. There is no existing repo;
  create the whole tree yourself. No `git init` is required and no acceptance check needs git.
- **OS:** Windows. Every command below must run in PowerShell or cmd. Use npm scripts only —
  no `&&` chaining, no bash-isms, no `NODE_ENV=x` prefixes, no `findstr` as a pass/fail gate
  (it exits 1 when it finds nothing).
- **Node:** **22.13+ or 20.19+ (or 24+)**. eslint 10 is the strictest floor here
  (`^20.19.0 || ^22.13.0 || >=24`), not Vite. Check with `node -v` before starting.
- **Versions are pinned deliberately. Do not "upgrade" them.** Three pins are load-bearing:
  1. `devextreme-react@26.1.3` peer-requires `devextreme` at the **exact** string `26.1.3`.
  2. `typescript-eslint` 8.x supports `typescript >=4.8.4 <6.1.0`, so TypeScript 7 (current npm
     `latest`) breaks typed linting. Stay on `~6.0.3`.
  3. The **entire lint toolchain is pinned exactly, with no caret**. `eslint-plugin-react-hooks` 7
     ships React Compiler rules at *error* level in `flat['recommended-latest']` and adds to that
     set in minor releases; the same is true of `typescript-eslint`'s `recommendedTypeChecked`.
     A caret there can turn the lint gate red on a plain `npm install`.

## Scaffold

Create this tree:

```
orders-grid/
├─ .env.example
├─ .gitignore
├─ README.md
├─ eslint.config.js
├─ index.html
├─ package.json
├─ playwright.config.ts
├─ tsconfig.json
├─ vite.config.ts
├─ vitest.config.ts
├─ scripts/
│  ├─ generate-seed.mjs
│  └─ check-clean.mjs
├─ e2e/
│  └─ orders-grid.spec.ts
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ index.css
   ├─ devextreme-license.ts
   ├─ vite-env.d.ts
   ├─ api/
   │  ├─ types.ts
   │  ├─ localQuery.ts
   │  ├─ localQuery.test.ts
   │  ├─ ordersApi.ts
   │  ├─ ordersApi.test.ts
   │  └─ ordersStore.ts
   ├─ components/
   │  ├─ OrdersGrid.tsx
   │  ├─ OrderItemsDetail.tsx
   │  ├─ OrderDetailDrawer.tsx
   │  └─ OrderDetailDrawer.test.tsx
   ├─ data/
   │  └─ orders.seed.json      (generated — do not hand-write)
   ├─ grid/
   │  ├─ columns.ts
   │  └─ columns.test.ts
   └─ test/
      └─ setup.ts
```

Bootstrap (do **not** use `npm create vite` — write `package.json` yourself so the pins hold):

```
mkdir orders-grid
cd orders-grid
```

`package.json` — use exactly this:

```json
{
  "name": "orders-grid",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": "^20.19.0 || ^22.13.0 || >=24.0.0" },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --config vitest.config.ts",
    "test:watch": "vitest --config vitest.config.ts",
    "pretest:e2e": "vite build",
    "test:e2e": "playwright test",
    "seed": "node scripts/generate-seed.mjs",
    "seed:check": "node scripts/generate-seed.mjs --check",
    "check:clean": "node scripts/check-clean.mjs"
  },
  "dependencies": {
    "devextreme": "26.1.3",
    "devextreme-react": "26.1.3",
    "exceljs": "^4.4.0",
    "file-saver": "^2.0.5",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@playwright/test": "^1.62.0",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^7.0.0",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/file-saver": "^2.0.7",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.4",
    "eslint": "10.8.0",
    "eslint-plugin-react-hooks": "7.1.1",
    "eslint-plugin-react-refresh": "0.5.3",
    "globals": "17.8.0",
    "jsdom": "^30.0.0",
    "typescript": "~6.0.3",
    "typescript-eslint": "8.65.0",
    "vite": "^8.1.5",
    "vitest": "^4.1.10"
  }
}
```

Then:

```
npm install
npm run seed
npx playwright install chromium
```

`.gitignore`: `node_modules`, `dist`, `.env.local`, `coverage`, `playwright-report`, `test-results`.
`.env.example`: `VITE_API_BASE_URL=` and `VITE_DEVEXTREME_LICENSE_KEY=`.

## Requirements

### 1. Config files — use these verbatim

`tsconfig.json` — note `"vitest/globals"`. Vitest runs with `globals: true`, and because `types`
is set explicitly, omitting it makes `tsc` fail with `TS2593: Cannot find name 'describe'`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "e2e", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
```

`vitest.config.ts` — keep it a separate file so the preview/server config stays out of the test
run and `mergeConfig` can layer test-only options on top:
```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      css: false,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
);
```
`src/test/setup.ts` is one line: `import '@testing-library/jest-dom/vitest';`

`eslint.config.js` — ESLint 10 flat config with **type-checked** rules. Note two traps:
`eslint-plugin-react-hooks` v7 exposes *two* configs under the same name — the top-level
`.configs['recommended-latest']` is eslintrc-style (`plugins` is an **array**) and throws
`plugins must be an object`; you must use `.configs.flat['recommended-latest']`. And typed
rules must be scoped to `.ts/.tsx` or ESLint fails parsing its own config file:
```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked, reactHooks.configs.flat['recommended-latest']],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
);
```
Because `lint` runs with `--max-warnings 0`, every `warn`-level rule above (plus react-hooks'
`exhaustive-deps` and `incompatible-library`) is genuinely gating. Fix them, do not suppress them.

`playwright.config.ts`: `testDir: './e2e'`, `use.baseURL: 'http://localhost:4173'`, one chromium
project, and `webServer: { command: 'npm run preview', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 120_000 }`.
The build happens via the `pretest:e2e` npm lifecycle script — do not chain with `&&`.

### 2. Seed data — `scripts/generate-seed.mjs`

Write a deterministic generator (fixed-seed LCG, **no** `Math.random`) that emits
`src/data/orders.seed.json`: exactly **500** orders, ids `1..500`, `orderNumber` = `ORD-10001..ORD-10500`,
plus `customer` (10 company names), `country` (8), `status` (`New|Processing|Shipped|Delivered|Cancelled`),
`orderDate` (`yyyy-MM-dd` across 2025–2026), `amount` (2-dp, derived from items), and `items[]` of
1–4 unique `{ sku, product, quantity, unitPrice }`.

It must support two modes, so determinism is gated without git:
- default: write the file, then print `Wrote 500 orders sha256=<hex>`.
- `--check`: regenerate in memory, compare its SHA-256 against the bytes already on disk, print
  `Seed is deterministic sha256=<hex>` and `process.exit(0)` on a match, or print both hashes and
  `process.exit(1)` on any drift.

### 3. Typed data layer

`src/api/types.ts` — `Order`, `OrderItem`, `OrderStatus`, `ORDER_STATUSES`, `PagedResult<T>`.
No UI imports.

`src/api/localQuery.ts` — a **pure**, framework-free query engine over an array:
- `matchesFilter(row, filter)` implementing DevExtreme filter expressions: binary
  `[field, op, value]` for `= <> > >= < <= contains notcontains startswith endswith`
  (string ops case-insensitive), `and`/`or` groups, `!` negation, and `undefined` → `true`.
  Unknown operator ⇒ `throw new Error(\`Unsupported filter operator: ${op}\`)`.
- `queryLocal<T extends object>(rows, options: LoadOptions<T>): PagedResult<T>` — filter, then
  sort (array of `{ selector, desc }` or string, multi-key), then `skip`/`take`. `totalCount`
  is the count **before** paging.
- Stringify via a helper that handles `null`/`Date`/objects; do not call `String(x)` on `unknown`
  (`@typescript-eslint/no-base-to-string` will fail the lint gate).

`src/api/ordersApi.ts`:
- `export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''` and `USE_LOCAL = API_BASE === ''`.
- `export const buildQuery = (options: LoadOptions<Order>): string` → `URLSearchParams` with
  `skip`, `take`, `sort` (JSON), `filter` (JSON), `requireTotalCount`; omit absent keys.
- `loadOrders`, `getOrder`, `createOrder`, `updateOrder`, `deleteOrder`. When `USE_LOCAL`, operate
  on an in-memory clone of the seed (with a ~120 ms delay in `loadOrders` so the load panel is real)
  and expose `resetLocalRows()` for tests. Otherwise `fetch` `/api/orders`, `/api/orders/:id`
  (GET/POST/PUT/DELETE) with `Content-Type: application/json`, throwing
  `Request failed: <status> <statusText>` on a non-OK response.
- Every `async` function must contain an `await`, or `@typescript-eslint/require-await` fails lint.

`src/api/ordersStore.ts` — the only DevExtreme-aware file in `api/`. The key is declared **here
only**; do not repeat it as `keyExpr` on the grid. `cacheRawData` is omitted deliberately — it
applies only to `loadMode: 'raw'`:
```ts
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
```

### 4. Columns — `src/grid/columns.ts`, no JSX in this file

- `import type { Column } from 'devextreme/ui/data_grid';` — **not** from `devextreme-react/data-grid`
  (that export is a React component; using it as a type fails with TS2749).
- `export const orderColumns: Column<Order, number>[]` in this order: `orderNumber` (string, 130px,
  `allowEditing: false`, `sortOrder: 'asc'`), `customer` (minWidth 180), `country` (120),
  `status` (`lookup.dataSource` from an exported `ORDER_STATUSES` tuple — spread it with
  `[...ORDER_STATUSES]` so the readonly tuple is accepted), `orderDate`
  (`dataType: 'date'`, `format: 'yyyy-MM-dd'`), `amount` (`format: { type: 'currency', precision: 2 }`).
- Every column gets `validationRules` containing `{ type: 'required' }`; `customer` also gets
  `stringLength` 2–80; `amount` also gets `range` 0–1 000 000. Messages are human-readable.
- Also export `exportFileName(date: Date): string` → `orders-YYYY-MM-DD.xlsx`.

### 5. The grid — `src/components/OrdersGrid.tsx`

**Import paths matter here.** Only `DataGridRef` comes from the React package; every *event* type
comes from core, and asking `devextreme-react/data-grid` for one fails with
`TS2614: Module has no exported member 'ExportingEvent'`:
```tsx
import DataGrid, {
  Editing, Export, FilterRow, Item, LoadPanel, MasterDetail,
  Pager, Paging, RemoteOperations, Sorting, Toolbar,
} from 'devextreme-react/data-grid';
import type { DataGridRef } from 'devextreme-react/data-grid';
import type { ExportingEvent, RowClickEvent } from 'devextreme/ui/data_grid';
```

Render `<DataGrid<Order, number>>` with `dataSource={store}` (from `useMemo`),
`height="calc(100vh - 140px)"`, `showBorders`, `columnAutoWidth`, `repaintChangesOnly`,
`columns={orderColumns}`, and `noDataText="No orders match the current filter"`.

Do **not** pass `keyExpr` — the CustomStore already declares `key: 'id'`, and with a non-array
`dataSource` DevExtreme ignores `keyExpr` and logs `W1011` in the console on every load.

Do **not** map columns into `<Column {...col} />` children — spreading the config type into the JSX
component does not type-check. Use the `columns` prop.

Children: `<RemoteOperations filtering sorting paging />`, `<Paging defaultPageSize={20} />`,
`<Pager visible showInfo showPageSizeSelector allowedPageSizes={[10, 20, 50]} />`,
`<Sorting mode="multiple" />`, `<FilterRow visible />`,
`<LoadPanel enabled showIndicator text="Loading orders..." />`, `<Export enabled />`,
`<Editing mode="popup" allowAdding allowUpdating allowDeleting useIcons />`,
`<MasterDetail enabled component={OrderItemsDetail} />`, and a `<Toolbar>` with an `<Item location="before">`
title plus `<Item name="addRowButton" showText="always" />` and `<Item name="exportButton" />`.

Excel export — lazy-load the heavy deps so they stay out of the initial chunk:
```tsx
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
```

States:
- **Loading** — the DevExtreme load panel above.
- **Empty** — `noDataText`.
- **Error** — `createOrdersStore(setError)`; when `error !== null` render a
  `role="alert"` banner with `data-testid="error-banner"` and a Retry button calling
  `gridRef.current?.instance().refresh()` (`gridRef` is `useRef<DataGridRef<Order, number>>(null)`).
  Wrap the call so the returned promise is not floated: `() => { void gridRef.current?.instance().refresh(); }`.

Detail views — build **both**: `OrderItemsDetail` (master-detail row: a `<table>` of line items,
`data-testid="master-detail"`, props typed `{ data: { data: Order } }`) and `OrderDetailDrawer`
(right-hand fixed panel with `data-testid="order-drawer"`, opened by `onRowClick`
(`(e: RowClickEvent<Order, number>) => { if (e.rowType === 'data') ... }`), closed by a
"Close details" aria-labelled button, returns `null` when no row is selected).

### 6. Entry point, theme and licence — `src/main.tsx`

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import config from 'devextreme/core/config';
import 'devextreme/dist/css/dx.fluent.blue.light.css';
import './index.css';
import { licenseKey } from './devextreme-license';
import { App } from './App';

if (licenseKey !== '') {
  config({ licenseKey });
}

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```
`src/devextreme-license.ts` is one line reading `import.meta.env.VITE_DEVEXTREME_LICENSE_KEY ?? ''`.
Declare both env vars in `src/vite-env.d.ts` via `interface ImportMetaEnv`.
`App.tsx` renders `<OrdersGrid />` plus an info banner (`data-testid="local-mode-banner"`) when
`USE_LOCAL`, saying the seeded dataset is in use and `VITE_API_BASE_URL` switches to the REST backend.
`index.css` styles the banners, the drawer and the master-detail table — plain CSS, no UI framework.

### 7. Tests

Unit (Vitest + Testing Library), at least 15 assertions across four files:
- `localQuery.test.ts` — equality, case-insensitive `contains`/`startswith`, `and`/`or` groups,
  `!`, empty filter, `throw` on unknown operator; `skip`/`take` with unpaged `totalCount`;
  descending sort; filter-before-page.
- `ordersApi.test.ts` — `buildQuery` round-trips `skip`/`take`/`sort`/`filter`/`requireTotalCount`
  and returns `''` for `{}`; local fallback returns 20 rows with `totalCount` 500; insert→update→delete
  leaves the total back at 500 (call `resetLocalRows()` first).
- `columns.test.ts` — field order is exactly
  `['orderNumber','customer','country','status','orderDate','amount']` with no duplicates; every
  column has a `required` rule; the status lookup matches `ORDER_STATUSES`; amount is currency;
  `exportFileName(new Date('2026-07-27T10:00:00Z')) === 'orders-2026-07-27.xlsx'`.
- `OrderDetailDrawer.test.tsx` — renders nothing for `order={null}`; shows the order number and
  customer; `userEvent.click` on "Close details" calls `onClose` once.

E2E — `e2e/orders-grid.spec.ts`, two tests:
1. `page.goto('/')`, `.dx-datagrid` visible, `.dx-datagrid-rowsview .dx-data-row` count `>= 10`,
   text `ORD-10001` visible, `.dx-datagrid-pager` contains `500`.
2. Clicking the first data row makes `getByTestId('order-drawer')` visible.

Assert on `.dx-data-row` counts and cell text — never snapshot DevExtreme's DOM. The unlicensed
build appends a `<dx-license>` element to `<body>`; it does not intercept row clicks, so no
special handling is needed, but do not assert on `body > *` counts.

### 8. `scripts/check-clean.mjs`

A Node script (no dependencies) that recursively walks `src/` and `e2e/`, reads every
`.ts`/`.tsx`/`.css` file, and reports any line matching: `\bTODO\b`, `\bFIXME\b`, `\bas any\b`,
`:\s*any\b`, `@ts-expect-error`, `@ts-ignore`, `eslint-disable`, `\.only\(`, `\.skip\(`.
Print `file:line  <token>` for each hit. `process.exit(1)` if there is at least one hit, otherwise
print `check:clean OK — 0 findings` and `process.exit(0)`. Use precise patterns, not a bare
substring search for `any` (the seed data contains "company" and "Germany").

### 9. README.md

Half a page: the licence position first, `npm install` / `npm run seed` / `npm run dev`, the five
gate commands, and the REST contract the backend must satisfy —
`GET /api/orders?skip&take&sort&filter&requireTotalCount` returning `{ data, totalCount }`,
which is exactly what `DevExtreme.AspNet.Data` (NuGet, `DataSourceLoader.Load`) produces on an
ASP.NET Core minimal API or controller.

## Acceptance criteria

Run each from `orders-grid/`. **Every one is a command that must exit 0**, in this order:

1. `npm install` — exit 0 with **no** `ERESOLVE` peer error.
   `npm ls devextreme devextreme-react` prints `26.1.3` for both;
   `npm ls typescript` prints `6.0.x`; `npm ls eslint` prints `10.8.0`.
2. `npm run seed` — exit 0, prints `Wrote 500 orders sha256=<hex>`.
   Then `npm run seed:check` — exit 0, prints the same hex. (No git required.)
3. `npm run typecheck` — exit 0, zero diagnostics.
4. `npm run lint` — exit 0. The script is `eslint . --max-warnings 0`, so this is zero errors
   **and** zero warnings, enforced by the exit code.
5. `npm test` — exit 0, **4 test files passed**, **≥ 15 tests passed**, 0 skipped.
6. `npm run build` — exit 0. `dist/assets/` contains a separate `exceljs.min-*.js` chunk and a
   separate `excel_exporter-*.js` chunk (proving the dynamic imports), and the main `index-*.js`
   chunk is **under 3 MB** uncompressed (reference build: 2.41 MB).
7. `npm run test:e2e` — exit 0, **2 passed**.
8. `npm run check:clean` — exit 0, prints `check:clean OK — 0 findings`.
9. `npm run dev`, open http://localhost:5173 with **no backend running**: the grid paints
   **20** `.dx-data-row` elements, the pager reads `Page 1 of 25 (500 items)`, the filter row
   filters, clicking a column header sorts, the expand arrow opens line items, clicking a row
   opens the drawer, the toolbar Add button opens a popup whose Save is blocked until required
   fields are filled, and Export downloads `orders-YYYY-MM-DD.xlsx` that opens in Excel.
   The console shows only the DevExtreme trial warnings `W0019`/`W0021` (expected without a
   licence key) — **no `W1011`, no React warnings, no uncaught errors**.

## Out of scope

Do not build these — the task is finished without them:
- The ASP.NET Core backend, EF Core, a database, or Docker. Document the REST contract only.
- Authentication, authorisation, routing (single screen), i18n, dark-mode toggle, theme switcher.
- Any second DevExtreme widget (Chart, Scheduler, PivotGrid, Form-as-a-page).
- State libraries (Redux, Zustand, TanStack Query), a component library, Tailwind, CSS-in-JS.
- Storybook, code coverage thresholds, CI pipeline files, Dockerfiles, `git init`.
- Custom DevExtreme themes built with the theme builder — the stock Fluent theme is the answer.
- Virtual/infinite scrolling, grouping, summaries, column chooser, state persistence.
