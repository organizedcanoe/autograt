# autograt

A self-hosted personal journaling app.

Full transparency: this app was developed using Claude Code. I was curious about it's capabilities, and wanted to build something *somewhat* complex with it.

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
