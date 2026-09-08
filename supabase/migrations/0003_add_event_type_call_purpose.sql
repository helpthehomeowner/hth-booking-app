-- Optional per-event-type blurb explaining what the call is about, shown at
-- the top of the Google Calendar event description. Same pattern as
-- `headline`: falls back to no purpose line when null.
alter table event_types add column call_purpose text;
