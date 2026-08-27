import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getOrCreateAcContact, syncBookingTag } from "@/lib/activecampaign/client";
import type { Booking, Lead } from "@/lib/types";
import { isCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

const GRACE_HOURS = 2;

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const cutoff = new Date(Date.now() - GRACE_HOURS * 60 * 60 * 1000).toISOString();

  const { data: bookingsData } = await supabase
    .from("bookings")
    .select("*, event_type:event_types(name)")
    .eq("status", "confirmed")
    .is("outcome_marked_at", null)
    .lt("scheduled_at", cutoff);
  const bookings = (bookingsData ?? []) as (Booking & {
    event_type: { name: string } | { name: string }[] | null;
  })[];

  let processed = 0;

  for (const booking of bookings) {
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "no_show", outcome_marked_at: new Date().toISOString() })
      .eq("id", booking.id)
      .eq("status", "confirmed"); // guard against a race with a manual mark-outcome call

    if (updateError) continue;
    processed++;

    try {
      const { data: leadData } = await supabase
        .from("leads")
        .select("*")
        .eq("id", booking.lead_id)
        .single();
      const lead = leadData as Lead | null;

      const eventTypeName = Array.isArray(booking.event_type)
        ? booking.event_type[0]?.name
        : booking.event_type?.name;

      if (lead && eventTypeName) {
        const acContactId = lead.activecampaign_contact_id ?? (await getOrCreateAcContact(lead.email));
        if (!lead.activecampaign_contact_id) {
          await supabase.from("leads").update({ activecampaign_contact_id: acContactId }).eq("id", lead.id);
        }
        await syncBookingTag(acContactId, "Booked-NoShow", eventTypeName);
      }
    } catch (err) {
      console.error(`ActiveCampaign sync failed on no-show-sweep for booking ${booking.id}`, err);
    }
  }

  return NextResponse.json({ processed });
}
