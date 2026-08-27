-- Lets an event type show a different public-facing widget headline than its
-- internal/admin-facing name (used in the admin table, embed-codes page, and
-- Google Calendar event summaries). Falls back to `name` when null.
alter table event_types add column headline text;
