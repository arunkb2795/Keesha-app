# Keesha — Product and Engineering Specification

Version: 1.1 handoff draft  
Date: 16 November 2026  
Primary platforms: Android and iOS  
Status: Ready for estimation and design; release decisions in section 16 remain open.

## 1. Purpose and confirmed requirements

Keesha is a private, personal expense tracker. Users should be able to record an everyday expense in seconds and understand their daily, weekly, and monthly spending against a monthly budget.

Confirmed by the product owner:

- Expo and React Native, with Android and iOS builds.
- Clerk authentication using Google or email and password only.
- Indian rupees (INR); display with Indian digit grouping and the ₹ symbol.
- Minimal interface with prominent monthly spending, bottom navigation, and a bottom-sheet expense form.
- Data isolated per authenticated user.
- Offline expense entry with automatic sync when connectivity returns.
- Useful empty, loading, error, and offline states.
- Neon PostgreSQL, Drizzle ORM, and Zod validation.
- Errors must never expose internal implementation details or secrets to clients.

Requirements marked **proposed** are working defaults, not additional confirmed requests. The team can estimate against these defaults and resolve the open decisions before release.

## 2. MVP scope

### Included

- Sign up, verify email, sign in, Google sign-in, password recovery, sign out, and account deletion.
- First-run setup: confirm timezone and optionally set a monthly budget.
- Add, view, edit, and delete manual expenses.
- Fixed expense categories and an optional note.
- Monthly budget setup and edits; previous months retain their own budgets.
- Day, week, and month views with totals, category breakdowns, and expense history.
- Date and category filters with paginated history.
- Local cache, durable offline mutation queue, and reconciliation across devices.
- Basic privacy information, support reference IDs, and operational monitoring.

### Deferred

Bank/UPI integrations, payment initiation, SMS reading, receipt scanning, recurring expenses, income, refunds/negative expenses, transfers, multiple currencies, custom categories, shared budgets, subscriptions, advertisements, AI advice, push reminders, and CSV import/export. These require separate scope decisions.

The app records spending; it does not move money. A working web preview is useful for development, but a production web product is not an MVP deliverable. Native offline behavior must be tested on actual Android and iOS builds.

## 3. Product rules

### Expenses

| Field | Rule |
| --- | --- |
| Amount | Required; ₹0.01–₹99,99,999.99; at most two decimal places |
| Category | Required in storage; preselected as Other so amount-only entry is possible |
| Date | Defaults to today in the account timezone; can be backdated; no future dates |
| Note | Optional plain text; trim whitespace; maximum 200 characters |
| Owner | Derived exclusively from verified authentication on the server |

Proposed categories: Food & Drinks, Groceries, Transport, Shopping, Bills, Health, Entertainment, Travel, Education, and Other. Use stable category IDs; labels can change without rewriting history. Category icons must always have text labels.

Store money as integer paise, never binary floating-point rupees. API monetary fields are integer paise. Parse the amount input as a decimal string using exact arithmetic. Blank, zero, negative, exponential notation, more than two decimals, and out-of-range values are rejected. Calculations and formatting must remain exact, including large aggregate totals.

Store the user-selected expense date as a PostgreSQL `date`, separate from UTC creation/update timestamps. This date determines its reporting period and must not shift when the user travels or the device timezone changes. The account timezone defaults to Asia/Kolkata, with confirmation during setup.

### Budgets and periods

- One positive monthly budget per user and calendar month, in paise, with the same maximum as an expense. No category budgets or rollover in MVP.
- Budget setup is optional. Without one, show spending and “Set monthly budget”; never show a fabricated ₹0 budget or divide by zero.
- Proposed: a default monthly amount applies from a selected effective month onward. Per-month overrides take precedence. Keep an effective-dated default history, so changing the default does not rewrite earlier months. Changing only the selected month creates an override.
- Budget editing presents two explicit choices: “This month only” and “This month and future months.” Historical overrides remain intact. Future overrides remain intact and are disclosed in the UI.
- Daily period: selected calendar date. Weekly period: Monday through Sunday. Monthly period: calendar month. All boundaries use the account timezone and inclusive start/exclusive end dates.
- `spent = sum(non-deleted expense amounts in the period)`.
- Monthly remaining is `budget - spent`. When negative, show “Over by ₹X”; retain the actual percentage even if a visual progress bar is capped at 100%.
- Daily guide = that month's budget divided by its number of days. Weekly guide = sum of daily guides for the seven dates, handling weeks crossing months or years. Label these as guides derived from the monthly budget, not separate budgets.
- Round a guide once, to the nearest paise, after exact calculation. If any covered month lacks a budget, show the period's spending and “Budget guide unavailable”; do not silently treat missing budget days as zero.
- For the current week/month, total spending means period-to-date; the comparison guide is for the full selected period and must be labeled accordingly. Future period navigation is disabled in MVP.
- Local pending mutations appear immediately in local totals with a “Pending sync” indicator. Reconciliation must replace a pending item rather than add a duplicate. Server totals remain authoritative for synced records.

