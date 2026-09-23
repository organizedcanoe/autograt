# Autograt Project Guidelines

## Project Structure
* `/backend`: ASP.NET Core 8 Web API.
* `/frontend`: React 19 + Vite + TypeScript.
* `/docker-compose.yml`: Multi-container orchestration.
* `autograt.md`: The single source of truth for feature specifications and database schema. 

## Build & Run Commands
* **Start Full Stack:** `docker compose up --build`
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
* **Styling Strict Rule:** Use Pico CSS (`@picocss/pico`). Rely entirely on classless semantic HTML tags (`<main>`, `<article>`, `<dialog>`). Do not write custom CSS or use inline styles unless absolutely necessary for the Heatmap Grid colors.

## Agent Operational Directives
1. **Always read `autograt.md`** before implementing new features to understand the exact schema and requirements.
2. When creating new endpoints or UI components, write the tests (xUnit or Vitest) first, then implement the code.
3. Run `dotnet test` or `npm run test` to verify your own work before declaring a task complete.
4. If a task requires modifying more than two files, output a brief plan and wait for user approval before writing code.
5. When writing code, value readability, clarity, and reusability of code.

## Most Important Rule
1. When replying back, prefer short, concise answers unless explicitly told to respond with your "normal" length replies. Limit conversational filler, pleasantries, introductory remarks, and concluding summaries.