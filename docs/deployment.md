# Deployment

## Images

Every push to `main` that passes CI publishes images to GitHub Container Registry:

- `ghcr.io/oversizedcanoe/autograt-backend`
- `ghcr.io/oversizedcanoe/autograt-frontend`

Each image is versioned `MAJOR.MINOR.<CI run number>`, where `MAJOR.MINOR` comes from the [`VERSION`](../VERSION) file. Every publish pushes these tags:

| Tag | Points to |
|---|---|
| `0.1.57` | That exact build; never moves |
| `0.1` | Newest `0.1.x` build (fixes only) |
| `0` | Newest `0.x.x` build (fixes and features) |
| `latest` | Newest build |
| Commit SHA | Build of that commit; never moves |

Pick the tag in `docker-compose.yml` for how much change you want on each `docker compose pull`. Use the same tag for both images.

`docker-compose.yml` runs those images. It does not build from source.

## Deploy

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

## Networking

The frontend (nginx) proxies `/api` to the backend container and has two listeners:

- **Port 80, for the Cloudflare Tunnel.** It isn't published, so only cloudflared reaches it over the Docker network. Point the tunnel at `http://frontend:80`. It trusts Cloudflare's `CF-Connecting-IP` header for the client's IP, which the login rate limit uses.
- **Port 8080, published as port 3000, for direct local or LAN access.** It ignores `CF-Connecting-IP`. If you only use the tunnel, you can remove `ports:` from the `frontend` service to close port 3000.

## Logs

The backend logs sign-ins, failed logins, account changes, admin actions and rate-limited requests. View them with `docker logs autograt-backend`. Each container keeps at most 50 MB of logs.

## Update

The footer of every page shows the running version, commit and build date (`GET /api/version` returns the backend's). Compare the commit with the latest on `main`, then update:

```sh
docker compose pull
docker compose up -d
```

If the footer warns that the backend is on a different build, one container is stale; pulling and restarting fixes it.

When a new version has database migrations to run, the backend first copies the database to `./data/backups/autograt-<UTC time>-before-<migration>.db` and logs the path. It keeps the newest 5 of these and won't start if the copy fails. See [Restore](backup-restore.md#restore) to go back to one.

## Versioning

Bug fixes and very small features just merge to `main`; the run number goes up on its own. For a feature or anything risky, bump the minor number in `VERSION` (e.g. `0.1` → `0.2`) in that PR. For a big or breaking change, bump the major number (e.g. `0.2` → `1.0`). The run number never resets, so versions go `0.1.57` → `0.2.58`.

Database migrations only go forward, so moving back to an older version after a newer one has migrated the database can fail. Any schema change should bump at least the minor number.