## 4. Screens and navigation

Use Expo Router. Routes live in `src/app/`; components, domain rules, state, data access, and server code live outside the route directory. Three bottom tabs: **Home**, **History**, and **Settings**. A prominent thumb-reachable **Add expense** action remains available on Home and History.

### Authentication

- Welcome screen: Keesha name, one-sentence purpose, “Continue with Google,” and email/password sign-in with a sign-up link.
- Email sign-up requires verification before app access. Provide password visibility toggle, password-manager/autofill support, field validation, and Clerk's configured password policy.
- Handle verification, expired/incorrect codes, resend cooldown, forgotten password, reset completion, and any required Clerk session tasks.
- Google cancellation returns quietly to sign-in. Provider/network failures show a safe message and retry action.
- Do not enable phone, username-only, anonymous, Apple, or other providers without a product decision. The possible Apple distribution conflict is recorded in section 14.
- Let Clerk manage verified identity linking. Never merge accounts in application code solely because email strings match. Same-account Google/email access must be tested with the chosen Clerk settings.
- Initial authentication requires internet. Returning users can access their own local data offline under the rules in section 9.

### First-run setup

Show INR currency and the account timezone. Offer a monthly budget with “Skip for now.” Successful setup opens Home. Setup calls must be idempotent and safe to resume after an interrupted request.

### Home

Above the fold: current month, large monthly spent value, budget and remaining/over-budget amount, and Add expense. Below: Day/Week/Month selector, selected date range with previous/next controls, spending total, derived guide where available, simple accessible category breakdown, and recent expenses.

The monthly headline remains clearly labeled when the lower period selector changes. Tapping a category opens filtered History. Tapping a recent expense opens its details/edit sheet. Use calm language; no guilt-based warnings or excessive charts.

### Add/edit expense bottom sheet

1. Open with amount focused and a decimal numeric keyboard.
2. Show amount, compact category choices, date defaulted to today, optional expandable note, and a sticky Save action above the keyboard/safe area.
3. A returning user can enter an amount and save without opening another screen. Target: ordinary entry in under 10 seconds during usability testing.
4. Validate fields inline. Disable repeated submission while the local save transaction is running.
5. Commit the expense and outbox entry atomically before showing “Saved” online or “Saved on this device · Pending sync” offline.
6. Retain the draft on validation/network failure. Warn before discarding a non-empty unsaved draft; support Android back, sheet drag, and a visible close control consistently.
7. Edit prepopulates fields. Delete requires confirmation and follows the same offline queue rules.

### History

Group expenses by date with daily totals. Default to current month; allow a date range and category filter. Show amount, category, note excerpt, and pending/failed/conflict status. Use stable cursor pagination; retain scroll position when returning from details. No gesture is the only way to edit or delete.

### Settings

Show account identity, monthly budget settings, timezone, sync status, last successful sync, manual retry, privacy notice, support information, app version, sign out, and delete account. INR is fixed in MVP. Changing timezone affects “today” and period navigation, not stored expense dates.

### Accessibility and mobile layout

Use at least 48 logical-pixel touch targets, safe-area padding, reachable primary controls, scalable text, sufficient contrast, screen-reader labels, and reduced-motion support. Status must not rely on color alone. Support small phones, notches, keyboard avoidance, and system light/dark appearance. Dismissed sheets restore focus to the launching control.

## 5. UI state contract

| State | Required behavior |
| --- | --- |
| First load | Stable skeleton; no misleading zero balance while data is unknown |
| No expenses | “Your first expense starts here” with Add expense |
| No budget | Show actual spending and Set monthly budget |
| No filtered results | Explain the active filters; offer Clear filters |
| Refresh | Keep existing content visible; show a small refresh indicator |
| Offline with cache | Persistent unobtrusive offline banner, last-sync time, local data and pending count |
| Offline without cache | Explain that data is unavailable on this device; no fake empty history |
| Save pending | Entry visible with pending marker and included once in local totals |
| Sync failed | Keep the entry; explain whether retry or correction is needed |
| Initial fetch failed | Friendly message and Retry; preserve navigation |
| Session expired | Pause sync, preserve the same user's local queue, request sign-in |
| Conflict | Show local and latest server values with explicit resolution choices |

Use screen-level error boundaries and recoverable navigation. An unhandled component error must not strand the user on a blank screen.

