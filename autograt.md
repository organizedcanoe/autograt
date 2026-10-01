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

* **Role:** Enumeration, Required, Default: `Pending`. Allowed values: `Pending` (0), `Standard` (1), `Admin` (2), `Disabled` (3). `Pending` accounts are awaiting admin approval and cannot log in; `Admin` accounts have administrative privileges; `Disabled` accounts were blocked by an admin, cannot log in, and keep their data.

* **SecurityStamp:** String, Required. A random value copied into every token. Replacing it ends every session issued before it.

* **MustChangePassword:** Boolean, Required, Default: `false`. Set when an admin resets the password; cleared when the user changes it.

* **CreatedAtUtc:** DateTime, Required. Account creation timestamp.

* **LastReminderAtUtc:** DateTime, Optional. The reminder slot most recently handled (sent or skipped), so each slot is handled only once.

### Table: `UserSetting`

Holds a user's preferences. A setting with no rows uses its default; a setting that allows several values has one row per value.

* **Id:** Unique identifier (Integer, Primary Key, auto-increment).

* **UserId:** Integer, Foreign Key referencing `User.Id`, Required. Rows are deleted with their user.

* **Setting:** Enumeration, Required. Allowed values: `BrightnessTheme` (1: `system`, `light` or `dark`; default `system`), `ColourTheme` (2: `azure`, `jade`, `violet`, `pumpkin`, `pink` or `slate`; default `azure`), `RemindersEnabled` (3: `on` or `off`; default `off`), `ReminderTime` (4: 24-hour `HH:mm` times, up to four; default `12:00` and `20:00`), `TimeZone` (5: an IANA time zone such as `America/Toronto`; default `UTC`). Only `ReminderTime` takes several values. An index on `(UserId, Setting)` speeds up lookups.

* **Value:** String, Required. One value of the setting.

### Table: `PushSubscription`

One row per browser or device a user has enabled reminder notifications on.

* **Id:** Unique identifier (Integer, Primary Key, auto-increment).

* **UserId:** Integer, Foreign Key referencing `User.Id`, Required. Rows are deleted with their user.

* **Endpoint:** String, Required, Unique Index. The browser's push service URL; a browser has one endpoint.

* **P256dh:** String, Required. The browser's public encryption key.

* **Auth:** String, Required. The browser's authentication secret.

* **CreatedAtUtc:** DateTime, Required.

### Table: `AppSetting`

Holds server-wide settings that admins manage. A setting with no row uses its default.

* **Key:** Enumeration, Primary Key. Allowed values: `RegistrationOpen` (1: `on` or `off`; default `on`).

* **Value:** String, Required.

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

Represents additional notes appended specifically to an existing `JournalSubEntry`. Appends are never edited, on any day, and can be deleted only while their sub-entry's day is the current day.

* **Id:** Unique identifier (Integer, Primary Key, auto-increment).

* **JournalSubEntryId:** Integer, Foreign Key referencing `JournalSubEntry.Id`, Required.

* **Content:** String, Required. The text content of the appended note.

* **CreatedAtUtc:** DateTime, Required. Timestamp when the append entry was submitted.

## 3. Backend API & Business Logic Specifications

### Authentication & Authorization

* **Registration:** Open registration endpoint. During user creation, the system checks total user count. If the user count is zero, `Role` is set to `Admin`; otherwise, it is set to `Pending`.

* **Closing Registration:** While the `RegistrationOpen` app setting is `off`, registering is rejected with an HTTP 403 Forbidden error ("Registration is closed."). The first user can always register, so a new install gets an admin. The anonymous `GET /api/auth/registration` returns `{ open }` so the login page can hide registration.

* **Approval:** A `Pending` user cannot log in; login is rejected with an HTTP 403 Forbidden error explaining that the account awaits admin approval. Registration returns no token, so a pending user cannot call authenticated endpoints. A `Disabled` user's login is likewise rejected with 403 ("This account has been disabled.").

* **Authentication:** Authenticated via JSON Web Tokens (JWT) provided in the Authorization HTTP header.

* **Session Revocation:** Each token carries the user's `SecurityStamp`. Every request checks it against the database, so a token whose user no longer exists, is pending or disabled, whose stamp has changed, or which has no stamp is rejected with an HTTP 401 Unauthorized error. The stamp is replaced when the user changes their password, when an admin resets it, and when an admin disables the user, which signs out every existing session.

