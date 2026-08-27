import { google } from "googleapis";

// Auth via a Google Cloud service account authorized for domain-wide
// delegation (Workspace Admin Console > Security > API controls > Domain-wide
// delegation, scope https://www.googleapis.com/auth/calendar). Rather than
// relying on each calendar being individually shared with the service
// account, it impersonates the calendar's owner directly via `subject` — for
// a host's primary Workspace calendar, that's just their email, i.e. the
// same string as calendarId.
function getAuth(subject: string) {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!b64) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 env var");
  }

  const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));

  return new google.auth.JWT({
    email: json.client_email,
    key: json.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject,
  });
}

function getCalendarClient(subject: string) {
  return google.calendar({ version: "v3", auth: getAuth(subject) });
}

export interface BusyInterval {
  start: string; // ISO
  end: string; // ISO
}

export async function getFreeBusy(
  calendarId: string,
  timeMinISO: string,
  timeMaxISO: string
): Promise<BusyInterval[]> {
  const calendar = getCalendarClient(calendarId);

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      items: [{ id: calendarId }],
    },
  });

  const busy = res.data.calendars?.[calendarId]?.busy ?? [];
  return busy
    .filter((b) => b.start && b.end)
    .map((b) => ({ start: b.start as string, end: b.end as string }));
}

export interface CreateEventInput {
  calendarId: string;
  summary: string;
  description: string;
  startISO: string;
  endISO: string;
  timezone: string;
  attendeeEmail: string;
  attendeeName?: string | null;
}

export async function createCalendarEvent(
  input: CreateEventInput
): Promise<string> {
  const calendar = getCalendarClient(input.calendarId);

  const res = await calendar.events.insert({
    calendarId: input.calendarId,
    sendUpdates: "all",
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.startISO, timeZone: input.timezone },
      end: { dateTime: input.endISO, timeZone: input.timezone },
      attendees: [
        { email: input.attendeeEmail, displayName: input.attendeeName ?? undefined },
      ],
    },
  });

  if (!res.data.id) {
    throw new Error("Google Calendar did not return an event id");
  }

  return res.data.id;
}