## 6. Architecture and project boundaries

```text
Expo / React Native app
  ├─ Clerk authentication and protected Expo Router screens
  ├─ Domain validation and exact money/date calculations
  ├─ Per-user encrypted local store + durable outbox
  └─ HTTPS authenticated API
       ├─ Clerk token verification and account status checks
       ├─ Zod request validation + ownership enforcement
       ├─ Drizzle repositories / transactions
       └─ Neon PostgreSQL
```

Use a separately deployed TypeScript HTTPS API as the proposed backend boundary. Hosting provider and HTTP framework remain team choices; select a supported runtime compatible with the chosen Neon driver and transaction requirements. API route files must not become client screens. Share pure DTO/Zod/domain code through a separate module/package with no server imports.

- Mobile clients never connect directly to Neon and never contain a database URL, Clerk secret key, Google client secret, migration credential, or privileged API token.
- Only the Clerk publishable key, public API URL, and other explicitly public configuration may enter the app bundle. Treat `EXPO_PUBLIC_*` as public.
- Use Clerk's supported Expo SDK and secure native token cache for the installed version. Do not store tokens in ordinary unencrypted application storage.
- Use a local database suitable for durable writes and encrypted storage; validate an Expo SDK 58 compatible solution in the first implementation milestone. Keep encryption keys in platform secure storage, not in the database or source tree. Do not claim a basic unencrypted SQLite database satisfies this requirement.
- Use a deliberately small state/data stack. Select the bottom-sheet and local persistence libraries after checking Expo compatibility; do not introduce dependencies solely to mirror this spec.
- Prefer recommended Expo modules. Pin and document compatible versions. The current repository uses Expo ~58.0.25, React 19.3.0, React Native 0.88.1, Expo Router, and npm/package-lock.json.
- Follow AGENTS.md: versioned Expo docs, Expo-compatible installation commands, no manual generated native-directory edits, lint and typecheck as completion gates.

### 6.1. Drizzle + Neon implementation baseline