* **Roles:** Tokens do not carry the role. Every request reads it from the database along with the security stamp, so promoting or demoting a user takes effect on their next request without logging in again.

* **Account Self-Management:** Endpoints for the signed-in user's own account. A wrong password is rejected with an HTTP 400 Bad Request error ("Current password is incorrect."), not 401, since the frontend treats a 401 as an expired session. The endpoints that check a password share the login and register rate limit.

  * `PUT /api/account/password` with `{ currentPassword, newPassword }` changes the password and returns a new `LoginResponse`, so this session stays signed in while every other session is signed out. A new password under 8 characters, or the same as the current one, is rejected with 400.

  * `PUT /api/account/username` with `{ username }` renames the user (trimmed, at most 50 characters) and returns a new `LoginResponse` carrying the new name; other sessions stay signed in. A name taken by another user, ignoring case, returns 409 Conflict; a user may change the case of their own name.

  * `DELETE /api/account` with `{ password }` deletes the user and all their journal entries, sub-entries, appends, settings and push subscriptions, and returns 204. The last admin cannot delete their account while other users exist (400, "Promote another admin before deleting your account."). If the only user deletes their account, the next user to register becomes the admin.

* **Forgotten Passwords:** `POST /api/admin/users/{id}/reset-password` (admins only) gives an approved user (standard or admin) a random 12-character temporary password, sets `MustChangePassword`, replaces their `SecurityStamp`, and returns `{ temporaryPassword }`. The temporary password is only ever returned in this response. Resetting a pending user or your own password is rejected with 400; an unknown user returns 404. User responses include `mustChangePassword`.

* **Admin Capabilities:** Endpoints restricted to admin users. An action on a user in the wrong role is rejected with an HTTP 400 Bad Request error; an unknown user returns 404.

  * `GET /api/admin/users` lists all users.

  * `POST /api/admin/users/{id}/approve` makes a `Pending` user `Standard`.

  * `POST /api/admin/users/{id}/promote` makes a `Standard` user `Admin`.

  * `POST /api/admin/users/{id}/demote` makes an `Admin` user `Standard`. Demoting yourself or the last admin is rejected with 400.

  * `POST /api/admin/users/{id}/disable` makes a `Standard` user `Disabled` and replaces their `SecurityStamp`; admins must be demoted first. `POST /api/admin/users/{id}/enable` makes a `Disabled` user `Standard` again.

  * `DELETE /api/admin/users/{id}` deletes a `Pending`, `Standard` or `Disabled` user and all their journal data, settings and push subscriptions. Admins (including yourself) must be demoted first (400).

  * `GET /api/admin/settings` returns `{ registrationOpen }`; `PUT /api/admin/settings` with `{ registrationOpen }` saves it and returns the saved settings.

### Rate Limiting

* **Limits:** Every request is limited per one-minute window: signed-in requests per user (default 300), anonymous requests per client IP (default 60), and login and register additionally per client IP (default 10). The limits are set in the `RateLimiting` configuration section.

* **Rejection:** A request over a limit is rejected with an HTTP 429 Too Many Requests error, a `Retry-After` header in seconds, and a problem title telling the user when to try again.

* **Client IP:** The backend takes the client IP from the `X-Forwarded-For` header set by the frontend's nginx proxy, which uses Cloudflare's `CF-Connecting-IP` when present.

### User Settings

* **Reading:** `GET /api/settings` returns every setting for the signed-in user as `{ setting, values }`, using the default for settings the user has not saved.

* **Saving:** `PUT /api/settings/{setting}` with `{ values: [...] }` replaces the user's values for that setting. An unknown setting returns 404; an empty list, a disallowed value, a repeated value, or several values for a single-value setting are rejected with an HTTP 400 Bad Request error. `ReminderTime` values must be 24-hour `HH:mm` times (e.g. `08:30`), at most four; `TimeZone` must be a time zone the server knows.

### Push Notifications & Reminders

* **VAPID Keys:** Push messages are signed with a VAPID key pair from the `Push` configuration section (`VapidPublicKey`, `VapidPrivateKey`, and `Subject`, a `mailto:` or site URL). If neither key is set, a pair is generated once and saved as `vapid.json` in the data directory, so subscriptions stay valid across restarts. Setting only one key stops the backend from starting.

