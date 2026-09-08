import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createCalendarEvent, getFreeBusy } from "@/lib/google/calendar";
import { getOrCreateAcContact, syncBookingTag } from "@/lib/activecampaign/client";
import { isAdminAuthorized } from "@/lib/admin-auth";
import type { EventType, Host } from "@/lib/types";

export const dynamic = "force-dynamic";

// Internal counterpart to the public step1+step2 flow: an admin picks a
// lead + event type + slot directly and this creates the confirmed booking
// in one step (no pending_step2 recovery stage — that's specifically for
// self-serve visitors who might abandon mid-flow; an admin filling this
// form out is already committing). Submitted as a plain <form method="POST">
// for the same Basic Auth reliability reason as mark-outcome/delete.
export async function POST(req: NextRequest) {
  const redirectTo = new URL("/admin/new-booking", req.url);

  if (!isAdminAuthorized(req)) {
    redirectTo.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(redirectTo, 303);
  }

  const form = await req.formData();
  const name = form.get("name");
  const email = form.get("email");
  const phone = form.get("phone");
  const eventTypeSlug = form.get("eventTypeSlug");
  const slotStartISO = form.get("slotStartISO");
  const slotEndISO = form.get("slotEndISO");

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof phone !== "string" ||
    !phone.trim() ||
    typeof eventTypeSlug !== "string" ||
    !eventTypeSlug ||
    typeof slotStartISO !== "string" ||
    !slotStartISO ||
    typeof slotEndISO !== "string" ||
    !slotEndISO
  ) {
    redirectTo.searchParams.set("error", "invalid-request");
    return NextResponse.redirect(redirectTo, 303);
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPhone = phone.trim();

  const supabase = supabaseAdmin();

  const { data: eventTypeData } = await supabase
    .from("event_types")
    .select("*")
    .eq("slug", eventTypeSlug)
    .eq("active", true)
    .single();
  const eventType = eventTypeData as EventType | null;

  if (!eventType) {
    redirectTo.searchParams.set("error", "unknown-event-type");
    return NextResponse.redirect(redirectTo, 303);
  }

  const { data: hostData } = await supabase
    .from("hosts")
    .select("*")
    .eq("id", eventType.host_id)
    .single();
  const host = hostData as Host | null;

  if (!host) {
    redirectTo.searchParams.set("error", "unknown-event-type");
    return NextResponse.redirect(redirectTo, 303);
  }

  // Re-validate the slot is still free right before booking it, same as the
  // public step2 flow — the admin may have had this page open a while.
  const bufferMs = (eventType.buffer_min ?? 0) * 60 * 1000;
  const slotStart = new Date(slotStartISO);
  const slotEnd = new Date(slotEndISO);
  const checkWindowStart = new Date(slotStart.getTime() - bufferMs).toISOString();
  const checkWindowEnd = new Date(slotEnd.getTime() + bufferMs).toISOString();
  const busy = await getFreeBusy(host.calendar_id, checkWindowStart, checkWindowEnd);
  const conflict = busy.some(
    (b) =>
      slotStart.getTime() < new Date(b.end).getTime() + bufferMs &&
      slotEnd.getTime() + bufferMs > new Date(b.start).getTime()
  );

  if (conflict) {
    redirectTo.searchParams.set("error", "slot-taken");
    return NextResponse.redirect(redirectTo, 303);
  }

  // Find or create the lead, same matching logic as the public step1 flow.
  const { data: existingLead } = await supabase
    .from("leads")
    .select("*")
    .eq("email", trimmedEmail)
    .maybeSingle();

  let leadId: string;
  if (existingLead) {
    leadId = existingLead.id;
    const updates: Record<string, string> = {};
    if (trimmedName && trimmedName !== existingLead.name) updates.name = trimmedName;
    if (trimmedPhone && trimmedPhone !== existingLead.phone) updates.phone = trimmedPhone;
    if (Object.keys(updates).length > 0) {
      await supabase.from("leads").update(updates).eq("id", leadId);
    }
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("leads")
      .insert({ name: trimmedName, email: trimmedEmail, phone: trimmedPhone })
      .select("id")
      .single();

    if (insertError || !inserted) {
      redirectTo.searchParams.set("error", "lead-failed");
      return NextResponse.redirect(redirectTo, 303);
    }
    leadId = inserted.id;
  }

  const googleEventId = await createCalendarEvent({
    calendarId: host.calendar_id,
    summary: `${eventType.name} — ${trimmedName}`,
    description: [
      eventType.call_purpose,
      eventType.call_purpose ? "" : null,
      `Seller: ${trimmedName} <${trimmedEmail}> ${trimmedPhone}`,
    ]
      .filter((line) => line !== null)
      .join("\n"),
    startISO: slotStartISO,
    endISO: slotEndISO,
    timezone: host.timezone,
    attendeeEmail: trimmedEmail,
    attendeeName: trimmedName,
  });

  const { error: bookingError } = await supabase.from("bookings").insert({
    lead_id: leadId,
    event_type_id: eventType.id,
    status: "confirmed",
    utm_source: "internal-admin",
    scheduled_at: slotStartISO,
    google_event_id: googleEventId,
    step2_completed_at: new Date().toISOString(),
  });

  if (bookingError) {
    redirectTo.searchParams.set("error", "booking-failed");
    return NextResponse.redirect(redirectTo, 303);
  }

  try {
    const [firstName, ...rest] = trimmedName.split(" ");
    const acContactId = await getOrCreateAcContact(trimmedEmail, {
      firstName,
      lastName: rest.join(" ") || undefined,
      phone: trimmedPhone,
    });
    await supabase.from("leads").update({ activecampaign_contact_id: acContactId }).eq("id", leadId);
    await syncBookingTag(acContactId, "Booked-Pending", eventType.name);
  } catch (err) {
    console.error("ActiveCampaign sync failed on admin create-booking", err);
  }

  const bookingsUrl = new URL("/admin/bookings", req.url);
  bookingsUrl.searchParams.set("created", "1");
  return NextResponse.redirect(bookingsUrl, 303);
}
