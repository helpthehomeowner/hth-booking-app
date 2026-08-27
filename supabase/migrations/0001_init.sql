-- HTH Booking App schema
-- Note: this deliberately extends the spec's event_types table into
-- event_types + hosts + host_availability. A single "calendar_id" column on
-- event_types cannot express "different hour rules per host" without a
-- migration later, so calendar + timezone + bookable-hours rules live on a
-- separate `hosts` row that multiple event_types can share, and bookable
-- hours live in their own table so a host can have different hours on
-- different days. Today there is exactly one host (Rene) with one set of
-- Mon-Fri hours; adding a second host or an event type with different hours
-- is just new rows, no schema change.

create extension if not exists "pgcrypto";

create table hosts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  calendar_id text not null, -- Google Calendar ID this host's events live on
  timezone text not null default 'America/New_York', -- IANA tz, DST-aware
  created_at timestamptz default now()
);

-- Recurring weekly bookable windows for a host. day_of_week: 0=Sunday..6=Saturday.
-- start_time/end_time are local wall-clock times in hosts.timezone.
create table host_availability (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references hosts(id) not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz default now()
);

create table event_types (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  duration_min integer not null,
  host_id uuid references hosts(id) not null,
  buffer_min integer default 0,
  active boolean default true,
  created_at timestamptz default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text unique not null,
  phone text,
  activecampaign_contact_id text,
  created_at timestamptz default now()
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  event_type_id uuid references event_types(id),
  status text not null default 'pending_step2',
    -- 'pending_step2' | 'confirmed' | 'attended' | 'no_show' | 'cancelled'
  source_url text,
  utm_source text,
  utm_campaign text,
  utm_medium text,
  scheduled_at timestamptz,
  google_event_id text,
  created_at timestamptz default now(),
  step2_completed_at timestamptz,
  outcome_marked_at timestamptz,
  -- set the first time the abandoned-sweep tags a booking, so it only fires once
  abandoned_tagged_at timestamptz
);

create index bookings_status_idx on bookings (status);
create index bookings_scheduled_at_idx on bookings (scheduled_at);
create index bookings_lead_id_idx on bookings (lead_id);
create index leads_email_idx on leads (email);

-- Seed: Rene, Mon-Fri 2:00 PM - 8:00 PM Eastern, one event type.
insert into hosts (id, name, email, calendar_id, timezone)
values (
  '00000000-0000-0000-0000-000000000001',
  'Rene',
  null,
  'stub-calendar-id@group.calendar.google.com', -- replace via RENE_GOOGLE_CALENDAR_ID / update this row
  'America/New_York'
);

insert into host_availability (host_id, day_of_week, start_time, end_time)
select '00000000-0000-0000-0000-000000000001', d, '14:00', '20:00'
from unnest(array[1,2,3,4,5]) as d; -- Mon-Fri

insert into event_types (slug, name, duration_min, host_id, buffer_min)
values (
  'tier4-workshop',
  'Tier 4 Workshop Follow-Up Call',
  60,
  '00000000-0000-0000-0000-000000000001',
  15
);

-- Row Level Security: this app only ever talks to Supabase via the service
-- role key from server-side API routes, never the anon key from the browser.
-- Lock every table down by default so the anon key (shipped to the browser
-- as NEXT_PUBLIC_SUPABASE_ANON_KEY) can't read or write anything.
alter table hosts enable row level security;
alter table host_availability enable row level security;
alter table event_types enable row level security;
alter table leads enable row level security;
alter table bookings enable row level security;
-- No policies are created, so all access from the anon/authenticated roles is
-- denied; the service role key bypasses RLS entirely, which is what the API
-- routes use.
