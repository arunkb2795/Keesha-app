# Keesha expense API

Run the Expo app and the API as separate processes. The API uses Node.js 22.15+ with Hono. Neon Postgres connections stay on the server. Drizzle uses the Neon WebSocket driver so an expense, its replay receipt, and its sync event can commit in one interactive transaction.

## Configuration and commands

Install the Expo package and the server package from the project root.

```sh
npm ci
npm ci --prefix server
```

Set `EXPO_PUBLIC_API_URL` to the API's HTTPS base URL alongside your Expo Clerk publishable key. The API reads `server/.env` first and can also read the Neon CLI's root `.env.local` or `.env`. Service credentials injected by the host take precedence. See `server/.env.example` for the Clerk, cursor, and database settings. Use the exact Clerk issuer, and configure authorized parties for browser clients. Native session tokens can omit the authorized-party claim.

Run the following from `server/`. Drizzle Kit prefers the direct `DATABASE_URL_UNPOOLED` from Neon. The API uses the pooled `DATABASE_URL` with a restricted runtime role. The smoke tests need a direct database URL with fixture cleanup permissions. Use a development branch for rehearsal.

```sh
npm run db:migrate
npm run db:smoke
npm test
npm start
```

With the local API running and a Clerk development key configured, `npm run db:smoke-http` uses two temporary Clerk users to exercise authenticated expense creation, retry and isolation through HTTP. Supply the direct owner connection as `DATABASE_URL` to the smoke process so it can remove fixtures. Set `HOST=0.0.0.0` when deploying the API behind an HTTPS proxy.

From the project root, `npm run build` typechecks the API and Expo app and exports the Expo web build. The app uses the authenticated API when there is a connection.

## Android preview builds

The `expenses` Neon Function is declared in the root `neon.ts`. Deploy it with `neon deploy --env <server-env-file> --no-env-pull` using a gitignored file containing the Clerk and cursor settings above and `KEESHA_DATABASE_URL` set to the restricted, pooled database connection. Use the function's HTTPS invocation URL as `EXPO_PUBLIC_API_URL` on the Expo project's `preview` environment. Build a new APK after changing that variable so Expo includes it in the app bundle.

Set `KEESHA_SMOKE_API_URL` when running `db:smoke-http` to test the deployed endpoint instead of the local server.

## Expense endpoints

All endpoints require a Clerk session bearer token.

- `GET /v1/categories` returns the shared defaults and the authenticated account's custom categories.
- `POST /v1/categories` accepts `{ "id": "<UUID>", "name": "Pets", "icon": "pet" }`. Custom names are trimmed, limited to 12 characters, and unique without regard to case within the account or against defaults. The server validates icons against the shared icon catalog. Retry with the same ID and payload after a connection failure.
- `POST /v1/categories/:id` accepts `{ id, name, icon, previousName, previousIcon }`. It checks the previous values for conflicting edits and accepts identical retries. Custom categories update in place; built-in categories save account-specific names and icons in `category_preferences`. Category IDs, expense amounts and expense links stay unchanged. History resolves the personalized category labels and icons. Names must be unique within the effective account catalog; existing longer built-in names can be kept for icon-only edits.

- `POST /v1/sync/mutations` accepts a batch of up to 50 create or update operations. For example, send `{"operations":[{"mutationId":"16d45cc9-dff1-40d8-9919-d64c14644a11","operation":"create","expense":{"id":"5dca8d67-8d67-4d61-baa8-6d7cceea9d9c","title":"Tea","amountPaise":1250}}]}`. The server defaults creates to Other and today's Asia/Kolkata date. A successful result includes the mutation ID and saved expense. Use the same mutation ID and payload when retrying.
- An `update` operation requires `expense: { id, version, title, amountPaise, categoryId, expenseDate }`. Use the version returned by `GET /v1/expenses/:id`; stale updates return a `VERSION_CONFLICT` result. Updates preserve notes, increment the expense version and account sync revision, and write a sync event and replay receipt in the same transaction. Only the owner can edit an active expense or select one of their available categories.
- `GET /v1/expenses` returns owned expenses, newest expense date first, then newest creation time within each date, with the ID breaking exact timestamp ties. Each item includes its UTC `createdAt` timestamp. The signed continuation cursor preserves timestamp microseconds. Optional filters include `start` (inclusive), `end` (exclusive), and `categoryId`. The page limit defaults to 30 and caps at 100. Pass the same filters with the cursor to read the next page. Cursors from the earlier ID-only ordering must be refreshed.
- `GET /v1/expenses/:id` returns an owned, active expense or 404.
- `GET /v1/expenses/monthly-summary` defaults to the current Asia/Kolkata calendar month. Pass `month=YYYY-MM-01` for an earlier month. The response includes the selected and preceding month totals and selected-month category totals.
- `GET /v1/expenses/daily-summary?date=YYYY-MM-DD` returns the owner's total and category totals for one day. Summary amounts are decimal strings in paise so aggregates retain integer precision.

Daily and monthly category totals are ordered by the most recently created active expense in each category within the selected period. The app displays these categories first, followed by unused categories in their usual order.

Expense list responses also include `dateTotals`, with `{ date, totalPaise }` for each date in the returned page. Each total covers all active expenses on that date matching the authenticated owner and selected category, including expenses beyond the current page. Both Recent transactions and History default to All categories and use the API's `categoryId` filter. Their date headers display these complete filtered daily totals.

The `expense_categories` table holds all active category definitions, with `owner_id IS NULL` for shared defaults. The category migration copies the original default catalog without changing IDs, preserves existing expense references, and carries forward the existing application's read/insert access. The original `categories` table remains only as a migration source. Custom categories can only be listed or used by their owner.

New expenses require a title and can include an optional note. The API stores the name, when available, and verified primary email from Clerk when it creates the corresponding application user. Ownership always uses the Clerk user ID mapping. Dates use PostgreSQL `date`. Individual expenses are bounded at 999,999,999 integer paise, which the API can represent exactly with a JavaScript number. Future aggregate queries should retain PostgreSQL's exact sum as a bigint or decimal string.

## Versions and migrations

`package-lock.json` pins Drizzle ORM and Kit to `1.0.0-rc.5`, Neon Serverless to `1.2.1`, and Zod to `4.6.7`. The server uses the bundled `drizzle-orm/zod` integration. Review the release candidate before promoting it beyond this implementation. Run `npm run db:generate` when the table definitions change and review SQL and snapshots together.

The integration tests use PGlite to apply the committed migrations twice and test the API with synthetic authentication. The Neon smoke script exercises live storage, transactional rollback and concurrent replay with synthetic rows, then cleans up those rows. It checks editor updates using the runtime connection and uses the direct migration connection for fixture cleanup. The expense-edit permission migration grants existing expense readers/writers UPDATE only on title, amount, category, date, version and modification time.
