import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getOrCreateAcContact, syncBookingTag } from "@/lib/activecampaign/client";
import type { Booking, Lead } from "@/lib/types";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

interface MarkOutcomeBody {
  bookingId: string;
  outcome: "attended" | "no_show";
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as MarkOutcomeBody | null;

  if (!body?.bookingId || (body.outcome !== "attended" && body.outcome !== "no_show")) {
    return NextResponse.json(
      { error: "bookingId and outcome ('attended' | 'no_show') are required" },
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

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: body.outcome, outcome_marked_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }

  const { data: leadData } = await supabase
    .from("leads")
    .select("*")
    .eq("id", booking.lead_id)
    .single();
  const lead = leadData as Lead | null;

  const { data: eventType } = await supabase
    .from("event_types")
    .select("name")
    .eq("id", booking.event_type_id)
    .single();

  if (lead && eventType) {
    try {
      const acContactId = lead.activecampaign_contact_id ?? (await getOrCreateAcContact(lead.email));
      if (!lead.activecampaign_contact_id) {
        await supabase.from("leads").update({ activecampaign_contact_id: acContactId }).eq("id", lead.id);
      }
      await syncBookingTag(
        acContactId,
        body.outcome === "attended" ? "Booked-Attended" : "Booked-NoShow",
        eventType.name
      );
    } catch (err) {
      console.error("ActiveCampaign sync failed on mark-outcome", err);
    }
  }

  return NextResponse.json({ ok: true });
}
