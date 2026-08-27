import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getOrCreateAcContact, syncBookingTag } from "@/lib/activecampaign/client";
import type { Booking, Lead } from "@/lib/types";
import { isCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

const ABANDONED_MINUTES = 15;

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const cutoff = new Date(Date.now() - ABANDONED_MINUTES * 60 * 1000).toISOString();

  const { data: bookingsData } = await supabase
    .from("bookings")
    .select("*, event_type:event_types(name)")
    .eq("status", "pending_step2")
    .is("abandoned_tagged_at", null)
    .lt("created_at", cutoff);
  const bookings = (bookingsData ?? []) as (Booking & {
    event_type: { name: string } | { name: string }[] | null;
  })[];

  let processed = 0;

  for (const booking of bookings) {
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
        await syncBookingTag(acContactId, "Booking-Abandoned-Step2", eventTypeName);
      }

      // Only mark tagged (booking stays pending_step2 — the person can still
      // complete step 2 later) after the AC call succeeds, so a transient AC
      // failure gets retried on the next sweep instead of being tagged once
      // and silently skipped forever.
      await supabase
        .from("bookings")
        .update({ abandoned_tagged_at: new Date().toISOString() })
        .eq("id", booking.id);

      processed++;
    } catch (err) {
      console.error(`ActiveCampaign sync failed on abandoned-sweep for booking ${booking.id}`, err);
    }
  }

  return NextResponse.json({ processed });
}
