# autograt

A self-hosted personal journaling app.

Full transparency: this app was developed using Claude Code. I was curious about it's capabilities, and wanted to build something *somewhat* complex with it.

See [autograt.md](autograt.md) for feature specifications and the database schema.

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 22](https://nodejs.org/)
- [Docker](https://docs.docker.com/get-docker/) (production only)
- PowerShell (optional, for `scripts/verify.ps1`)
- Python 3.11+ (optional, for `scripts/lorem.py`)

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
- To fill an existing user's journal with random test data:

  ```sh
  python scripts/lorem.py <username> <days> [--db path/to/autograt.db]
  ```

  Adds entries for each of the last `<days>` days, skipping days that already have one. Defaults to `./data/autograt.db`.

### Users

- The first user to register becomes an admin.
- Later users must be approved by an admin before they can sign in. To stop new sign-ups altogether, turn off **Admin → Open registration**.
- Admins can promote, demote, disable or delete users on the **Admin** page. Changes apply straight away, without the user logging in again.
- Users change their username or password, or delete their account, under **Settings → Account**.
- There is no email, so a forgotten password is reset by an admin (**Admin → Reset password**). The admin passes the temporary password on, and the user chooses a new one when they log in.

### JWT signing key

Generated automatically on first run and stored at `./data/jwt.key`. To supply your own, set the `Jwt__Key` environment variable.

### Reminder notifications (Web Push)

The app is an installable PWA that can send reminders to write entries (turned on per device on the Settings page).

- **HTTPS is required** to install the app and receive push notifications. `localhost` counts as secure, so `npm run dev` works; in production the Cloudflare Tunnel provides HTTPS.
- **VAPID keys** sign push messages. They are generated automatically on first run and stored at `./data/vapid.json`. To supply your own, set both `Push__VapidPublicKey` and `Push__VapidPrivateKey` (setting only one stops the backend from starting). Set `Push__Subject` to a `mailto:` address or your site's URL so push services can contact you (default `mailto:admin@localhost`).
- **iPhone/iPad** (iOS 16.4 or later) only receive notifications once the app is added to the Home Screen (Share → Add to Home Screen) and opened from there.

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

## Production (Docker Compose)

Every push to `main` that passes CI publishes images to GitHub Container Registry:

- `ghcr.io/oversizedcanoe/autograt-backend`
- `ghcr.io/oversizedcanoe/autograt-frontend`

Each image is versioned `MAJOR.MINOR.<CI run number>`, where `MAJOR.MINOR` comes from the [`VERSION`](VERSION) file. Every publish pushes these tags:

| Tag | Points to |
|---|---|
| `0.1.57` | That exact build; never moves |
| `0.1` | Newest `0.1.x` build (fixes only) |
| `0` | Newest `0.x.x` build (fixes and features) |
| `latest` | Newest build |
| Commit SHA | Build of that commit; never moves |

Pick the tag in `docker-compose.yml` for how much change you want on each `docker compose pull`. Use the same tag for both images.

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
4. Open the app and register right away: the first account to register becomes the admin.

The frontend (nginx) proxies `/api` to the backend container and has two listeners:

- **Port 80, for the Cloudflare Tunnel.** It isn't published, so only cloudflared reaches it over the Docker network. Point the tunnel at `http://frontend:80`. It trusts Cloudflare's `CF-Connecting-IP` header for the client's IP, which the login rate limit uses.
- **Port 8080, published as port 3000, for direct local or LAN access.** It ignores `CF-Connecting-IP`. If you only use the tunnel, you can remove `ports:` from the `frontend` service to close port 3000.

The backend logs sign-ins, failed logins, account changes, admin actions and rate-limited requests. View them with `docker logs autograt-backend`. Each container keeps at most 50 MB of logs.

### Update

The footer of every page shows the running version, commit and build date (`GET /api/version` returns the backend's). Compare the commit with the latest on `main`, then update:

```sh
docker compose pull
docker compose up -d
```

If the footer warns that the backend is on a different build, one container is stale; pulling and restarting fixes it.

### Versioning

Bug fixes and very small features just merge to `main`; the run number goes up on its own. For a feature or anything risky, bump the minor number in `VERSION` (e.g. `0.1` → `0.2`) in that PR. For a big or breaking change, bump the major number (e.g. `0.2` → `1.0`). The run number never resets, so versions go `0.1.57` → `0.2.58`.

Database migrations only go forward, so moving back to an older version after a newer one has migrated the database can fail. Any schema change should bump at least the minor number.

### Data

The `./data` folder is mounted into the backend container and holds the database, JWT key and VAPID keys. Back it up; deleting `jwt.key` signs everyone out, and deleting `vapid.json` stops reminders until each user turns them off and on again on every device.

Each user can also export their own journal from the Settings page (**Your data**): JSON, which can be imported again (for example to move to a new server), or Markdown for reading. Importing a JSON export replaces the user's days on the dates it contains and keeps the rest.
