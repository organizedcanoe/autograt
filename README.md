# autograt

A self-hosted personal journaling app.

Full transparency: this app was developed using Claude Code. I was curious about it's capabilities, and wanted to build something *somewhat* complex with it.

## Features

- **Daily journal:** rate the day and add Good, Bad or Neutral entries, one at a time. Once a day is over, entries/ratings become read-only.
- **Appended notes:** add a note to any entry at any time, without changing the original.
- **Heatmap and history:** see the last 30 days colored by rating, browse a month calendar or longer heatmaps, or jump to any date.
- **Insights:** see average ratings, current and longest streaks, entry counts by category, and a rating trend chart.
- **Search:** search all entries and notes.
- **Reminders:** an installable PWA with push notifications reminding you to journal.
- **Multiple users:** the first user is the admin, who approves sign-ups, manages accounts and resets passwords.
- **Your data:** export your journal as JSON (which can be imported again) or as Markdown.
- **Self-hosted:** two Docker containers and a SQLite file, with optional Cloudflare Tunnel access.

## Quick start

### Run it (Docker)

1. Copy [`docker-compose.yml`](docker-compose.yml) to your server.
2. Create a `.env` file next to it with your Cloudflare Tunnel token: `CF_TUNNEL_TOKEN=<your-token>`. Not using Cloudflare? Remove the `tunnel` service from `docker-compose.yml`.
3. Start it:

   ```sh
   docker compose pull
   docker compose up -d
   ```
4. Open the app (http://localhost:3000, or your tunnel's address) and register right away: the first account to register becomes the admin.

### Develop it

Requires the [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) and [Node.js 22](https://nodejs.org/).

```sh
cd frontend
npm install
npm run dev:all
```

Open http://localhost:5173.

## Documentation

- [Development](docs/development.md): running locally, database migrations, tests.
- [Deployment](docs/deployment.md): image tags, networking, updating, versioning.
- [Configuration](docs/configuration.md): signing keys, Web Push reminders, environment variables.
- [Backup and restore](docs/backup-restore.md): backing up and restoring `./data`, per-user export.
- [Users](docs/users.md): registration, approval and admin actions.
- [Specification](docs/spec.md): features and database schema.