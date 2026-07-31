---
name: angular-devextreme-grid
description: Conventions for Angular 22 + DevExtreme (devextreme / devextreme-angular 26.1.x) DataGrid screens backed by an ASP.NET Core 10 + EF Core API using DevExtreme.AspNet.Data. Use when touching dx-data-grid, DxDataGridModule, CustomStore, LoadOptions, DataSourceLoadOptions, *-columns.ts, angular.json dx theme styles, exportDataGrid / devextreme-exceljs-fork, or when a developer says "add a column", "grid is loading everything", "server-side paging", "excel export", "grid editing validation", "DevExtreme licence key", "dx theme", "grid shows no data", or "zoneless grid".
---

# Angular + DevExtreme DataGrid conventions

## Non-negotiable versions (verified 28 Jul 2026)
- Angular **22.0.8**. Angular CLI 22 requires Node **^22.22.3 || ^24.15.0 || >=26.0.0** — Node 20 and
  even Node 22.22.2 are rejected by the CLI at startup. Check `node --version` first, always.
- TypeScript **~6.0.x** (`@angular/build` peer is `>=6.0 <6.1`; `typescript@latest` is 7.0.2 and will
  NOT compile). Never run `npm i -D typescript@latest`.
- `devextreme` and `devextreme-angular` must be the **same exact version**, pinned, no caret (`26.1.3`).
- Excel export uses **`devextreme-exceljs-fork`** (MIT, published by DevExpress). DevExtreme 26.x
  documents "ExcelJS v4.4.1+"; upstream `exceljs` is stuck at 4.4.0, so upstream cannot satisfy it.
- New Angular projects are standalone + Vitest by default. **Zoneless is opt-in** — pass
  `--zoneless=true` to `ng new`. Do not reintroduce NgModules, zone.js or Karma.

