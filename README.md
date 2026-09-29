# autograt

A self-hosted personal journaling app.

Full transparency: this app was developed using Claude Code. I was curious about it's capabilities, and wanted to build something *somewhat* complex with it.

See [autograt.md](autograt.md) for feature specifications and the database schema.

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 22](https://nodejs.org/)
- [Docker](https://docs.docker.com/get-docker/) (production only)
- PowerShell (optional, for `verify.ps1`)

## Local development

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

### Database

- SQLite database lives at `./data/autograt.db` (git-ignored).
- EF Core migrations are applied automatically when the backend starts.
- To change the schema, add a migration:

  ```sh
  cd backend
  dotnet ef migrations add <MigrationName> --project Autograt.Api
  ```

  Install the EF tool first if needed: `dotnet tool install --global dotnet-ef`.
- To start fresh, stop the backend and delete `./data`.

### Users

- The first user to register becomes an admin.
- Later users must be approved by an admin before they can sign in.

### JWT signing key

Generated automatically on first run and stored at `./data/jwt.key`. To supply your own, set the `Jwt__Key` environment variable.

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

`./verify.ps1` builds and tests the backend, frontend and Docker images in one go.

## Production (Docker Compose)

Every push to `main` that passes CI publishes images to GitHub Container Registry:

- `ghcr.io/oversizedcanoe/autograt-backend`
- `ghcr.io/oversizedcanoe/autograt-frontend`

`docker-compose.yml` runs those images. It does not build from source.

### Deploy

1. Copy `docker-compose.yml` to the server.
2. Create a `.env` file next to it with your Cloudflare Tunnel token:

   ```sh
   CF_TUNNEL_TOKEN=<your-token>
   ```

   Not using Cloudflare? Remove the `tunnel` service from `docker-compose.yml`.
3. Start the stack:

   ```sh
   docker compose pull
   docker compose up -d
   ```

The frontend (nginx) listens on port 3000 and proxies `/api` to the backend container.

### Update

```sh
docker compose pull
docker compose up -d
```

### Data

The `./data` folder is mounted into the backend container and holds the database and JWT key. Back it up; deleting `jwt.key` signs everyone out.
