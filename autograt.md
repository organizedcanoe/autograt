# SOFTWARE DESIGN SPECIFICATION: AUTOGRAT

## 1. System Architecture & Deployment

`autograt` is a self-hosted, local-first daily gratitude journaling web application designed with a decoupled frontend and backend architecture.

### Multi-Container Topology

The application is structured into two distinct Docker services orchestrated by Docker Compose:

* **Backend Service (`autograt-backend`):** An ASP.NET Core Web API application serving pure JSON REST endpoints. It manages authentication, business logic, and database access.

* **Frontend Service (`autograt-frontend`):** A React single-page application built with Vite and TypeScript, styled with Pico CSS, and served independently via its own container web server.

* **Database & Persistence:** An embedded SQLite database managed via Entity Framework Core (EF Core) Code-First migrations. The database file resides in a mounted host volume directory (such as `./data/autograt.db`) attached to the backend container to ensure data persists across container recreations.

### Service Independence

* The backend can run independently as an API service.

* The frontend can be replaced, updated, or adapted into a mobile/desktop app without requiring changes to the core API layer.

* In local development, the backend runs via .NET CLI tools and the frontend runs via Node/npm scripts.

## 2. Database Schema Specification (EF Core Code-First)

The database schema consists of four core journal tables structured in a three-tier hierarchy (`JournalEntry` -> `JournalSubEntry` -> `JournalAppend`) enforcing strict data ownership, date uniqueness, and read-only past days (appends excepted).

### Table: `User`

* **Id:** Unique identifier (Integer, Primary Key, auto-increment).

* **Username:** String, Required, Unique Index.

* **PasswordHash:** String, Required. Securely hashed password.

* **Role:** Enumeration, Required, Default: `Pending`. Allowed values: `Pending` (0), `Standard` (1), `Admin` (2). `Pending` accounts are awaiting admin approval and cannot log in; `Admin` accounts have administrative privileges.

* **CreatedAtUtc:** DateTime, Required. Account creation timestamp.

### Table: `UserSetting`

Holds a user's preferences. A setting with no rows uses its default; a setting that allows several values has one row per value.

* **Id:** Unique identifier (Integer, Primary Key, auto-increment).

* **UserId:** Integer, Foreign Key referencing `User.Id`, Required. Rows are deleted with their user.

* **Setting:** Enumeration, Required. Allowed values: `BrightnessTheme` (1: `system`, `light` or `dark`; default `system`), `ColourTheme` (2: `azure`, `jade`, `violet`, `pumpkin`, `pink` or `slate`; default `azure`). Both currently take a single value. An index on `(UserId, Setting)` speeds up lookups.

* **Value:** String, Required. One value of the setting.

### Table: `JournalEntry` (Parent Record)

Represents the core daily log record for a user on a given day.

* **Id:** Unique identifier (Integer, Primary Key, auto-increment).

* **UserId:** Integer, Foreign Key referencing `User.Id`, Required.

* **EntryDate:** DateOnly, Required. Represents the specific calendar day. A composite unique index on `(UserId, EntryDate)` guarantees only one main journal record exists per user per day.

* **DayRating:** Integer, Optional (null until the user rates the day), Range 0–10 when set. Numeric rating representing overall day assessment.

* **CreatedAtUtc:** DateTime, Required. Creation timestamp.

### Table: `JournalSubEntry` (Child Entries)

Holds individual categorized log entries for the day, each added on its own as a top-level entry.

* **Id:** Unique identifier (Integer, Primary Key, auto-increment).

* **JournalEntryId:** Integer, Foreign Key referencing `JournalEntry.Id`, Required.

* **Category:** Enumeration, Required. Allowed values: `Neutral`(0), `Good` (1), `Bad` (2).

* **Content:** String, Required. The text content of the entry.

* **CreatedAtUtc:** DateTime, Required. Timestamp when the sub-entry was recorded.

### Table: `JournalAppend` (Append Notes)

