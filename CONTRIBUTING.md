# Contributing

Thanks for your interest in autograt. Bug reports, ideas and pull requests are welcome.

## Before you start

- For anything beyond a small fix, open an issue first so we can agree on the approach.
- Features and the database schema are described in [docs/spec.md](docs/spec.md). Changes to either should update it.
- Security issues: see [SECURITY.md](SECURITY.md) instead of opening an issue.

## Setting up

See [docs/development.md](docs/development.md) for prerequisites, running locally and database migrations.

## Making changes

- **Backend** (`/backend`, ASP.NET Core 8): `async`/`await` for EF Core and endpoints, `DateTime.UtcNow` for dates, `400` for validation errors and `404` for not found.
- **Frontend** (`/frontend`, React + TypeScript): functional components and hooks, strict typing (no `any`). Styling uses [Pico CSS](https://picocss.com/) with semantic HTML; avoid custom classes, custom CSS and inline styles.
- Add or update tests (xUnit or Vitest) alongside your change.

## Testing

```sh
cd backend && dotnet test
cd frontend && npm run test
cd frontend && npm run test:e2e
```

Or run everything, including the Docker image builds, with `scripts/verify.ps1`.

## Pull requests

- Branch from `main` and open a pull request against it.
- CI must pass and conversations must be resolved before merging.
- Pull requests are squash-merged, so the PR title becomes the commit message. Keep it short and descriptive.