* **Endpoints:** All signed-in only.

  * `GET /api/push/public-key` returns `{ publicKey }` (base64url), which browsers need to subscribe.

  * `POST /api/push/subscriptions` with `{ endpoint, keys: { p256dh, auth } }` (the shape of the browser's `PushSubscription.toJSON()`) saves the browser's subscription and returns 204. An existing subscription with the same endpoint is updated, and moved to the current user if another user enabled reminders on that device before. A missing or non-HTTPS endpoint, or missing keys, is rejected with an HTTP 400 Bad Request error.

  * `DELETE /api/push/subscriptions` with `{ endpoint }` deletes the current user's subscription and returns 204, or 404 if the user has none with that endpoint.

  * `POST /api/push/test` sends a test notification ("Reminders are working on this device.") to every device of the current user and returns 204.

* **Sending:** A message goes to every subscription the user has. A subscription the push service reports as gone (404/410) is deleted; other failures are logged and skipped. The payload is JSON `{ title, body, url }`; `url` is `/`, so clicking the notification opens the today view.

* **Reminder Scheduler:** A background service runs every minute. For each user with `RemindersEnabled` = `on` and at least one subscription, it converts the current time to the user's `TimeZone` and finds the latest `ReminderTime` slot (today's, or yesterday's just after midnight) that has passed within the last 15 minutes. A slot is handled only if it is later than `User.LastReminderAtUtc`, which is then set to it, so each slot is handled once even across restarts, and reminders are never sent hours late. A time skipped when clocks go forward is sent when the clock jumps past it; a time repeated when clocks go back is sent on its first occurrence.

* **Reminder Content:** The reminder asks for whatever the user's day is still missing: before 17:00 local time it asks "How is your day going?", from 17:00 "How has your day been?", followed by "Take a minute to reflect / add an entry / rate it." A day that already has sub-entries and a rating gets no reminder (the slot still counts as handled).

* **Logging Out:** Logging out does not remove the device's subscription; the settings page switch is the only way to stop reminders on a device.

### Export & Import

* **Endpoints:** All signed-in only, and always scoped to the signed-in user.

  * `GET /api/export?format=json` returns the user's journal and saved settings as a JSON attachment named `autograt-<username>-<yyyy-MM-dd>.json`; `format=markdown` returns a readable `text/markdown` file (`.md`). Any other or missing format is rejected with an HTTP 400 Bad Request error.

  * `POST /api/import` with a JSON export (up to 25 MB) returns `{ importedDays, replacedDays: ["yyyy-MM-dd", ...], settingsImported }`.

* **JSON Format (version 1):** `{ format: "autograt-export", version: 1, exportedAtUtc, username, settings: [{ setting, values }], entries: [{ date, rating, createdAtUtc, subEntries: [{ category, content, createdAtUtc, appends: [{ content, createdAtUtc }] }] }] }`. Database ids are left out, so a file can be imported into any server. `settings` holds only settings the user has saved (defaults are left out). `category` is the enum name (`Neutral`/`Good`/`Bad`) and `rating` is null for an unrated day. Days are ordered by date; sub-entries and appends by `CreatedAtUtc`. Push subscriptions, password hashes and `LastReminderAtUtc` are never exported.

* **Markdown Format:** A `# Autograt journal: <username>` heading and export date, then one `## <date> (rating N/10)` (or `(unrated)`) section per day, newest first, listing `- **<Category>:** <content>` with appends indented beneath as `- _Added <date>:_ <content>`. It is for reading only and cannot be imported.

* **Import Rules:**

  * **Validation first:** The whole file is checked before anything is written, and every problem is returned in one HTTP 400 Bad Request response: a wrong `format` or unknown `version`, a missing or invalid date, a date repeated or in the future (not yet started in the earliest time zone, UTC+14), a rating outside 0–10, an unknown category, empty `content`, a missing `createdAtUtc`, or a setting that is unknown, repeated or fails the same checks as `PUT /api/settings/{setting}`.

  * **The file wins:** A day in the file replaces the user's day on that date, including its rating, sub-entries and appends, and is listed in `replacedDays`. A day only in the file is created. A day only in the database is left untouched. Importing the same file again leaves the same data, without duplicates.

  * **Restoring the past:** Import bypasses the read-only past days rule, and keeps the file's `CreatedAtUtc` timestamps rather than setting them to now.

  * **Settings:** Each setting in the file replaces the user's saved values for it; settings not in the file are untouched. Reminder subscriptions belong to each device, so imported reminders that are `on` still have to be enabled on each device.

  * **All or nothing:** The import runs in one transaction. `username` in the file is informational only; data always goes into the signed-in user's account.

### Build Version

* **Endpoint:** `GET /api/version` (anonymous) returns the running backend build as `{ version, commit, buildDate }`, e.g. `{ "version": "0.1.42", "commit": "a1b2c3d", "buildDate": "2026-09-28T12:00:00Z" }`. Local builds return `0.0.0-dev` / `local` with a null `buildDate`.

* **Numbering:** Each image published from `main` is versioned `MAJOR.MINOR.<CI run number>`, where `MAJOR.MINOR` is read from the repo's `VERSION` file and bumped by hand (minor for features or risky changes, major for big or breaking ones). It is stamped with its UTC build date and tagged with the full version, the floating `MAJOR.MINOR` and `MAJOR` tags, `latest`, and the commit SHA.

### Journal Rules & Operations

* **Day Rating:** The `DayRating` is optional. Setting it (`PUT /api/journal/entries/{date}/rating`) requires an integer between 0 and 10; a missing or out-of-range value is rejected with an HTTP 400 Bad Request error.

* **Initial Entry Creation:** There is no separate "create day" request. The day's `JournalEntry` record is created by whichever comes first: adding its first `JournalSubEntry` (`POST /api/journal/entries/{date}/sub-entries`, leaving the rating null) or setting its `DayRating`. Entries are added one at a time, in any mix of categories.

* **Editing Today:** For the current day, the user may change the `DayRating` (`PUT /api/journal/entries/{date}/rating`) and the category and text content of existing `JournalSubEntry` records (`PUT /api/journal/sub-entries/{id}`), as well as add new sub-entries. Adding a sub-entry or setting the rating creates the day's `JournalEntry` if it does not exist yet. Editing a sub-entry keeps its appends and original `CreatedAtUtc`.

* **Deleting Mistakes:** For the current day, a `JournalSubEntry` can be deleted (`DELETE /api/journal/sub-entries/{id}`), which also deletes its appends, and a single `JournalAppend` on one of the day's sub-entries can be deleted (`DELETE /api/journal/appends/{id}`). Both return `204`, or `404` if the record does not exist or belongs to another user. The day's `JournalEntry` and its rating are kept, even when its last sub-entry is deleted.

* **Read-Only Past Days:** For days before the current day, adding, editing or deleting `JournalSubEntry` records, deleting `JournalAppend` records (even one written today), and changing the `DayRating` are rejected with an HTTP 400 Bad Request error. Appending notes remains allowed on any day.

* **Determining "Today":** The client applies the rule using the user's local date. The server does not know the user's time zone, so it treats a date as past only once that date has ended in the latest time zone (UTC−12).

* **Append Immutability:** `JournalAppend` records cannot be edited; there are no `PUT` or `PATCH` endpoints for them. They can only be deleted on the current day (see Deleting Mistakes).

* **Appending:** Appending content requires a target `JournalSubEntryId` and non-empty text content. This creates a new record in `JournalAppend` linked directly to that specific `JournalSubEntry`.

* **Heatmap Data:** `GET /api/journal/heatmap?from=yyyy-MM-dd&to=yyyy-MM-dd` returns a contiguous array with one item per day from `from` to `to`, both inclusive, oldest first. For each day, it returns the calendar date, the `DayRating` (or null if no entry exists or the day is unrated), and the aggregate count of all sub-entries and appends for that date. Both dates are required; a `from` after `to`, or a range longer than 366 days, is rejected with `400`. The today view asks for the 30 days ending on the client's current date.

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

### Progressive Web App

* **Installable:** The app can be installed from the browser (Add to Home Screen on phones). `vite-plugin-pwa` generates the manifest (`Autograt`, standalone display, Pico azure theme color) and the icons: 64, 192 and 512 px, a maskable 512 px icon, and a 180 px Apple touch icon. Installing and push both need HTTPS; `localhost` counts as secure for development.

* **Service Worker (`src/sw.ts`):** Precaches the built app shell (JS, CSS, HTML, icons) so the app opens instantly and loads offline, and serves `index.html` for client-side routes. `/api` requests are never cached, so journal data always comes from the server; offline entry writing is not supported. The worker also runs in `npm run dev`, but not in Vitest.

* **Updates:** When a new build is deployed, a dialog says "A new version is available." with **Reload** (switches to the new version) and **Later** buttons, so users are never stuck on a stale build.

* **Notifications:** The service worker shows each push message as a notification with the app icon. All reminders share one tag, so a newer one replaces an unread older one. Clicking a notification focuses an open Autograt window and navigates it to the message's URL, or opens a new window. When the push service replaces a subscription, the worker subscribes again; it cannot save the new subscription without the user's token, so the settings page saves it on the next visit.

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

* For the current day, each `JournalSubEntry` can be edited (category and text) or deleted, each of its appends can be deleted, and new entries can be added. Each delete asks for confirmation first; deleting an entry that filled a nudge box shows that box again.

* Past days are read-only: the rating, entry editing, delete, and add-entry controls are hidden, and only the append interface remains. A past day with no sub-entries, whether or not it has an entry or a rating, shows its heading (e.g. "…: unrated") followed by "No entries were written.", and offers no submission form.

* Above the heading, a **← Previous day** link opens the day before, and on past days a **Next day →** link opens the day after. There is no next day link on the current day.

#### Search Interface

* The search page (`/search`), opened from the user's menu, is the only page with a search bar. Searching shows the results on the same page (`/search?q=…`), with the current query in the search bar.

* Renders matching journal sub-entries and appended notes, newest first, with date links pointing directly to the corresponding day view. The number of matches is shown, and the matches are shown 10 at a time, with a **Show more** button for the next 10.

#### History Page

* The page for browsing past days (`/history`), opened from the user's menu. The menu lists **History** and then **Search**, which opens the search page.

* **Month calendar:** Shown first, on the current month, which loads when the page opens. A month input (no later than the current month) and a **Show** button load another month. The month is laid out as a Sunday-to-Saturday calendar table; each day up to today is colored by its rating like the heatmap and opens its day view, while later days are shown without a link. **← Previous month** and **Next month →** buttons move the shown month; the next month button is disabled on the current month.

* **Jump to a date:** A date input (starting on, and no later than, today) and a **Go** button that opens that day's view.

* **Heatmap:** A range picker (`Last 30 days`, `Last 60 days`, `Last 90 days`, `Last 365 days`, `Year to date`) and a **Show** button. Nothing loads until a range is shown; it then shows a heatmap of the range ending today, with the same blocks, colors and links as the today view's heatmap, wrapping into rows of 30.

#### Settings Page

* An **Account** section, above Appearance, manages the account:

  * **Username:** A text input with the current name and a **Save username** button. A saved name updates the header straight away; an empty name or a taken name shows an error.

  * **Change password:** Current password, new password and confirm new password, with a **Change password** button. A missing field, a new password under 8 characters, or mismatched passwords show an error without calling the server. On success it shows "Password changed. Other devices have been signed out."

  * **Delete account:** A **Delete account…** button opens a confirmation dialog explaining that all entries, ratings and settings are deleted permanently and suggesting an export first. **Delete forever** stays disabled until the password is entered; a wrong password shows an error in the dialog. On success this browser is unsubscribed from reminders and the user is logged out. **Cancel** closes the dialog.

* After an admin resets their password, a signed-in user sees only a **Choose a new password** page (temporary password, new password, confirm) with a **Log out** button, on every URL, until they change it.

* The header shows the signed-in user's name as a dropdown menu with **Settings** (`/settings`), **Admin** (`/admin`, admins only) and **Log out**; it does not show the theme controls itself.

* An **Appearance** section offers Mode (System, Light, Dark) and Color selects. A change applies straight away and is saved to the user's settings; a failed save shows an error.

* The theme is cached in the browser so the login page and first paint use it; after login the user's saved theme is loaded from the server and applied.

* A **Reminders** section, below Appearance, controls reminder notifications. Changes save straight away; a failed save shows an error.

  * **Time zone:** A select of IANA time zones (UTC first), showing the saved zone. If it differs from the zone this device detects, a warning and a **Use <zone> (detected)** button are shown, since reminder times follow the saved zone.

  * **Enable reminders:** A switch. Turning it on asks for notification permission, subscribes this browser, saves the subscription and sets `RemindersEnabled` to `on`. If permission is refused, the switch stays off and an alert explains why. Turning it off deletes this browser's subscription, unsubscribes it and sets `RemindersEnabled` to `off`.

  * **This device:** Reminders go to every device they were enabled on. If they are on but this browser is not subscribed, the page says "Reminders are on, but not for this device." with an **Enable on this device** button. On load, a subscribed browser is saved again, in case the server lost it.

  * **Reminder times:** One time input per `ReminderTime` value (default 12:00 and 20:00) with a **Remove** button (disabled for the last one) and an **Add time** button (up to four). A time is saved once it is filled in and the input loses focus.

  * **Send test notification:** Shown while reminders are on; sends a test notification to every device.

  * **Unsupported browsers:** Instead of the switch, a notice explains why reminders are unavailable: the browser has no notification support; on iPhone/iPad, the app must be added to the Home Screen and opened from there (iOS 16.4 or later); or notifications are blocked in the browser settings. The time zone and times can still be changed.

* A **Your data** section, below Reminders, exports and imports the journal.

  * **Export as JSON** and **Export as Markdown** download the export; a failed export shows an error.

  * **Import:** A file input (JSON only) and an **Import** button. A file that is not JSON is rejected with an error. Otherwise a confirmation dialog warns that importing overwrites the user's entries and ratings on any dates also in the file, keeps those on other dates, and replaces their settings with the file's; **Replace and import** imports it and **Cancel** does nothing.

  * **Result:** "N days imported (M replaced) and K settings.", with the replaced dates in a collapsible list. If the imported settings turn reminders on, it adds that they must be enabled on this device in the Reminders section above. The theme and reminder settings reload with the imported values. Every problem the server found in a rejected file is listed in an alert.


#### Registration & Admin Views

* The register form asks for the password twice ("Password" and "Confirm password"). If they differ, the form shows "Passwords do not match." and does not submit.

* Every login/register error (empty fields, short password, mismatched passwords, and server errors such as wrong credentials or awaiting approval) shows in a red alert card inside the form, not as a browser popup. The "Account created…" approval notice shows in an amber warning card.

* After registering, a user who needs approval is not logged in; the form switches to login and shows "Account created. An admin must approve it before you can log in." The first user, who becomes the admin, is logged in straight away.

* The admin page (`/admin`) is only available to admins; other users visiting it are redirected to the today view. It lists every user with their role (`Pending approval`, `User`, `Admin`, `Disabled`) and the actions that apply: **Approve** for pending users, **Promote** and **Disable** for standard users, **Demote** for other admins, **Enable** for disabled users, and **Delete** for every non-admin. Disabling and deleting ask for confirmation first. Every approved user other than the signed-in admin has a **Reset password** button; after confirming, a dialog shows the temporary password once with **Copy** and **Done** buttons.

* Below the users, a **Registration** section has an **Open registration** switch. While registration is closed, the login page shows "Registration is closed. Ask an admin for an account." instead of the register link. If the status can't be loaded, the register link stays.

* On load, a signed-in browser refreshes the stored user from `GET /api/auth/me`, so a demoted admin loses the Admin menu item.

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

  * Serves `sw.js`, `index.html` and `manifest.webmanifest` (as `application/manifest+json`) with `Cache-Control: no-cache`, so a new deploy is picked up promptly, and the content-hashed files under `/assets/` with `Cache-Control: public, max-age=31536000, immutable`.

* **Build info:** Both images take `VERSION`, `COMMIT` and `BUILD_DATE` build args. Every page shows the frontend build in a footer (version, commit linked to GitHub, build date), and warns when `GET /api/version` reports a different backend build, meaning one container is stale.

## 7. Testing Strategy Specification

### Backend Tests (xUnit + Moq + EF Core In-Memory / SQLite)

* **Authentication Unit Tests:** Verify user creation logic, initial user admin assignment, later users starting as pending, that closed registration rejects later users but not the first, and password hashing logic.

* **Admin Endpoint Tests:** Verify that pending users cannot log in; that admins can approve or delete pending users and promote standard users; that deleting a standard or disabled user removes their data and ends their session, and deleting an admin is rejected; that promoting and demoting apply to the user's existing session, and demoting yourself or a non-admin is rejected; that disabling a standard user ends their session and blocks login until enabled again, and disabling an admin or enabling a user who isn't disabled is rejected; that closing registration rejects new sign-ups and is reported by the registration status, and reopening allows them; that invalid role changes are rejected and unknown users return 404; and that non-admins are forbidden (403) from every admin endpoint.

* **Reminder Tests:** In addition to the scheduling tests, verify that disabled users receive no reminders.

* **Account Endpoint Tests:** Verify that every account endpoint returns 401 without a token; that changing the password returns a working token, signs out other sessions and replaces the login password, and that a wrong current password returns 400 without signing out; that changing the username returns a new token, allows a case-only change of one's own name and rejects taken or invalid names; that deleting the account needs the password, removes all the user's data but no one else's and ends the session, and is rejected for the last admin while other users exist; that an admin password reset returns a temporary password that logs in with `mustChangePassword`, ends the user's sessions, and is cleared by a password change, and is rejected for pending users and yourself; and that a token without a security stamp is rejected.

* **Journal Service Integration Tests:**

  * Verify that adding the first sub-entry creates an unrated `JournalEntry`, that setting the rating first creates the day without sub-entries, and that a missing or out-of-range `DayRating` fails validation.

  * Verify that sub-entries can be added one at a time in any mix of categories.

  * Verify that appending to an existing `JournalSubEntry` creates a `JournalAppend` record without altering existing data.

  * Verify that today's rating and sub-entries can be edited, and that creating, adding to, or editing a past day is rejected while appending to it succeeds.

  * Verify that deleting one of today's sub-entries removes its appends but keeps the day and its rating, that deleting one of today's appends removes only that append, that deleting a past day's sub-entry or append (even one written today) is rejected with `400`, and that deleting another user's sub-entry or append returns `404`.

* **Settings Endpoint Tests:** Verify that unsaved settings return their defaults, that saving replaces a setting's value for the signed-in user only, and that unknown settings and invalid values are rejected, including malformed, repeated or more than four reminder times and unknown time zones.

* **Push Endpoint Tests:** Verify that every push endpoint returns 401 without a token; that subscribing creates a subscription, updates an existing endpoint without a duplicate, and moves another user's endpoint to the current user; that invalid bodies are rejected; that unsubscribing removes only the caller's subscription (404 otherwise); and that the test notification reaches only the current user's devices and deletes expired subscriptions.

* **VAPID Key Tests:** Verify that configured keys are used without writing a file, that configuring only one key fails, and that missing keys are generated once and reused afterwards.

* **Reminder Schedule Tests:** Verify that a slot is due only within its 15-minute window and only once; that local time and local date follow time zones behind and ahead of UTC; that the latest of several due slots is picked; that a slot just before midnight is still sent just after it; and that daylight saving changes shift the offset, send a slot in the skipped hour once the clock jumps past it, and send a slot in the repeated hour only once.

* **Reminder Service Tests** (with a fake push sender and `FakeTimeProvider`): Verify that a due reminder reaches every device of the user, is not resent on later ticks, and uses the user's time zone and the evening wording; that users with reminders off or no subscriptions are skipped; that a day with entries and a rating is skipped while a day missing either is still reminded; and that expired subscriptions are deleted.

* **Export & Import Endpoint Tests:** Verify that both endpoints return 401 without a token and an unknown format returns 400; that the JSON export holds only the user's data, nested and ordered, with category names, no ids and only saved settings; that the Markdown export renders days newest first with ratings (or unrated), categories and appends; that an import creates days with the file's timestamps, replaces days the user already has (reporting them), leaves days not in the file untouched, is idempotent, overwrites only the settings in the file, and round-trips another user's export; and that each invalid file is rejected with 400 and writes nothing.

* **Search Parser Tests:** Validate search query parsing logic against exact quoted strings, comma-separated OR lists, and standard strings across both sub-entries and appends.

### Frontend Component Tests (Vitest + React Testing Library)

* Validate that the today view always shows the good/good/bad nudge boxes, saves each on its own and replaces it in place by its entry, and that the custom entry form accepts any category.

* Validate that the 30-day heatmap correctly assigns each day rating its own color on the red-to-green scale.

* Validate that the append form correctly submits new content targeted at a specific sub-entry ID.

* Validate that the day view allows editing and deleting (after confirmation) for the current day and is read-only (apart from appends) for past days, and that it links to the previous day and, except on the current day, the next day.

* Validate that the search page pages its results 10 at a time; that the history page shows the month calendar, jump to a date and heatmap in that order and loads only the current month on open; that jumping to a date starts on today and opens the chosen day; that the month calendar starts on the current month, starts each month on its weekday, colors and links each day up to today, and pages between months but not past the current one; and that the heatmap range loads each range ending today only when shown.

* Validate that the settings page saves theme changes and reports failed saves, and that only admins can reach the admin page.

* Validate that registering a pending account shows the approval notice without logging in, and that the login page hides registration while it is closed (but not when its status fails to load); that the admin page shows the actions for each role, approves pending users, demotes other admins, disables users and deletes them only after confirmation, enables disabled users, and shows server errors; that the registration switch saves and keeps the old value when saving fails; and that a stored session's user is refreshed from the server on load.

* Validate that the Account section saves a new username into the session and shows server errors; that the password form checks its fields before calling the server, keeps this session signed in on success and shows a wrong password; that deleting the account can be cancelled, needs the password, shows a wrong password in the dialog, and logs out on success; that a user who must change their password sees only the choose a new password page; and that the admin page offers a password reset only for other approved users, confirms first and shows the temporary password once.

* Validate that the update dialog appears only when a new version is available, reloads into it, and can be dismissed.

* Validate push support detection (supported, unsupported, blocked, and iOS outside the Home Screen app), base64url key decoding, and subscribing/unsubscribing this device, including reusing an existing subscription and unsubscribing when the server had no record of it.

* Validate that the Your data section exports in each format and saves the file, reports a failed export, confirms before importing (and can be cancelled), shows the import result and replaced days, reminds the user to enable reminders on this device when the import turned them on, lists every server validation problem, and rejects a non-JSON file without calling the server.

* Validate that the Reminders section shows each unsupported notice; that turning reminders on asks for permission, subscribes and saves, and that a refused permission reverts the switch with an alert; that turning them off unsubscribes and saves; that it offers to enable an unsubscribed device and resaves a subscribed one; that times are added, edited, removed and limited to four; that the time zone offers the detected zone when it differs; and that the test notification is sent only while reminders are on.

### End-to-End Tests (Playwright)

* **Complete User Journey:**

  1. Register new user (the first user on a fresh database, so no approval is needed).

  2. Select required day rating (e.g., 8) and enter initial good/bad thoughts.

  3. Confirm creation of the parent day record, sub-entries, and update of the 30-day heatmap block color.

  4. Open day view and select a specific sub-entry to submit an appended note.

  5. Verify the appended note appears under the targeted sub-entry.

  6. Open the search page from the menu, search for the appended text and verify navigation back to the detailed day view.
* The journey runs first, so its user becomes the admin; the specs below run after it and log in as that admin.

* **User Administration:**

  * The admin approves a pending user (who becomes a `User` with a **Promote** button), then promotes them; the promoted user sees the Admin page on their next login.

  * The admin deletes a pending user: cancelling the confirmation keeps them, confirming removes them and their login is rejected.

  * Registering a pending account shows the approval notice, and logging in with it is rejected.

  * A standard user has no Admin menu item and is redirected to the today view from `/admin`.

  * The admin disables a user, whose login is then rejected; after enabling them they can log in again.

  * The admin demotes another admin who is signed in elsewhere; after a reload, that user has no Admin menu item.

  * The admin closes registration: the login page hides the register link and registering is rejected; reopening brings the link back. This spec runs after all the others, since it would break specs that register users.

* **Account:** A user changes their password and logs in with the new one; an admin resets a user's password, and the user logs in with the temporary password, must choose a new one, and then reaches the today view; a user deletes their account (after cancelling once) and can no longer log in.

* **Settings:** Changing the mode, color and reminder time zone applies the theme straight away and is saved to the account, so a fresh browser that logs in gets the same settings.

* **Browsing:** On a day view, the previous and next day links move between days; the history page has no search bar, opens on the current month with today colored by its rating, shows a heatmap range including today only when asked, and jumping to a date opens it.

* **Export & Import:** The admin exports their journal as JSON; a second, approved user imports it (confirming the overwrite warning) and sees the admin's rated day on their heatmap.
