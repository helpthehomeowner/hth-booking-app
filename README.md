# HTH Booking App

Standalone two-step call-booking widget (Supabase + Google Calendar + ActiveCampaign),
embeddable via iframe or as a standalone page. Separate Supabase project from the
HTH intake app — nothing here talks to that database.

## 0. Prerequisites on this machine

Node.js isn't installed yet. Install Node 20 LTS, then from this folder:

```bash
npm install
```

## 1. Supabase (new project)

1. Create a new project at https://supabase.com/dashboard (do **not** reuse the intake app's project).
2. In the SQL Editor, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). It creates all tables, locks them down with RLS (server-only access via the service role key), and seeds one host ("Rene") + one event type (`tier4-workshop`, 60 min, 15 min buffer).
3. After running it, update the seeded host row with Rene's real calendar ID (or just set `RENE_GOOGLE_CALENDAR_ID` per below and run `update hosts set calendar_id = '...';`).
4. Copy from Project Settings → API into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not currently used by any code path, but reserved for future client-side Supabase Auth on `/admin`)
   - `SUPABASE_SERVICE_ROLE_KEY` — **server-only secret**, this is what every API route uses.

## 2. Google Calendar (service account + domain-wide delegation)

Chosen over OAuth because there's a single calendar to connect and a service account never needs a token refresh flow.

Rene's calendar lives in a Google Workspace org (`helpthehomeowner.com`) whose sharing policy blocks granting "Make changes to events" to any account outside the org — which a service account always is. So instead of per-calendar sharing, the service account is authorized for **domain-wide delegation** and impersonates the calendar owner directly (`subject` on the JWT, see [`lib/google/calendar.ts`](lib/google/calendar.ts)). This also means it isn't limited to one pre-shared calendar — any calendar owned by a user in the Workspace org works automatically.

1. In Google Cloud Console, create a project (or reuse one — this app reuses the existing `hth-seller-intake` project, with its own separate service account), enable the **Google Calendar API**.
2. Create a **Service Account** (this app's is named `hth-booking-calendar`, distinct from the intake app's own service account — don't share credentials between apps), then create a JSON key for it and download it.
3. As a Workspace **super admin**, go to admin.google.com → Security → API controls → **Domain-wide delegation** → Add new → paste the service account's numeric **Client ID** (found on its Cloud Console details page, or the `client_id` field in the downloaded JSON) → scope `https://www.googleapis.com/auth/calendar`.
4. Get Rene's calendar ID from Google Calendar → Settings → **Integrate calendar** (for a Workspace user's primary calendar, this is just their email address).
5. Base64-encode the whole downloaded JSON file into one env var:
   ```bash
   # mac/linux
   base64 -i service-account.json | tr -d '\n'
   ```
   ```powershell
   # windows
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
   ```
   Put the result in `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`.
6. Put the calendar ID in `RENE_GOOGLE_CALENDAR_ID` **and** update the `hosts.calendar_id` row in Supabase to match (the app reads it from the DB, not the env var — the env var is just for you to reference).

## 3. ActiveCampaign

Set `ACTIVECAMPAIGN_API_URL` (e.g. `https://youraccount.api-us1.com`) and `ACTIVECAMPAIGN_API_KEY` (Settings → Developer in AC). No tags need to be pre-created — `syncBookingTag` creates any tag it doesn't find (`Booking-Started`, `Booked-Pending`, `Booked-Attended`, `Booked-NoShow`, `Booking-Abandoned-Step2`).

## 4. Admin page + cron

- `ADMIN_BASIC_AUTH_USER` / `ADMIN_BASIC_AUTH_PASSWORD` gate `/admin/bookings` (browser Basic Auth prompt).
- `CRON_SECRET` — set this in Vercel; Vercel Cron automatically sends it as `Authorization: Bearer $CRON_SECRET` to the two `/api/cron/*` routes, which reject anything else.

**Vercel plan note:** the Hobby plan only runs cron jobs once per day. [`vercel.json`](vercel.json) schedules the abandoned-sweep every 5 min and the no-show-sweep every 30 min — both need a **Pro** plan (or higher) to actually run on that cadence. On Hobby, you'd get at most one sweep per day.

## 5. Run locally

```bash
cp .env.local.example .env.local   # fill in real values
npm install
npm run dev
```

Then visit:
- `http://localhost:3000/book/tier4-workshop` — standalone page
- `http://localhost:3000/embed/booking?event=tier4-workshop&source=reviewmyhouse-quiz` — what an iframe would load
- `http://localhost:3000/admin/bookings` — admin (Basic Auth prompt)
- `http://localhost:3000/admin/embed-codes` — generates the iframe snippet / direct link per event type, with a source-label field, so you don't have to hand-build the query string

## 6. Deploy

Push to GitHub, import into Vercel, paste in the same env vars (Project Settings → Environment Variables). `vercel.json`'s `crons` block is picked up automatically on deploy — no extra Vercel config needed beyond the Pro plan noted above.

## Embedding

```html
<iframe
  src="https://your-app-domain.com/embed/booking?event=tier4-workshop&source=reviewmyhouse-quiz"
  style="width:100%;max-width:480px;height:640px;border:0"
  title="Book a call"
></iframe>
```

- `event` — required, matches an `event_types.slug` row.
- `source` — optional shorthand tag for which page embedded it; used as `utm_source` if no explicit `utm_source` is also present on the iframe URL.
- Any `utm_source` / `utm_campaign` / `utm_medium` on the iframe's own `src` query string are recorded as-is.
- `source_url` is captured automatically: inside an iframe it's the parent page's URL (`document.referrer`); on the standalone `/book/[eventType]` page it's that page's own URL.

## What's implemented vs. the original schema

The spec's `event_types.calendar_id` column became `event_types.host_id → hosts.calendar_id`,
plus a new `host_availability` table for bookable-hours rules, per the requirement that more
calendars/hosts and different hour rules be addable later without a rebuild — a flat
`calendar_id` + implicit hours on `event_types` couldn't express two hosts with different
Mon–Fri windows without a migration; this can, via new rows only. `leads` and `bookings` match
the spec schema exactly.