Follow [Drizzle's new Neon project guide](https://orm.drizzle.team/docs/get-started/neon-new) for backend database setup. Apply its steps within a separate `server/` package; keep the Expo route tree free of database modules.

**Setup sequence:** provision a Neon database, configure backend dependencies and environment, initialize the driver, define the Keesha tables, configure Drizzle Kit, apply migrations, then run a development smoke script. Use the domain schema in section 8 instead of the tutorial's sample users table.

| Backend package group | Dependencies |
| --- | --- |
| Runtime | `drizzle-orm@rc`, `@neondatabase/serverless`, `dotenv`, `zod` |
| Development | `drizzle-kit@rc`, `tsx`, backend TypeScript tooling |

The linked guide currently targets the `rc` channel. Resolve and lock exact compatible versions of ORM, Kit, and Zod together; record them in the handoff. Do not mix stable-version examples with RC APIs. Evaluate the selected RC before production and document any move to stable. Keep these dependencies in the backend package.

Proposed backend layout, adapting the guide to Keesha:

```text
server/
  src/db/schema.ts       # Keesha PostgreSQL tables and constraints
  src/db/client.ts       # server-only Drizzle initialization
  src/index.ts           # API entry point
  src/scripts/db-smoke.ts
  drizzle/               # generated migrations and schema snapshots
  drizzle.config.ts
  .env                   # ignored; development backend secrets only
  .env.example           # variable names/placeholders only
  package.json
  tsconfig.json
```

**Environment and connection:** use backend-only `DATABASE_URL` from Neon's connection details. Validate it at startup with Zod; terminate with a safe configuration error if absent or invalid. Load local environment configuration before constructing the client; production secrets come from the host's secret manager. Never log the URL or expose it through Expo public variables. Use runtime-role credentials in the API; migration jobs inject separately privileged credentials into their own `DATABASE_URL`.

Initialize the baseline connection through `drizzle-orm/neon-http` with the validated URL, or use the guide's explicit `neon()` client from `@neondatabase/serverless` passed to Drizzle. Keep initialization in `server/src/db/client.ts` and export it only to backend modules. Follow the [Neon driver documentation](https://orm.drizzle.team/docs/connect-neon) for installed-version signatures.

**Transaction requirement:** HTTP suits individual queries and non-interactive transactions. If sync processing needs reads and conditional decisions within a transaction, use the documented `drizzle-orm/neon-serverless` WebSocket path with a compatible backend runtime. Do not assume HTTP supports an interactive transaction callback. Before freezing the driver, prove atomic expense/version, receipt, and sync-event writes under concurrent requests and rollback. The driver choice must preserve section 9's guarantees; multiple unrelated HTTP calls do not constitute an atomic mutation.

### 6.2. Schema, migrations, and database verification

Set these values in backend `drizzle.config.ts`, loading local environment first and using Drizzle Kit's `defineConfig`:

| Configuration key | Value |
| --- | --- |
| `schema` | `./src/db/schema.ts` |
| `out` | `./drizzle` |
| `dialect` | `postgresql` |
| `dbCredentials.url` | Validated backend `DATABASE_URL` for the intended target/role |

Declare PostgreSQL tables with `drizzle-orm/pg-core`. Preserve Keesha's ownership, exact-money, date, version, and uniqueness constraints rather than copying sample identity/email fields.

Run the following from `server/`, using its pinned local tools:

```sh
npx drizzle-kit generate
npx drizzle-kit migrate
npx tsx src/scripts/db-smoke.ts
```

[Generate](https://orm.drizzle.team/docs/drizzle-kit-generate) produces migration artifacts from schema changes; [migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate) applies outstanding migrations and records their application. Commit SQL and snapshots, review destructive changes, rehearse on an isolated Neon development/staging target, and run production migrations through one controlled deployment job. API startup and mobile startup must not execute migrations. Keep schema changes compatible with supported installed app versions.

The guide also offers `npx drizzle-kit push` for rapid experimentation. For Keesha, restrict that shortcut to disposable development databases; use reviewed migration files for shared environments. Do not mix push-based changes into the migration history of a deployed database.

The development smoke script must exercise create/read/update/delete using synthetic, owner-scoped fixtures and clean up afterward. Do not copy tutorial logging of returned records into production. Verify migrations against both an empty database and the previous schema, repeat migrate to check no pending changes are reapplied, and confirm database failures follow section 11's safe error mapping. Test Zod refinements, ownership isolation, transaction rollback, and idempotency separately; a successful connection alone does not establish those guarantees.

## 7. Authentication and authorization

Send a Clerk session token over HTTPS in the Authorization bearer header. The API must verify signature, trusted issuer, expiration, and applicable audience/authorized-party constraints using the supported Clerk backend SDK. Decoding a JWT without verification is insufficient. Follow Clerk's native-token rules rather than assuming browser-origin claims are always present.

Every protected request must derive the owner from the verified Clerk subject. Reject client-supplied ownership fields. UI route guards are for navigation and never substitute for API authorization.

- Every record lookup, update, delete, list, summary, sync operation, and settings change is scoped by authenticated owner.
- Query `id AND owner_id` together; return the same 404 for missing records and another user's records.
- A local application user maps uniquely to a Clerk user ID. Avoid copying email/name into Neon unless a specific product need appears.
- All user-owned tables and foreign references must enforce consistent ownership. Test isolation through list filters, cursor pagination, summaries, idempotency replay, and sync, as well as single-record endpoints.
- Use a least-privilege runtime database role. Migration privileges are separate. If PostgreSQL RLS is added, test it with the actual Neon connection/transaction strategy; do not assume it is automatically active.
- Verify signatures on any Clerk webhooks; deduplicate delivery. Deleted or deletion-pending accounts must be blocked from reads, writes, and queued mutation replay.
- Clear in-memory state immediately on sign-out/account switch. Partition persistent caches, drafts, outboxes, and encryption keys by authenticated account. Account B must never see account A's content, even briefly.

## 8. Data model and validation

All table changes use reviewed Drizzle migrations. Use UTC `timestamptz` for operational timestamps; keep expense dates and budget month keys as calendar values.

| Table | Required fields and constraints |
| --- | --- |
| `app_users` | UUID PK, unique Clerk user ID, lifecycle status, timestamps |
| `user_settings` | Owner PK/FK, currency fixed to INR, validated IANA timezone, version, timestamps |
| `expenses` | Client-generated UUID PK, owner FK, amount_paise bigint, category ID, expense_date date, nullable note, version >= 1, created_at, updated_at, deleted_at |
| `budget_defaults` | UUID PK, owner FK, effective_from month-start date, positive amount_paise, version, timestamps; unique(owner, effective_from) |
| `monthly_budgets` | UUID PK, owner FK, month-start date, positive amount_paise, version, timestamps; unique(owner, month) |
| `mutation_receipts` | Owner + mutation UUID unique, canonical request hash, safe result/status, timestamps |
| `sync_changes` | Owner, ordered change revision, entity type/ID, version, deletion marker; committed atomically with changes |
| `account_deletion_jobs` | Owner unique, status, retry metadata, timestamps; no expense payloads |

Indexes: expenses on `(owner_id, expense_date DESC, id DESC)` and category-filter access paths; budget effective-date lookup; changes on `(owner_id, revision)`; receipts on owner/mutation ID. Use actual query plans before adding more indexes.

Database checks must enforce amount ranges, supported currency/category values, month-start dates, note length, and uniqueness. Foreign keys and transactions protect integrity; Zod does not replace database constraints. A bigint field must not be converted unsafely to a JavaScript number. The API's supported numeric limits and aggregate overflow handling must be explicit and tested.

Zod runs at every untrusted boundary: API body, query parameters, path parameters, local persisted/outbox data, and remote response decoding. Client validation improves UX; the server independently validates everything. Maintain operation-specific create/update schemas with strict allowed fields, bounds, date formats, and maximum page size (100). Validate business rules after parsing, including no future expense date and optimistic concurrency.

Generate baseline schemas from Drizzle when supported, then explicitly omit protected fields and refine domain constraints. Do not expose a database insert schema directly as the public API contract. Use the mutually compatible, locked Drizzle/Zod versions selected in section 6.1; confirm schema-generator imports against that exact release channel and refine the generated schemas for Keesha.

## 9. Offline persistence and synchronization

Offline creates, edits, and deletes are required for expenses. Proposed: budget/settings changes require internet in MVP; cached budgets remain visible offline.

### Local durability

- A local database transaction writes the expense overlay and outbox operation together. Show success only after durable commit.
- Each mutation has a UUID, entity UUID, owning account, operation type, validated payload, base server version, and local creation time. Never queue authentication tokens.
- Restarting the app or killing it after save must retain pending data. Disk-full, encryption-key, or transaction failures must say “Couldn't save on this device” and retain the draft.
- Serialize operations per entity. A local create followed by edits can be compacted before first dispatch; an undispatched create followed by delete can be cancelled. Never alter the payload of a mutation that might already have reached the server.

### Retry and delivery

1. After account restoration, foregrounding, manual retry, or connectivity recovery, verify the current account and obtain a usable token.
2. Push pending operations in entity order. Process each atomically with its receipt and change event. A batch can have per-operation results; dependent operations stop after their predecessor fails.
3. The API keys receipts by owner + mutation UUID. A retry of the same canonical payload returns the original result. Reusing an ID with a different payload returns a safe conflict.
4. If the response is lost after commit, replay must not create or apply the operation twice. Keep mutation receipts for the account lifetime in MVP; a later cleanup policy must preserve replay safety before being introduced.
5. Pull changes using an opaque per-user cursor and reconcile server records with pending overlays. Acknowledged entries replace pending versions exactly once. Refresh summaries after reconciliation.
6. Retry transient connectivity, timeout, 429, and 5xx failures with exponential backoff and jitter; honor Retry-After. Avoid tight loops. Retry foreground reads at most three times before showing a recoverable state; durable outbox retries continue on later sync opportunities.
7. Refresh authentication once for 401; if it remains invalid, pause and request sign-in. Do not retry invalid input, forbidden operations, or conflicts blindly.

Background execution is best effort; do not promise sync while the OS has suspended or terminated the app. Display the pending count and last successful sync time.

### Conflicts and deletion

- The server uses incrementing entity versions and conditional writes, not client clocks. Updates/deletes require the base version.
- On stale version, return 409 and a safe current-record representation accessible only to its owner. Preserve the local candidate.
- Offer “Use latest version” or “Apply my changes”; the latter submits a new mutation against the newly fetched version. It may conflict again. Never overwrite silently.
- Remote deletion versus a pending edit offers discard or “Save as new expense.” Never resurrect the deleted ID automatically.
- Deleted records produce tombstones. Proposed retention: 90 days for sync history/tombstones. An expired cursor receives `SYNC_RESET_REQUIRED`; fetch a consistent fresh snapshot and replay preserved pending overlays without duplicates or resurrection.
- Generate sync revisions in committed per-user order and keep snapshot/change cursor boundaries consistent. A naive sequence allocated before commit must not allow late commits to be skipped.

### Offline account access and sign-out

A previously authenticated user can access their own cached data and queue expenses when offline. A cached identity does not authorize server requests; revalidate on reconnect. First-time users must sign in online. Do not switch accounts offline.

When signing out with pending changes, offer sync first, cancel sign-out, or explicitly discard pending changes and sign out. Explain the local loss before discarding. Completed sign-out wipes that user's local expense cache, drafts, queue, and keys. Server session revocation is completed when reachable; local access is locked immediately. Document that remote deletion/revocation cannot instantly erase an offline device; clear data at the next authenticated contact.

## 10. API contract

Use versioned JSON endpoints under `/v1`. Exact handler/framework syntax belongs in implementation, but the following behavior is required.

| Endpoint | Behavior |
| --- | --- |
| `GET /me` | Application profile, settings, setup and account lifecycle status |
| `PATCH /me/settings` | Versioned validated timezone update |
| `GET /expenses` | Owned history; start/end dates, category, cursor, bounded limit |
| `GET /expenses/:id` | Owned non-deleted expense or 404 |
| `GET /summary` | Day/week/month range totals, category totals, resolved budget/guide, as-of revision |
| `GET /budgets` | Resolved monthly budgets and applicable default history for a bounded range |
| `POST /sync/mutations` | Validated create/update/delete operations with per-operation acknowledgments |
| `GET /sync/changes` | Ordered owned changes and opaque continuation cursor |
| `GET /sync/snapshot` | Consistent paginated snapshot with a matching change cursor boundary |
| `PUT /budgets/:month` | Idempotent versioned monthly override |
| `POST /budgets/defaults` | Idempotent effective-dated budget default change |
| `POST /me/deletion` | Reauthenticated, idempotent account deletion request; return job status |

Use the same mutation pipeline for online and offline expense writes. Budget/settings writes also require mutation IDs and version checks, even though they are online-only. Success DTOs expose only needed fields; never return raw database rows with internal metadata indiscriminately. Define request/response schemas and representative examples in an OpenAPI contract during milestone 1.

List cursors must be owner-bound and validated; sorting uses expense date and UUID as a deterministic tiebreaker. Bound date ranges and request sizes. Production rate limits must cover reads, mutations, and expensive summaries; proposed starting limits are 120 read requests and 60 mutation requests per authenticated user per minute, with at most 50 operations per sync batch and additional infrastructure abuse limits.

## 11. Safe errors and observability

Every API failure uses a centralized error mapper. Example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Check the highlighted fields.",
    "fieldErrors": { "amount": "Enter an amount greater than zero." },
    "requestId": "opaque-support-reference",
    "retryable": false
  }
}
```

`fieldErrors` is optional and contains only allowlisted public field names and curated messages. Use the same envelope for gateway, parsing, and handler errors where the application controls the response. Native clients must also handle non-JSON proxy failures safely.

| HTTP/code | Client behavior |
| --- | --- |
| 400 `INVALID_REQUEST` | Show safe request correction message |
| 401 `AUTH_REQUIRED` | Refresh once, then sign-in prompt |
| 403 `ACTION_NOT_ALLOWED` | Explain action unavailable without exposing account internals |
| 404 `NOT_FOUND` | “This expense is no longer available” |
| 409 `VERSION_CONFLICT` | Preserve local work; open conflict resolution |
| 409 `SYNC_RESET_REQUIRED` | Rebuild cache using snapshot; preserve pending work |
| 422 `VALIDATION_ERROR` | Display curated field errors; allow correction |
| 429 `RATE_LIMITED` | Safe wait message; honor Retry-After |
| 500 `INTERNAL_ERROR` | “Something went wrong. Try again.” plus support reference |
| 503 `SERVICE_UNAVAILABLE` | Cached mode where available; retry later |

Never send SQL, schema/table names, connection strings, stack traces, exception objects, raw Zod diagnostics, raw Clerk/provider responses, tokens, credentials, internal hostnames, or infrastructure details to clients. Allowlisted auth error codes map to useful messages for invalid credentials, verification, password policy, and recovery; unknown provider errors receive a generic fallback. Authentication/recovery copy must avoid unnecessary account-existence disclosure.

Server logs contain request ID, route template, status, duration, safe error code, and redacted diagnostic context. Do not log Authorization headers, cookies, passwords, verification codes, connection strings, expense notes, raw request bodies, or financial amounts. Avoid PII in URLs and log query strings. Crash reporting uses the same redaction rules, disables sensitive screenshots/session replay, and separates environments. Restricted server diagnostics can retain a sanitized stack; access and retention are controlled.

Proposed log retention is 30 days. Track API availability, latency, error rate, queue age, sync success/conflict rates, and failed deletion jobs using non-content metadata. Alert on sustained server errors and stuck deletion jobs. A support reference must help operators investigate without users sharing expense details.

## 12. Privacy, deletion, and operations

- Encrypt transport and configure encrypted managed storage/backups. Limit cloud-console and database access; no production financial data in fixtures, screenshots, or development logs.
- Request no contacts, SMS, location, microphone, or photo permissions in MVP.
- Publish a plain-language privacy notice describing Clerk, the API host, Neon, local offline storage, diagnostics, deletion, and support contact.
- Account deletion requires online connectivity, recent reauthentication, confirmation, and explicit treatment of unsynced local data. Disable writes immediately once accepted.
- Use a durable retryable deletion job to remove expenses, budgets, settings, receipts, and sync content, then remove the Clerk identity/revoke access. Cross-service steps cannot be one database transaction; retain minimal job state until completion. Show pending deletion if work remains, rather than claiming instant completion.
- Verified Clerk account-deletion webhooks must trigger the same cleanup if deletion happens outside the app. Prevent stale sessions or webhooks from recreating a deleted account.
- Proposed operational target: purge live application data within seven days of an accepted deletion request. Select and publish an actual backup expiry policy before release. Restores must reapply deletion markers/jobs so deleted users' data is not restored to service.
- Configure Neon backups/recovery for the selected plan and test a restore. Proposed recovery targets: RPO 24 hours, RTO 24 hours; confirm the purchased plan and runbook can meet them.
- Choose API/database regions deliberately, preferably close to the primary Indian user base where provider availability allows. Do not promise India-only residency without verifying all providers and backups.
- Separate development/staging/production Clerk instances, Neon databases or isolated branches, API configuration, and signing environments. Never point an unreviewed build at production by default.

## 13. Performance and quality targets

Proposed targets measured on an agreed mid-range Android device and supported iPhone release build:

- Add-expense sheet usable within 300 ms after tapping Add.
- Durable local expense save within 500 ms at p95 under normal storage conditions.
- Cached Home usable within two seconds of launch after authentication state is restored.
- Common API reads below one second p95 when warm; monitor cold-start separately and show loading states.
- Expense list remains responsive with 10,000 owned expenses through local indexing, virtualization, and server pagination.
- Foreground sync starts promptly after connectivity restoration and never blocks expense entry.

Choose minimum OS versions from the actual Expo SDK 58 support matrix and record them in the release README. Web success alone is not evidence of native compatibility.

## 14. Builds and distribution

Use EAS cloud builds with development, preview, and production profiles. Record stable Android package and iOS bundle identifiers before creating production credentials. Newly added native modules require a compatible development build; Expo Go is not the final verification environment.

- **Android:** provide a signed release/preview APK for direct installation on compatible devices. Users may need to allow installation from that source. An AAB is for store distribution, not the shared installable APK. Preserve the signing key and package identity so upgrades can retain app data.
- **iOS:** there is no APK equivalent that anyone can install just by possessing the file. Proposed personal testing path: EAS ad hoc builds for registered devices with appropriate Apple Developer membership and provisioning. TestFlight/App Store are alternative distribution paths with their own review and operational requirements. Do not promise unrestricted IPA installation.
- **Google/email-only constraint:** keep this product requirement. Before choosing an App Store release, assess Apple's Login Services guideline 4.8; Google login may require an equivalent privacy-preserving login option such as Sign in with Apple unless an applicable exception exists. Email/password alone should not be assumed to satisfy that rule. Resolve with the product owner; do not silently add another provider or promise store approval.
- Native Google OAuth credentials, approved callback/deep-link URLs, application scheme, and production redirect handling must be configured and tested in signed Android/iOS builds. Do not place provider client secrets in mobile configuration.
- OTA updates must respect native runtime compatibility and environment separation. Keep the API backward-compatible with supported installed builds; do not force upgrades that strand unsynced local expenses.

This section is based on the current Expo internal-distribution documentation and Apple guidance linked in section 17; recheck them when releasing.

## 15. Delivery milestones and acceptance criteria

### Milestone 1 — Foundation

Deliver the sections 6.1 and 6.2 Neon setup, locked dependency versions, tested transaction-capable driver, version/compatibility checklist, chosen backend host/runtime, reviewed Drizzle migrations, API schemas/OpenAPI examples, environment template with no secrets, Clerk development configuration, and a proven encrypted local storage approach. Prove authenticated API calls from signed Android/iOS development builds. Resolve the repository's existing lint setup and TypeScript errors before implementation is considered green.

### Milestone 2 — Online experience

Deliver authentication/recovery, setup, Home, History, bottom-sheet CRUD, budget defaults/overrides, summaries, accessible states, and server authorization. Demonstrate correct totals and user isolation.

### Milestone 3 — Offline and resilience

Deliver durable queue, replay-safe mutations, restart recovery, cache reconciliation, conflicts, sign-out safeguards, deletion jobs, safe errors, and redacted monitoring.

### Milestone 4 — Release handoff

Deliver signed test builds, device QA evidence, migration/deployment/rollback instructions, backup restore evidence, privacy/support details, known limitations, and an installation guide for each chosen distribution path.

### Release acceptance tests

1. A new user can sign up by email/password, verify, sign out/in, recover a password, or authenticate with Google. No unauthorized provider appears.
2. With amount-only entry, Other/today are saved correctly in under ten seconds in a usability session. Keyboard, back button, sheet dismiss, and draft recovery work on both platforms.
3. ₹0.10 + ₹0.20 totals exactly ₹0.30. Invalid amounts, excessive precision, and unsafe integers are rejected at client/server boundaries.
4. Day/week/month totals, Indian formatting, leap years, month/year boundaries, cross-month weeks, missing budgets, overrides, and over-budget states are correct. A timezone change never shifts historical expense dates.
5. In airplane mode, create/edit/delete expenses, kill/relaunch, reconnect, and verify no lost or duplicate records. Simulate a server commit followed by lost response and concurrent double submission.
6. Two devices editing/deleting the same expense produce the specified conflict choices; no silent overwrites or resurrection occur. Test expired cursors and snapshot reconciliation with pending writes.
7. User A cannot read/change user B's expenses, budget, settings, summaries, cursors, receipts, or sync records by tampering with IDs, payloads, or requests. Expired, forged, wrong-issuer, and malformed tokens are rejected.
8. Sign-out/account switching cannot display previous-user data. Pending work prompts before loss. Session expiry pauses sync without discarding work.
9. Simulate Neon/Clerk/API outages, timeouts, 429, malformed responses, disk-full, local write failure, and unexpected exceptions. Drafts remain usable and all client errors are safe.
10. Inspect production responses, bundles, logs, and crash reports for secrets and sensitive content. Passwords, tokens, notes, raw provider errors, and SQL details must be absent.
11. Account deletion stops further writes, completes retryable cross-service cleanup, clears local data, and prevents stale mutation replay. Restore rehearsal respects deleted accounts.
12. Complete screen-reader, large-text, contrast, small-screen, keyboard, and reduced-motion QA on Android/iOS. Verify Google redirect and password recovery in signed builds.
13. Run `npx expo lint` and `npx tsc --noEmit`, plus relevant domain/API/integration tests and Expo dependency diagnostics. All required checks pass before release. Use `bunx` only if the project later adopts a Bun lockfile.

## 16. Decisions and information still needed

These do not prevent reviewing this spec. Resolve them before the corresponding build/release milestone.

| Decision | Working proposal / information required |
| --- | --- |
| iOS audience/distribution | Registered personal devices via ad hoc initially; owner must choose ad hoc, TestFlight, or App Store |
| Apple login policy | If App Store is chosen, resolve guideline 4.8 compatibility with Google/email-only requirement |
| Backend hosting | Team selects TypeScript API host and region; prove the section 6.1 driver/transaction strategy and confirm service budget |
| Accounts and credentials | Owner supplies access through secret management to Clerk, Neon, Expo/EAS, Google OAuth, and Apple Developer resources; never paste secrets into this spec |
| Budget behavior | Confirm effective-dated recurring default + per-month overrides, no rollover, Monday week start |
| Offline settings | Confirm expenses fully editable offline; budget/settings edits online-only in MVP |
| Local privacy | Approve encrypted cache approach after compatibility spike; optional biometric app lock is outside MVP |
| Branding | Proposed clean light/dark interface; logo, accent color, app icon, and support contact still needed |
| Operations | Confirm backup retention, recovery targets, diagnostic retention, privacy wording, and deletion support owner |

## 17. Reference documentation

Implementation must recheck version-specific APIs and compatibility of the selected package versions. Links were reviewed while preparing this specification; architectural and UX choices above are Keesha requirements/proposals, not promises made by providers.

- [Expo SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/)
- [Expo documentation index and API corrections](https://docs.expo.dev/llms.txt)
- [Expo Router introduction](https://docs.expo.dev/router/introduction.md)
- [Expo internal distribution: Android APK and iOS provisioning](https://docs.expo.dev/build/internal-distribution/)
- [Clerk Expo quickstart](https://clerk.com/docs/expo/getting-started/quickstart)
- [Clerk session-token verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification)
- [Primary database setup guide: Drizzle + Neon, new project](https://orm.drizzle.team/docs/get-started/neon-new)
- [Drizzle Neon drivers and transaction considerations](https://orm.drizzle.team/docs/connect-neon)
- [Drizzle Kit migration generation](https://orm.drizzle.team/docs/drizzle-kit-generate)
- [Drizzle Kit migration application](https://orm.drizzle.team/docs/drizzle-kit-migrate)
- [Neon with Drizzle](https://neon.com/docs/guides/drizzle)
- [Drizzle Zod integration; verify selected-version imports](https://orm.drizzle.team/docs/zod)
- [Apple Login Services guideline 4.8 and privacy/account guidance](https://developer.apple.com/app-store/review/guidelines/#login-services)
- [Apple ad hoc provisioning](https://developer.apple.com/help/account/provisioning-profiles/create-an-ad-hoc-provisioning-profile/)
