import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createCalendarEvent, getFreeBusy } from "@/lib/google/calendar";
import { getOrCreateAcContact, syncBookingTag } from "@/lib/activecampaign/client";
import type { Booking, EventType, Host, Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Step2Body {
  bookingId: string;
  phone: string;
  slotStartISO: string;
  slotEndISO: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Step2Body | null;

  if (!body?.bookingId || !body?.phone?.trim() || !body?.slotStartISO || !body?.slotEndISO) {
    return NextResponse.json(
      { error: "bookingId, phone, slotStartISO, and slotEndISO are required" },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  const { data: bookingData } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", body.bookingId)
    .single();
  const booking = bookingData as Booking | null;

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status !== "pending_step2") {
    return NextResponse.json(
      { error: `Booking is already ${booking.status}` },
      { status: 409 }
    );
  }

  const { data: leadData } = await supabase
    .from("leads")
    .select("*")
    .eq("id", booking.lead_id)
    .single();
  const lead = leadData as Lead | null;

  const { data: eventTypeData } = await supabase
    .from("event_types")
    .select("*")
    .eq("id", booking.event_type_id)
    .single();
  const eventType = eventTypeData as EventType | null;

  if (!lead || !eventType) {
    return NextResponse.json({ error: "Booking is missing lead or event type" }, { status: 500 });
  }

  const { data: hostData } = await supabase
    .from("hosts")
    .select("*")
    .eq("id", eventType.host_id)
    .single();
  const host = hostData as Host | null;

  if (!host) {
    return NextResponse.json({ error: "Event type is missing a host" }, { status: 500 });
  }

  // Re-validate the requested slot is still free right before booking it —
  // never trust a slot the client picked minutes ago without a final check.
  const bufferMs = (eventType.buffer_min ?? 0) * 60 * 1000;
  const slotStart = new Date(body.slotStartISO);
  const slotEnd = new Date(body.slotEndISO);

  const checkWindowStart = new Date(slotStart.getTime() - bufferMs).toISOString();
  const checkWindowEnd = new Date(slotEnd.getTime() + bufferMs).toISOString();
  const busy = await getFreeBusy(host.calendar_id, checkWindowStart, checkWindowEnd);

  const conflict = busy.some(
    (b) =>
      slotStart.getTime() < new Date(b.end).getTime() + bufferMs &&
      slotEnd.getTime() + bufferMs > new Date(b.start).getTime()
  );

  if (conflict) {
    return NextResponse.json(
      { error: "That time was just booked — please pick another slot." },
      { status: 409 }
    );
  }

  const phone = body.phone.trim();

  const googleEventId = await createCalendarEvent({
    calendarId: host.calendar_id,
    summary: `${eventType.name} — ${lead.name ?? lead.email}`,
    description: [
      `Lead: ${lead.name ?? "(no name)"} <${lead.email}> ${phone}`,
      `Event type: ${eventType.slug}`,
      booking.source_url ? `Source: ${booking.source_url}` : null,
      booking.utm_source ? `utm_source: ${booking.utm_source}` : null,
      booking.utm_campaign ? `utm_campaign: ${booking.utm_campaign}` : null,
      booking.utm_medium ? `utm_medium: ${booking.utm_medium}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    startISO: body.slotStartISO,
    endISO: body.slotEndISO,
    timezone: host.timezone,
    attendeeEmail: lead.email,
    attendeeName: lead.name,
  });

  await supabase.from("leads").update({ phone }).eq("id", lead.id);

  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      status: "confirmed",
      scheduled_at: body.slotStartISO,
      google_event_id: googleEventId,
      step2_completed_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to finalize booking" }, { status: 500 });
  }

  try {
    const acContactId =
      lead.activecampaign_contact_id ?? (await getOrCreateAcContact(lead.email, { phone }));

    if (!lead.activecampaign_contact_id) {
      await supabase.from("leads").update({ activecampaign_contact_id: acContactId }).eq("id", lead.id);
    } else {
      await getOrCreateAcContact(lead.email, { phone }); // patches phone onto the existing contact
    }

    await syncBookingTag(acContactId, "Booked-Pending", eventType.name);
  } catch (err) {
    console.error("ActiveCampaign sync failed on step2", err);
  }

  return NextResponse.json({
    bookingId: booking.id,
    scheduledAt: body.slotStartISO,
    eventTypeName: eventType.headline ?? eventType.name,
  });
}