Represents additional immutable notes appended specifically to an existing `JournalSubEntry`. Appends are never edited, on any day.

* **Id:** Unique identifier (Integer, Primary Key, auto-increment).

* **JournalSubEntryId:** Integer, Foreign Key referencing `JournalSubEntry.Id`, Required.

* **Content:** String, Required. The text content of the appended note.

* **CreatedAtUtc:** DateTime, Required. Timestamp when the append entry was submitted.

## 3. Backend API & Business Logic Specifications

### Authentication & Authorization

* **Registration:** Open registration endpoint. During user creation, the system checks total user count. If the user count is zero, `Role` is set to `Admin`; otherwise, it is set to `Pending`.

* **Approval:** A `Pending` user cannot log in; login is rejected with an HTTP 403 Forbidden error explaining that the account awaits admin approval. Registration returns no token, so a pending user cannot call authenticated endpoints.

* **Authentication:** Authenticated via JSON Web Tokens (JWT) provided in the Authorization HTTP header.

* **Admin Capabilities:** Endpoints restricted to admin users that list all users, approve `Pending` users (`POST /api/admin/users/{id}/approve`, making them `Standard`), promote `Standard` users to `Admin` (`POST /api/admin/users/{id}/promote`), and delete `Pending` users such as duplicate sign-ups (`DELETE /api/admin/users/{id}`). Approving or deleting a user who is not pending, or promoting one who is not standard, is rejected with an HTTP 400 Bad Request error; an unknown user returns 404.

### User Settings

* **Reading:** `GET /api/settings` returns every setting for the signed-in user as `{ setting, values }`, using the default for settings the user has not saved.

* **Saving:** `PUT /api/settings/{setting}` with `{ values: [...] }` replaces the user's values for that setting. An unknown setting returns 404; an empty list, a disallowed value, a repeated value, or several values for a single-value setting are rejected with an HTTP 400 Bad Request error.

### Journal Rules & Operations

* **Day Rating:** The `DayRating` is optional. Setting it (`PUT /api/journal/entries/{date}/rating`) requires an integer between 0 and 10; a missing or out-of-range value is rejected with an HTTP 400 Bad Request error.

* **Initial Entry Creation:** There is no separate "create day" request. The day's `JournalEntry` record is created by whichever comes first: adding its first `JournalSubEntry` (`POST /api/journal/entries/{date}/sub-entries`, leaving the rating null) or setting its `DayRating`. Entries are added one at a time, in any mix of categories.

* **Editing Today:** For the current day, the user may change the `DayRating` (`PUT /api/journal/entries/{date}/rating`) and the category and text content of existing `JournalSubEntry` records (`PUT /api/journal/sub-entries/{id}`), as well as add new sub-entries. Adding a sub-entry or setting the rating creates the day's `JournalEntry` if it does not exist yet. Editing a sub-entry keeps its appends and original `CreatedAtUtc`.

* **Read-Only Past Days:** For days before the current day, adding or editing `JournalSubEntry` records, and changing the `DayRating` are rejected with an HTTP 400 Bad Request error. Appending notes remains allowed on any day.

* **Determining "Today":** The client applies the rule using the user's local date. The server does not know the user's time zone, so it treats a date as past only once that date has ended in the latest time zone (UTC−12).

* **Append Immutability:** `JournalAppend` records cannot be edited; there are no `PUT` or `PATCH` endpoints for them.

* **Appending:** Appending content requires a target `JournalSubEntryId` and non-empty text content. This creates a new immutable record in `JournalAppend` linked directly to that specific `JournalSubEntry`.

* **30-Day Heatmap Data:** An endpoint generates a contiguous 30-day array ending on the current date. For each day, it returns the calendar date, the `DayRating` (or null if no entry exists or the day is unrated), and the aggregate count of all sub-entries and appends for that date.

## 4. Search Query Engine Specification

The search endpoint performs full-text query matching across both `JournalSubEntry.Content` and `JournalAppend.Content` records belonging to the authenticated user.

