import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getOrCreateAcContact, syncBookingTag } from "@/lib/activecampaign/client";

export const dynamic = "force-dynamic";

interface Step1Body {
  name: string;
  email: string;
  eventTypeSlug: string;
  source_url?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  utm_medium?: string | null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Step1Body | null;

  if (!body?.name?.trim() || !body?.email?.trim() || !body?.eventTypeSlug) {
    return NextResponse.json(
      { error: "name, email, and eventTypeSlug are required" },
      { status: 400 }
    );
  }

  const email = body.email.trim().toLowerCase();
  const name = body.name.trim();
  const supabase = supabaseAdmin();

  const { data: eventType, error: eventTypeError } = await supabase
    .from("event_types")
    .select("id")
    .eq("slug", body.eventTypeSlug)
    .eq("active", true)
    .single();

  if (eventTypeError || !eventType) {
    return NextResponse.json({ error: "Unknown or inactive eventType" }, { status: 404 });
  }

  const { data: existingLead } = await supabase
    .from("leads")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  let leadId: string;
  let acContactId: string | null = existingLead?.activecampaign_contact_id ?? null;

  if (existingLead) {
    leadId = existingLead.id;
    if (name && name !== existingLead.name) {
      await supabase.from("leads").update({ name }).eq("id", leadId);
    }
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("leads")
      .insert({ name, email })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
    }
    leadId = inserted.id;
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      lead_id: leadId,
      event_type_id: eventType.id,
      status: "pending_step2",
      source_url: body.source_url ?? null,
      utm_source: body.utm_source ?? null,
      utm_campaign: body.utm_campaign ?? null,
      utm_medium: body.utm_medium ?? null,
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }

  // ActiveCampaign sync is best-effort: a CRM hiccup shouldn't block the booking flow.
  try {
    const [firstName, ...rest] = name.split(" ");
    acContactId = await getOrCreateAcContact(email, {
      firstName,
      lastName: rest.join(" ") || undefined,
    });

    if (acContactId !== existingLead?.activecampaign_contact_id) {
      await supabase
        .from("leads")
        .update({ activecampaign_contact_id: acContactId })
        .eq("id", leadId);
    }

    await syncBookingTag(acContactId, "Booking-Started");
  } catch (err) {
    console.error("ActiveCampaign sync failed on step1", err);
  }

  return NextResponse.json({ bookingId: booking.id, leadId });
}
