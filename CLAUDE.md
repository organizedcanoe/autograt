# Autograt Project Guidelines

## Project Structure
* `/backend`: ASP.NET Core 8 Web API.
* `/frontend`: React 19 + Vite + TypeScript.
* `/docker-compose.yml`: Production orchestration using the published GHCR images.
* `/docs`: Setup, deployment, configuration and backup guides, plus the spec.
* `docs/spec.md`: The single source of truth for feature specifications and database schema. 

## Build & Run Commands
* **Start Full Stack (Local):** `cd frontend && npm run dev:all`
* **Run Production Stack:** `docker compose pull && docker compose up -d` (runs the published GHCR images; does not build local changes)
* **Start Backend (Local):** `cd backend && dotnet run --project Autograt.Api`
* **Start Frontend (Local):** `cd frontend && npm run dev`
* **Run Backend Tests:** `cd backend && dotnet test`
* **Run Frontend Tests:** `cd frontend && npm run test`
* **Create EF Core Migration:** `cd backend && dotnet ef migrations add <MigrationName> --project Autograt.Api`
* **Update DB:** `cd backend && dotnet ef database update --project Autograt.Api`

## Backend Conventions (.NET 8 / C#)
* Use `async`/`await` for all EF Core and API endpoint operations.
* Follow standard C# naming: PascalCase for classes/methods/properties, camelCase for local variables, `_camelCase` for private fields.
* Database is SQLite. Ensure all date fields use `DateTime.UtcNow`.
* Return standard HTTP status codes (`400` for validation errors, `404` for not found).

## Frontend Conventions (React / TS / Vite)
* Use functional components and React Hooks.
* Enforce strict TypeScript typing. Do not use `any`.
* **Styling Strict Rule:** Use Pico CSS (`@picocss/pico`). Rely on semantic HTML tags (`<main>`, `<article>`, `<dialog>`) first; Pico's own modifier classes (`secondary`, `outline`, `contrast`) are allowed, but do not invent custom classes. Do not write custom CSS or use inline styles unless absolutely necessary (e.g. the Heatmap Grid colors).

## Agent Operational Directives
1. **Always read `docs/spec.md`** before implementing new features to understand the exact schema and requirements.
2. When creating new endpoints or UI components, write the tests (xUnit or Vitest) first, then implement the code.
3. Run `dotnet test` or `npm run test` to verify your own work before declaring a task complete.
4. If a task requires modifying more than two files, output a brief plan and wait for user approval before writing code.
5. When writing code, value readability, clarity, and reusability of code.
6. When given a link to a Github issue, the workflow is: 
   1. Create a plan
   2. Wait for approval
   3. Once approved, create a branch
   4. Make and push changes
   5. Make a PR 
7. When instructed to respond to PR comments, after making the changes (and running tests), you may push immediately to the PR branch. However, when requests are made directly in the chat window, do not commit until told to.

## Most Important Rule
1. When replying back, prefer short, concise answers unless explicitly told to respond with your "normal" length replies. Limit conversational filler, pleasantries, introductory remarks, and concluding summaries.