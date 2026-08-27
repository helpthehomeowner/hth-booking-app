import { addDays, addMinutes, isBefore } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getFreeBusy } from "@/lib/google/calendar";
import type { EventType, Host, HostAvailability } from "@/lib/types";

const DEFAULT_DAYS_AHEAD = 14;
const MIN_NOTICE_HOURS = 2;

export interface Slot {
  startISO: string;
  endISO: string;
}

export interface AvailabilityResult {
  eventType: EventType;
  host: Host;
  slots: Slot[];
}

/**
 * Computes open slots for an event type by combining the host's recurring
 * bookable-hours rules (host_availability, in the host's local timezone —
 * DST-safe) with live Google Calendar free/busy, padded by the event type's
 * buffer_min on both sides of any existing event.
 */
export async function getAvailableSlots(
  eventTypeSlug: string,
  opts: { daysAhead?: number; minNoticeHours?: number } = {}
): Promise<AvailabilityResult | null> {
  const daysAhead = opts.daysAhead ?? DEFAULT_DAYS_AHEAD;
  const minNoticeHours = opts.minNoticeHours ?? MIN_NOTICE_HOURS;

  const supabase = supabaseAdmin();

  const { data: eventType } = await supabase
    .from("event_types")
    .select("*")
    .eq("slug", eventTypeSlug)
    .eq("active", true)
    .single();

  if (!eventType) return null;

  const { data: host } = await supabase
    .from("hosts")
    .select("*")
    .eq("id", (eventType as EventType).host_id)
    .single();

  if (!host) return null;

  const { data: availability } = await supabase
    .from("host_availability")
    .select("*")
    .eq("host_id", (host as Host).id);

  const rules = (availability ?? []) as HostAvailability[];
  const et = eventType as EventType;
  const hostRow = host as Host;

  const now = new Date();
  const notBefore = addMinutes(now, minNoticeHours * 60);

  // Anchor "today" as a calendar date in the host's timezone, then walk
  // forward day-by-day. Weekday of a Y-M-D calendar date is timezone
  // independent, so getUTCDay() on a UTC-midnight Date built from that
  // string is safe to use as the day_of_week lookup key.
  const todayStr = formatInTimeZone(now, hostRow.timezone, "yyyy-MM-dd");
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const anchor = new Date(Date.UTC(ty, tm - 1, td));

  const rangeStartISO = now.toISOString();
  const rangeEndISO = addDays(anchor, daysAhead + 1).toISOString();

  const busy = await getFreeBusy(hostRow.calendar_id, rangeStartISO, rangeEndISO);
  const busyIntervals = busy.map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));

  const bufferMs = (et.buffer_min ?? 0) * 60 * 1000;
  const durationMs = et.duration_min * 60 * 1000;

  const slots: Slot[] = [];

  for (let i = 0; i < daysAhead; i++) {
    const dayDate = new Date(anchor.getTime() + i * 86400000);
    const dow = dayDate.getUTCDay();
    const y = dayDate.getUTCFullYear();
    const m = dayDate.getUTCMonth() + 1;
    const d = dayDate.getUTCDate();
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const dayRules = rules.filter((r) => r.day_of_week === dow);

    for (const rule of dayRules) {
      const windowStart = fromZonedTime(`${dateStr}T${rule.start_time}`, hostRow.timezone);
      const windowEnd = fromZonedTime(`${dateStr}T${rule.end_time}`, hostRow.timezone);

      let slotStart = windowStart;
      while (slotStart.getTime() + durationMs <= windowEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + durationMs);

        const tooSoon = isBefore(slotStart, notBefore);
        const conflicts = busyIntervals.some(
          (b) => slotStart.getTime() < b.end + bufferMs && slotEnd.getTime() + bufferMs > b.start
        );

        if (!tooSoon && !conflicts) {
          slots.push({
            startISO: slotStart.toISOString(),
            endISO: slotEnd.toISOString(),
          });
        }

        slotStart = new Date(slotStart.getTime() + durationMs);
      }
    }
  }

  return { eventType: et, host: hostRow, slots };
}
