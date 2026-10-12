# Deployment

## Images

Images are published to GitHub Container Registry once CI passes:

- `ghcr.io/oversizedcanoe/autograt-backend`
- `ghcr.io/oversizedcanoe/autograt-frontend`

Each [release](https://github.com/oversizedcanoe/autograt/releases) publishes the version tags, and every push to `main` publishes `main`:

| Tag | Points to |
|---|---|
| `1` | Newest `1.x.x` release (fixes and features). **Recommended.** |
| `1.2` | Newest `1.2.x` release (fixes only) |
| `1.2.3` | That exact release; never moves |
| `latest` | Newest release, including a new major version that may need manual steps |
| `main` | Newest commit on `main`; may be unfinished |
| Commit SHA | Build of that commit; never moves |

Pick the tag in `docker-compose.yml` for how much change you want on each `docker compose pull`. Pin a major version (e.g. `1`) rather than `latest`, so a breaking release is never pulled by surprise. Use the same tag for both images.

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

The footer of every page shows the running version, commit and build date (`GET /api/version` returns the backend's). Compare the version with the newest [release](https://github.com/oversizedcanoe/autograt/releases), then update:

```sh
docker compose pull
docker compose up -d
```

If the footer warns that the backend is on a different build, one container is stale; pulling and restarting fixes it.

When a new version has database migrations to run, the backend first copies the database to `./data/backups/autograt-<UTC time>-before-<migration>.db` and logs the path. It keeps the newest 5 of these and won't start if the copy fails. See [Restore](backup-restore.md#restore) to go back to one.

## Versioning

Releases follow [semantic versioning](https://semver.org/). Merging to `main` publishes only the `main` tag; to release, tag a commit on `main` and push the tag:

```sh
git tag v1.2.3
git push origin v1.2.3
```

Once CI passes, this publishes `1.2.3`, `1.2`, `1` and `latest`, and creates a GitHub Release whose notes list the PRs merged since the previous release. Bump the patch number for fixes, the minor number for features or anything risky, and the major number for breaking changes (anything that needs manual steps to upgrade).

Builds between releases are versioned by `git describe`, e.g. `1.2.3-4-gabc1234` is 4 commits after `v1.2.3`. Local builds add `-dirty` when there are uncommitted changes.

Database migrations only go forward, so moving back to an older version after a newer one has migrated the database can fail. Any schema change should bump at least the minor number.