## Licence (commercial — say this before anyone writes code)
DevExtreme requires a per-developer paid DevExpress licence; 30-day trial otherwise
(https://js.devexpress.com/Download/). Without a key the widgets still run but show an
"unlicensed version" banner.
- Never hand-write a key. Run `devextreme-license --out src/.devextreme/license-key.ts --force`
  as a `prebuild` / `prestart` / `pretest` script (the binary ships inside the `devextreme` package).
- It reads `%APPDATA%\DevExpress\DevExpress_License.txt` or `$env:DevExpress_License`; with none it
  writes `export const licenseKey = 'TRIAL';` and exits 0. It also appends the path to `.gitignore`.
- Call `config({ licenseKey })` in `main.ts` **before** `bootstrapApplication`.

## Import paths that are actually typed in 26.1.x
```ts
import config from 'devextreme/core/config';                    // OK - typed
// import config from 'devextreme/common/config';               // NO .d.ts -> TS7016, build fails
import { CustomStore, DataSource } from 'devextreme/common/data';
import type { LoadOptions } from 'devextreme/common/data';
import { exportDataGrid } from 'devextreme/common/export/excel';
import type { Column } from 'devextreme/ui/data_grid';
import { DxDataGridModule, DxDataGridTypes } from 'devextreme-angular/ui/data-grid';
import { DxButtonModule } from 'devextreme-angular/ui/button';
```
`devextreme/common/config` ships JS but no declaration file — importing it fails `ng build`
(TS 6 has `noImplicitAny` on by default). Use `devextreme/core/config` or `devextreme/common`.
Grid event types are `DxDataGridTypes.*` (e.g. `DxDataGridTypes.ExportingEvent`), never `DataGridTypes.*`.

## Architecture
```
src/app/products/
  product.model.ts      types + DTOs only, no devextreme imports
  product-columns.ts    export PRODUCT_COLUMNS: Column<Product>[]  <- column config lives ONLY here
  product-query.ts      PURE: LoadOptions -> query params, and applyLoadOptions(seed, opts)
  product-api.ts        Injectable, HttpClient, typed, no devextreme imports
  product-store.ts      builds the CustomStore; delegates to product-api / product-query
  product-grid.ts       the screen: signals + <dx-data-grid [columns]="columns">
```
- **Columns are data, not template.** Never write `<dxi-column>` for the main grid; bind
  `[columns]="PRODUCT_COLUMNS"`. Validation rules, formats, lookups, `calculateDisplayValue` live there.
- Import `DxDataGridModule` into the standalone component's `imports:`. The component itself is
  standalone in 26.x, but the module also brings the nested `dxo-*` / `dxi-*` config directives.

## Zoneless (read before blaming DevExtreme)
devextreme-angular 26.1.3 is compiled against Angular 20.3 and declares peer `@angular/core >=20.0.0`,
so Angular 22 installs cleanly — but **DevExpress publishes no Angular 22 support statement**. In the
shipped bundle `DxTemplateDirective.render()` calls `childView.detectChanges()` itself and every NgZone
use is `zone.run` / `runOutsideAngular` / `isStable`, all of which are no-ops (not failures) under
`NoopNgZone`. Consequence: **app state must be signals**. A DevExtreme output handler that writes a
plain field will not repaint. If a template genuinely renders stale, the escape hatch is regenerating
the workspace with `--zoneless=false` — never sprinkle `ChangeDetectorRef` through app code.

## Prohibitions
- **Never** `ng add devextreme-angular`. Its schematics pull `@angular-devkit/schematics ~20.3.x` and
  rewrite `angular.json`. Wire themes and imports by hand. Run `ng add angular-eslint` **before**
  installing devextreme so the eslint schematic resolves a v22 devkit.
- **Never** load a full dataset client-side. `remoteOperations` on, `CustomStore` returning
  `{ data, totalCount }`. A grid paging request with no `skip`/`take` is a bug.
- **Never** render a DevExtreme widget in a jsdom spec. Test `product-query.ts`, `product-api.ts`,
  `product-columns.ts`; the grid component is covered by the build only.
- **Never** call `detectChanges()` or inject `NgZone` in app code.
- **Never** widen the API contract per-screen. The server speaks the `DevExtreme.AspNet.Data` protocol
  (`skip/take/sort/filter/requireTotalCount` -> `{ data, totalCount }`) and nothing else.

## Server side (ASP.NET Core 10 + EF Core 10)
- `DevExtreme.AspNet.Data` 5.1.0 (MIT) does the translation. Bind via a minimal-API
  `static ValueTask<T?> BindAsync(HttpContext)` that calls `DataSourceLoadOptionsParser.Parse`.
- Always `DataSourceLoader.LoadAsync(query.AsNoTracking(), options, ct)` — never `.ToListAsync()` first.
- Clamp `Take` server-side: `Take <= 0 || Take > 500 -> 500`. Do **not** clamp an absent `take` down to a
  page size — grid Excel export loads with no `take`, and a small clamp silently truncates the file.
- Keep an `api/*.slnx` solution. `dotnet build` / `dotnet test` in a folder that holds only project
  *subfolders* fails with MSB1003.
- `dotnet new xunit3` is **not** in the .NET 10 SDK. Run
  `dotnet new install xunit.v3.templates::3.2.2` first. xunit v3 projects need `<OutputType>Exe</OutputType>`.
- SQLite test DBs: call `SqliteConnection.ClearAllPools()` before `File.Delete` or Windows keeps the handle.

## Build config that must stay correct
- Generated `angular.json` uses `projects.web.targets` (older docs call it `architect`).
- Theme goes in `targets.build.options.styles`, not `styles.css`:
  `"node_modules/devextreme/dist/css/dx.fluent.saas.light.css"`. Icon fonts under `dist/css/icons/`
  are emitted automatically — do not add them to `assets`.
- `"allowedCommonJsDependencies": ["devextreme-exceljs-fork", "file-saver"]`.
- Raise `configurations.production.budgets`: the theme alone is ~800 kB, so the default 1 MB initial
  **error** budget fails `ng build`. Use 4 MB warning / 8 MB error.
- `src/test-setup.ts` must be added to `tsconfig.spec.json` `include` — the generated include is only
  `src/**/*.spec.ts` and `src/**/*.d.ts`.
- Dev server reaches the API through `proxy.conf.json` (`/api` -> `http://localhost:5225`). No CORS.
  A dead API behind that proxy surfaces as HTTP **500/504**, not status 0 — offline detection must
  treat `status === 0 || status >= 500` as "API unreachable".

## Exit criteria for any change here (PowerShell; `&&` is invalid in Windows PowerShell 5.1)
```powershell
Set-Location <repo>\web ; npm run lint ; npm run build ; npm test -- --no-watch
Set-Location <repo>\api ; dotnet build -warnaserror ; dotnet test
```
All four must exit 0. `lint` must be defined as `ng lint --max-warnings 0` — plain `ng lint` exits 0
with warnings and gates nothing. Coverage thresholds on `product-query.ts` / `product-api.ts` are a
gate, not a report.