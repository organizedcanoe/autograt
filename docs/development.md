# Development

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 22](https://nodejs.org/)
- [Docker](https://docs.docker.com/get-docker/) (production only)
- PowerShell (optional, for `scripts/verify.ps1`)
- Python 3.11+ (optional, for `scripts/lorem.py`)

## Running locally

Install frontend dependencies once:

```sh
cd frontend
npm install
```

Start the backend and frontend together:

```sh
cd frontend
npm run dev:all
```

Or run them separately:

```sh
# Backend on http://localhost:5000
cd backend
dotnet run --project Autograt.Api

# Frontend on http://localhost:5173
cd frontend
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` requests to the backend on port 5000.
Swagger UI is available at http://localhost:5000/swagger in Development.

## Database

- SQLite database lives at `./data/autograt.db` (git-ignored).
- EF Core migrations are applied automatically when the backend starts.
- To change the schema, add a migration:

  ```sh
  cd backend
  dotnet ef migrations add <MigrationName> --project Autograt.Api
  ```

  Install the EF tool first if needed: `dotnet tool install --global dotnet-ef`.
- To start fresh, stop the backend and delete `./data`.
- To fill an existing user's journal with random test data:

  ```sh
  python scripts/lorem.py <username> <days> [--db path/to/autograt.db]
  ```

  Adds entries for each of the last `<days>` days, skipping days that already have one. Defaults to `./data/autograt.db`.

## Tests

```sh
# Backend (xUnit)
cd backend
dotnet test

# Frontend (Vitest)
cd frontend
npm run test

# End-to-end (Playwright; starts its own backend and frontend)
cd frontend
npx playwright install chromium   # first run only
# any of the following:
npm run test:e2e                  # runs headless and prints results to the terminal (as CI does)
npx playwright test --headed      # runs in a visible browser window so you can watch each step
npx playwright test --ui          # opens Playwright's UI to step through each action with DOM snapshots
```

`./scripts/verify.ps1` builds and tests the backend, frontend and Docker images in one go.

See the [specification](spec.md#7-testing-strategy-specification) for what each test suite must cover.
