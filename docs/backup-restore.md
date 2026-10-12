# Backup and restore

## Data folder

The `./data` folder is mounted into the backend container and holds:

- `autograt.db` (plus `autograt.db-wal` and `autograt.db-shm` while running): the database.
- `jwt.key`: deleting it signs everyone out.
- `vapid.json`: deleting it stops reminders until each user turns them off and on again on every device.
- `backups/`: the automatic copies taken before migrations (see [Update](deployment.md#update)).

## Back up

Stop the backend so the database files are consistent, copy the whole folder, then start it again:

```sh
docker compose stop backend
tar -czf autograt-data-$(date -u +%Y%m%d-%H%M%S).tar.gz data
docker compose start backend
```

Keep the archive somewhere other than the server. To run it nightly, put the three commands in a script and schedule it with cron, e.g. `0 3 * * * cd /path/to/autograt && ./backup.sh`.

## Restore

1. `docker compose stop backend`
2. Either replace `./data` with the folder from your archive (`tar -xzf autograt-data-<time>.tar.gz`), or, to undo a migration, copy one of `./data/backups/*.db` over `./data/autograt.db` and delete `autograt.db-wal` and `autograt.db-shm`.
3. If the restored database is from an older version, set both image tags in `docker-compose.yml` to that version (the backup's file name says which migration it predates), then `docker compose pull`. A newer backend would just migrate it again.
4. `docker compose start backend` (or `docker compose up -d` if you changed the tags).

## Per-user export

Each user can also export their own journal from the Settings page (**Your data**): JSON, which can be imported again (for example to move to a new server), or Markdown for reading. Importing a JSON export replaces the user's days on the dates it contains and keeps the rest.
