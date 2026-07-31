---
name: react-devextreme-grid
description: Conventions for React + DevExtreme DataGrid screens (devextreme, devextreme-react, DataGrid, CustomStore, RemoteOperations, exportDataGrid). Use when creating or editing files under src/grid/**, src/api/*Store.ts, *Grid.tsx, columns.ts, or when the developer says "DevExtreme", "DataGrid", "dx-datagrid", "CustomStore", "server-side paging", "grid column", "master-detail", "export to Excel", "grid does not refresh", or "grid loads all rows". Covers version pinning, licence registration, theme import, remote operations contract, editing validation, and the five exit gates.
---

# React + DevExtreme DataGrid

## Licence — read first
DevExtreme is **commercial** (DevExpress). 30-day trial; without a registered key the app
still runs but injects a `<dx-license>` banner element into `<body>` and logs W0019/W0021.
- Key lives in `.env.local` as `VITE_DEVEXTREME_LICENSE_KEY`, never in git.
- Register once in `src/main.tsx`: `import config from 'devextreme/core/config'` then
  `config({ licenseKey })`. Never call `config()` from a component.
- Trial: https://js.devexpress.com/Download/ · Licensing: https://js.devexpress.com/Licensing/

## Version pinning (non-negotiable)
- `devextreme` and `devextreme-react` are pinned **exactly and identically** (no `^`, no `~`).
  `devextreme-react@26.1.3` declares `"devextreme": "26.1.3"` as an exact peer; a caret breaks install.
- `typescript` is pinned `~6.x`. `typescript-eslint` 8.x declares `typescript >=4.8.4 <6.1.0`;
  TypeScript 7 is npm `latest` but is **not** supported by typed linting yet.
- The **whole lint toolchain is pinned exactly**: eslint, `@eslint/js`, typescript-eslint,
  eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals. react-hooks v7's
  `flat['recommended-latest']` ships React Compiler rules at *error* level and grows that set
  within minor releases — a caret can redden the lint gate on `npm install` alone.
- Bump DevExtreme only as a pair, in its own commit, and re-run all five gates.

## Layout
```
src/api/types.ts          domain types, no UI imports
src/api/localQuery.ts     pure filter/sort/page engine over the seeded JSON (unit-tested)
src/api/ordersApi.ts      fetch wrappers + local fallback; exports buildQuery()
src/api/ordersStore.ts    CustomStore factory only — no React, no JSX
src/grid/columns.ts       column definitions only — no components
src/components/*Grid.tsx  the screen; wires store + columns + states
```
Rules:
- Column definitions never live inside a `.tsx` file. They are data, they get unit tests.
- The store factory never imports React and never renders. It takes an `onError` callback.
- `*Grid.tsx` contains no `fetch` and no filter logic.

## Typing — exact import paths
- Column config type: `import type { Column } from 'devextreme/ui/data_grid'`.
  `Column` from `devextreme-react/data-grid` is a *component*, not a type — using it as one
  fails with `TS2749: refers to a value, but is being used as a type`.
- **Event types come from `devextreme/ui/data_grid`, never from `devextreme-react/data-grid`**:
  `import type { ExportingEvent, RowClickEvent } from 'devextreme/ui/data_grid'`.
  The React package re-exports components and `DataGridRef` only; asking it for an event type
  fails with `TS2614: Module has no exported member`.
- `DataGridRef` is the one type that *does* come from `devextreme-react/data-grid`.
- Pass columns through the `columns={...}` prop. Spreading a `Column` object into a
  `<Column {...col} />` JSX child fails to type-check (`calculateFilterExpression` mismatch).
- Store types come from `devextreme/common/data`: `CustomStore`, `LoadOptions`, `LoadResult`.
- `DataGrid<TRow, TKey>`, `DataGridRef<TRow, TKey>`, `ExportingEvent<TRow, TKey>` — always
  supply both generics. No `any`, no `as any`, no `@ts-expect-error`.

## Data contract
- `<RemoteOperations filtering sorting paging />` is mandatory. The grid must never receive
  a plain array for a dataset that can grow — that silently pulls every row.
- `load` returns `{ data, totalCount }`. Returning a bare array kills the pager.
- The key is declared **once**, on the store (`key: 'id'`). Do **not** also set `keyExpr` on the
  `<DataGrid>` — with a non-array `dataSource` DevExtreme ignores it and logs `W1011` on every load.
- `cacheRawData` applies only to `loadMode: 'raw'`; passing it with `'processed'` is a no-op.
- Serialise `LoadOptions` in one exported, tested function (`buildQuery`): `skip`, `take`,
  `sort`, `filter` (JSON), `requireTotalCount`. Server side, this is what
  `DevExtreme.AspNet.Data` (`DataSourceLoader.Load`) already understands.
- `filter` is a nested array expression (`['field','op',value]`, `'and'`, `'or'`, `'!'`).
  Any local implementation must `throw` on an unknown operator, never silently return `true`.
- Every app ships a seeded local fallback so `npm run dev` works with no backend. Selection is
  by `VITE_API_BASE_URL` being empty, decided once in the api module.

## Theme
- Exactly one theme import, in `src/main.tsx`, before `./index.css`:
  `import 'devextreme/dist/css/dx.fluent.blue.light.css'`.
- Real siblings in `devextreme/dist/css/` (26.1): `dx.fluent.{blue,saas}.{light,dark}[.compact].css`;
  `dx.material.{blue,lime,orange,purple,teal}.{light,dark}.css`; and the standalone
  `dx.light`, `dx.dark`, `dx.carmine`, `dx.contrast`, `dx.softblue`, `dx.greenmist`,
  `dx.darkmoon`, `dx.darkviolet`. Anything else does not exist — do not guess a colour name.
- Never import `dx.common.css` alongside a full theme, and never import a theme in a component.

## Editing, export, states
- Editing is declarative: `<Editing mode="popup" allowAdding allowUpdating allowDeleting />`
  plus `validationRules` on the columns. No hand-rolled modal.
- Every editable column carries a `required` rule; free text also carries `stringLength`;
  numerics carry `range`. Validation lives in `columns.ts`, not in the save handler.
- Excel export: set `e.cancel = true`, then **dynamically** `import('exceljs')`,
  `import('file-saver')` and `import('devextreme/excel_exporter')` inside the handler.
  Static imports add ~930 kB to the initial chunk.
- Three states are always wired: `<LoadPanel enabled />` for loading, `noDataText` for empty,
  and a dismissible `role="alert"` banner + Retry (`gridRef.current?.instance().refresh()`)
  for errors surfaced by the store's `onError`.

## Prohibitions
- No `dataSource={arrayOfRows}` for remote data.
- No filtering, sorting or slicing in the React component.
- No licence key, connection string or API base URL committed to git.
- No `jQuery`, no `devextreme/bundles/dx.all`, no global `DevExpress` object.
- No `.only` / `.skip` left in tests; no snapshot tests of DevExtreme-rendered DOM
  (its markup changes between minor versions — assert on `.dx-data-row` counts and cell text).

## Exit gates — all five must pass before "done"
```
npm run typecheck    # tsc --noEmit, strict. Needs "vitest/globals" in tsconfig `types`
                     # whenever vitest runs with globals:true, or describe/it/expect are TS2593.
npm run lint         # eslint . --max-warnings 0  (bare `eslint .` exits 0 on warnings — not a gate)
npm test             # vitest run
npm run test:e2e     # playwright test (pretest:e2e builds; webServer previews)
npm run check:clean  # node script: fails on TODO / as any / @ts-expect-error / eslint-disable
```
A change that leaves any gate red is not finished. If DevExtreme forces a lint suppression,
scope it to the single line with a comment naming the DevExtreme type at fault.
Never gate on `findstr` — it exits 1 when it finds nothing, so "no matches" reads as failure.
