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

The database schema consists of four core tables structured in a three-tier hierarchy (`JournalEntry` -> `JournalSubEntry` -> `JournalAppend`) enforcing strict data ownership, date uniqueness, and append-only immutability.

### Table: `User`

* **Id:** Unique identifier (Integer, Primary Key, auto-increment).

* **Username:** String, Required, Unique Index.

* **PasswordHash:** String, Required. Securely hashed password.

* **IsAdmin:** Boolean, Required, Default: False. Indicates whether the account has administrative privileges.

* **CreatedAtUtc:** DateTime, Required. Account creation timestamp.

### Table: `JournalEntry` (Parent Record)

Represents the core daily log record for a user on a given day.

* **Id:** Unique identifier (Integer, Primary Key, auto-increment).

* **UserId:** Integer, Foreign Key referencing `User.Id`, Required.

* **EntryDate:** DateOnly, Required. Represents the specific calendar day. A composite unique index on `(UserId, EntryDate)` guarantees only one main journal record exists per user per day.

* **DayRating:** Integer, **Required**, Range 0–10. Numeric rating representing overall day assessment.

* **CreatedAtUtc:** DateTime, Required. Creation timestamp.

### Table: `JournalSubEntry` (Child Entries)

Holds individual categorized log entries created during the initial daily log submission or added as new top-level entries for the day.

* **Id:** Unique identifier (Integer, Primary Key, auto-increment).

* **JournalEntryId:** Integer, Foreign Key referencing `JournalEntry.Id`, Required.

* **Category:** Enumeration, Required. Allowed values: `Neutral`(0), `Good` (1), `Bad` (2).

* **Content:** String, Required. The text content of the entry.

* **CreatedAtUtc:** DateTime, Required. Timestamp when the sub-entry was recorded.

### Table: `JournalAppend` (Append Notes)

Represents additional immutable notes appended specifically to an existing `JournalSubEntry`.

* **Id:** Unique identifier (Integer, Primary Key, auto-increment).

* **JournalSubEntryId:** Integer, Foreign Key referencing `JournalSubEntry.Id`, Required.

* **Content:** String, Required. The text content of the appended note.

* **CreatedAtUtc:** DateTime, Required. Timestamp when the append entry was submitted.

## 3. Backend API & Business Logic Specifications

### Authentication & Authorization

* **Registration:** Open registration endpoint. During user creation, the system checks total user count. If the user count is zero, `IsAdmin` is automatically set to true; otherwise, `IsAdmin` defaults to false.

* **Authentication:** Authenticated via JSON Web Tokens (JWT) provided in the Authorization HTTP header.

* **Admin Capabilities:** Endpoint restricted to admin users that allows promoting standard users to admin status.

### Journal Rules & Operations

* **Day Rating Requirement:** Every journal creation request must include a `DayRating` integer between 0 and 10. Submissions missing a `DayRating` must be rejected with an HTTP 400 Bad Request error.

* **Initial Entry Creation:** When submitting a daily journal form, the system creates one `JournalEntry` record (storing the required rating) and zero or more child `JournalSubEntry` records (for each good, neutral, or bad entry text box filled in).

* **Immutability:** Endpoint logic explicitly prohibits `PUT` or `PATCH` updates to existing text content in `JournalSubEntry` or `JournalAppend` records.

* **Appending:** Appending content requires a target `JournalSubEntryId` and non-empty text content. This creates a new immutable record in `JournalAppend` linked directly to that specific `JournalSubEntry`.

* **30-Day Heatmap Data:** An endpoint generates a contiguous 30-day array ending on the current date. For each day, it returns the calendar date, the `DayRating` (or null if no entry exists), and the aggregate count of all sub-entries and appends for that date.

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

#### Initial Journal Submission View

* **Rating Input:** Mandatory visual sliding range control or integer selector from 0 to 10. Submissions are disabled until a rating is chosen.

* **Default Input Nudge:** Presents two text boxes for positive/good experiences and one text box for negative/bad experiences to encourage a positive ratio nudge.

* **Submission Logic:** Form submission creates the daily `JournalEntry` record with the required rating and writes the submitted text entries into individual `JournalSubEntry` records.

#### 30-Day Heatmap Component

* Displays a horizontal 30-day block grid representing the last 30 calendar days.

* Color Mapping Rules:

  * **No entry / unrated day:** Neutral muted/grey box.

  * **Rating 0 to 3:** Bad day indicator (Red spectrum).

  * **Rating 4 to 6:** Neutral day indicator (Yellow/Amber spectrum).

  * **Rating 7 to 10:** Good day indicator (Green spectrum).

* Interaction: Clicking any day block opens the detail view for that specific day.

#### Day Detail & Append View

* Displays the overall day rating.

* Chronologically lists all `JournalSubEntry` records attached to that day, grouped or tagged by category (`Good`, `Neutral`, `Bad`).

* Under each individual `JournalSubEntry`, lists all attached `JournalAppend` records in chronological order with their creation timestamps.

* Provides an append interface attached to each `JournalSubEntry` containing a text input field to submit new append notes directly to `JournalAppend`.

#### Search Interface

* Header search bar accepting user text queries.

* Renders matching journal sub-entries and appended notes with date links pointing directly to the corresponding day view.

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

* **Authentication Unit Tests:** Verify user creation logic, initial user admin assignment, and password hashing logic.

* **Journal Service Integration Tests:**

  * Verify that creating an entry without a `DayRating` fails validation.

  * Verify that creating an entry creates associated `JournalSubEntry` records.

  * Verify that appending to an existing `JournalSubEntry` creates a `JournalAppend` record without altering existing data.

* **Search Parser Tests:** Validate search query parsing logic against exact quoted strings, comma-separated OR lists, and standard strings across both sub-entries and appends.

### Frontend Component Tests (Vitest + React Testing Library)

* Validate that the daily submission form enforces `DayRating` selection prior to submission.

* Validate that the 30-day heatmap correctly assigns color styling according to day rating ranges.

* Validate that the append form correctly submits new content targeted at a specific sub-entry ID.

### End-to-End Tests (Playwright)

* **Complete User Journey:**

  1. Register new user.

  2. Select required day rating (e.g., 8) and enter initial good/bad thoughts.

  3. Confirm creation of the parent day record, sub-entries, and update of the 30-day heatmap block color.

  4. Open day view and select a specific sub-entry to submit an appended note.

  5. Verify the appended note appears under the targeted sub-entry.

  6. Use the search bar to find the appended text and verify navigation back to the detailed day view.