### Query Parsing Rules

* **Quoted Exact Match:** If the query string starts and ends with double quotes (e.g., `"dog, cat"`), quotes are trimmed and the system performs an exact literal substring match for the contained string across all sub-entries and appends.

* **Comma-Separated OR Logic:** If the query string contains commas and is NOT wrapped in double quotes (e.g., `dog, cat`), the system splits the query by commas, trims whitespace from each term, and returns records that match ANY of the individual search terms.

* **Standard Match:** If the query string contains no commas and no surrounding quotes, the system performs a standard single-term substring match.

## 5. Frontend Architecture & User Interface

### Technology Stack

* **Framework:** React with TypeScript managed by Vite.

* **CSS Framework:** Pico CSS for classless, semantic HTML styling.

### Primary Screen Modules

#### Today Journal View

* **Rating Input:** Optional integer selector from 0 to 10 with its own save button. The day can be rated before, after, or without any entries, and the rating can be changed later in the day.

* **Default Input Nudge:** Always presents three fixed text boxes, in this order: two for positive/good experiences and one for a negative/bad experience, to encourage a positive ratio. Each box has a fixed category and its own save button. Once saved, a box is replaced in place by its entry (with its append form); nudge boxes never move. Each box is filled by the earliest saved entry of its category.

* **Custom Entries:** Below the nudge boxes, separated by a horizontal rule, a "Custom Entry" form lets the user add an entry of any category (`Good`, `Neutral` or `Bad`). The text box label and tint follow the chosen category. Saved custom entries appear beneath the nudge boxes, above the rule, and the form clears back to the `Good` category.

