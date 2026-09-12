-- Event type for the call offered at the end of the hth-lead-intake form
-- (helpthehomeowner.com distressed-property intake). Booked on Rene's
-- existing calendar/availability, same as the other event types.
insert into event_types (slug, name, duration_min, host_id, buffer_min, headline, call_purpose)
values (
  'lead-intake-call',
  'Lead Intake Follow-Up Call',
  30,
  '00000000-0000-0000-0000-000000000001',
  15,
  'Pick a time to talk with Rene',
  'This call is to go over your situation and talk through your options — no pressure, no obligation.'
);
