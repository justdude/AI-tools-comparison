# Orders Grid

A React 19 + TypeScript + Vite single-page app whose main view is a DevExtreme DataGrid over an
Orders dataset.

## Licence

DevExtreme is a commercial product from DevExpress. There is no free tier. The app runs and can be
fully built, tested and used with **no licence key at all** — without one it injects a
`<dx-license>` banner element into `<body>` and logs `W0019`/`W0021` in the console. Get a free
30-day trial key at <https://js.devexpress.com/Download/> and put it in `.env.local` as
`VITE_DEVEXTREME_LICENSE_KEY=...` (git-ignored — never commit a key). Licensing FAQ:
<https://js.devexpress.com/Licensing/>.

## Getting started

```
npm install
npm run seed
npm run dev
```

Open <http://localhost:5173>. With no `VITE_API_BASE_URL` set, the grid runs entirely against a
deterministic, seeded dataset of 500 orders held in memory — no backend required.

## Gates

```
npm run typecheck     # tsc --noEmit
npm run lint          # eslint . --max-warnings 0
npm test              # vitest run
npm run build         # production build
npm run test:e2e      # playwright test (builds and previews automatically)
npm run check:clean   # fails on TODO / as any / @ts-expect-error / eslint-disable / etc.
```

## REST contract

Set `VITE_API_BASE_URL` (in `.env.local`) to point the grid at a real backend instead of the local
seed. The grid issues:

```
GET  /api/orders?skip=&take=&sort=&filter=&requireTotalCount=   -> { data: Order[], totalCount: number }
GET  /api/orders/:id                                            -> Order
POST /api/orders                                                -> Order
PUT  /api/orders/:id                                             -> Order
DELETE /api/orders/:id
```

`sort` and `filter` are JSON-encoded DevExtreme load-option expressions. This is exactly what
`DevExtreme.AspNet.Data` (NuGet, `DataSourceLoader.Load`) produces from an ASP.NET Core minimal API
or controller — no backend is built or included in this repository.