* **Submission Logic:** Every save creates one `JournalSubEntry` (and the day's `JournalEntry` if needed). The rating is saved separately.

#### 30-Day Heatmap Component

* Displays a horizontal 30-day block grid representing the last 30 calendar days.

* Color Mapping Rules:

  * **No entry / unrated day:** Neutral muted/grey box.

  * **Rated day:** One smooth scale from red (0) through yellow/amber (5) to green (10). Every rating from 0 to 10 has its own distinct color, each step slightly greener than the one below.

* Interaction: Clicking any day block opens the detail view for that specific day.

#### Day Detail & Append View

* Displays the overall day rating in the page heading after the date, e.g. "Thursday, September 24, 2026: 9/10". For the current day, provides a control to change the rating.

* Chronologically lists all `JournalSubEntry` records attached to that day, grouped or tagged by category (`Good`, `Neutral`, `Bad`).

* **Category Tint:** Each `JournalSubEntry` gets a light background tint by category: `Good` (green), `Bad` (red), `Neutral` (beige). The tint applies to editable and read-only entries, and to the entry text boxes when creating or editing an entry, where it follows the chosen category.

* Under each individual `JournalSubEntry`, lists all attached `JournalAppend` records in chronological order, each showing its content with its full creation date and time on the line beneath in smaller text (appends can be added on later days, so the time alone is ambiguous).

* Provides an append interface attached to each `JournalSubEntry` containing a text input field to submit new append notes directly to `JournalAppend`.

* For the current day, each `JournalSubEntry` can be edited (category and text) and new entries can be added.

* Past days are read-only: the rating, entry editing, and add-entry controls are hidden, a read-only notice is shown, and only the append interface remains. A past day with no entry offers no submission form.

#### Search Interface

* Header search bar accepting user text queries, shown on every page except settings.

* Renders matching journal sub-entries and appended notes with date links pointing directly to the corresponding day view.

#### Settings Page

* The header shows the signed-in user's name as a dropdown menu with **Settings** (`/settings`) and **Log out**; it does not show the theme controls itself.

* An **Appearance** section offers Mode (System, Light, Dark) and Color selects. A change applies straight away and is saved to the user's settings; a failed save shows an error.

* The theme is cached in the browser so the login page and first paint use it; after login the user's saved theme is loaded from the server and applied.

* Admins see an **Admin** section at the bottom of the page with the user list described below. The old `/admin` URL redirects to the settings page.

#### Registration & Admin Views

* The register form asks for the password twice ("Password" and "Confirm password"). If they differ, the form shows "Passwords do not match." and does not submit.

* Every login/register error (empty fields, short password, mismatched passwords, and server errors such as wrong credentials or awaiting approval) shows in a red alert card inside the form, not as a browser popup. The "Account created…" approval notice shows in an amber warning card.

* After registering, a user who needs approval is not logged in; the form switches to login and shows "Account created. An admin must approve it before you can log in." The first user, who becomes the admin, is logged in straight away.

* The admin section of the settings page lists every user with their role (`Pending approval`, `User`, `Admin`), **Approve** and **Delete** buttons for pending users (deleting asks for confirmation first), and a **Promote** button for standard users.

## 6. Docker & Containerization Specification

### Multi-Service Docker Compose Setup

The application deployment is governed by a `docker-compose.yml` file defining two services:

* **`backend` Service:**

  * Builds using a multi-stage Dockerfile targeting the .NET SDK for compilation and the .NET ASP.NET Runtime for execution.

  * Exposes the REST API port.

  * Mounts a local volume path to preserve the SQLite database file across updates.

* **`frontend` Service:**

  * Builds using a multi-stage Dockerfile targeting Node.js for Vite compilation and Nginx (or lightweight web server) for serving built assets.

  * Configured to forward API network requests to the `backend` service container.

## 7. Testing Strategy Specification

### Backend Tests (xUnit + Moq + EF Core In-Memory / SQLite)

* **Authentication Unit Tests:** Verify user creation logic, initial user admin assignment, later users starting as pending, and password hashing logic.

* **Admin Endpoint Tests:** Verify that pending users cannot log in, that admins can approve or delete pending users and promote standard users, and that invalid approvals, deletions and promotions are rejected.

* **Journal Service Integration Tests:**

  * Verify that adding the first sub-entry creates an unrated `JournalEntry`, that setting the rating first creates the day without sub-entries, and that a missing or out-of-range `DayRating` fails validation.

  * Verify that sub-entries can be added one at a time in any mix of categories.

  * Verify that appending to an existing `JournalSubEntry` creates a `JournalAppend` record without altering existing data.

  * Verify that today's rating and sub-entries can be edited, and that creating, adding to, or editing a past day is rejected while appending to it succeeds.

* **Settings Endpoint Tests:** Verify that unsaved settings return their defaults, that saving replaces a setting's value for the signed-in user only, and that unknown settings and invalid values are rejected.

* **Search Parser Tests:** Validate search query parsing logic against exact quoted strings, comma-separated OR lists, and standard strings across both sub-entries and appends.

### Frontend Component Tests (Vitest + React Testing Library)

* Validate that the today view always shows the good/good/bad nudge boxes, saves each on its own and replaces it in place by its entry, and that the custom entry form accepts any category.

* Validate that the 30-day heatmap correctly assigns each day rating its own color on the red-to-green scale.

* Validate that the append form correctly submits new content targeted at a specific sub-entry ID.

* Validate that the day view allows editing for the current day and is read-only (apart from appends) for past days.

* Validate that the settings page saves theme changes, reports failed saves, and shows the admin section only to admins.

* Validate that registering a pending account shows the approval notice without logging in, and that the admin page approves pending users and deletes them only after confirmation.

### End-to-End Tests (Playwright)

* **Complete User Journey:**

  1. Register new user (the first user on a fresh database, so no approval is needed).

  2. Select required day rating (e.g., 8) and enter initial good/bad thoughts.

  3. Confirm creation of the parent day record, sub-entries, and update of the 30-day heatmap block color.

  4. Open day view and select a specific sub-entry to submit an appended note.

  5. Verify the appended note appears under the targeted sub-entry.

  6. Use the search bar to find the appended text and verify navigation back to the detailed day view.