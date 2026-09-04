import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getOrCreateAcContact, syncBookingTag } from "@/lib/activecampaign/client";
import type { Booking, Lead } from "@/lib/types";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// This is submitted as a plain HTML <form method="POST"> from the admin
// table (not a fetch() call): browsers only reliably resend cached Basic
// Auth credentials for real navigations/form submissions, not for
// background fetch/XHR requests to the same protection space — a plain
// form avoids that inconsistency entirely. Redirect back to the admin page
// afterward instead of returning JSON.
export async function POST(req: NextRequest) {
  const redirectTo = new URL("/admin/bookings", req.url);

  if (!isAdminAuthorized(req)) {
    redirectTo.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(redirectTo, 303);
  }

  const form = await req.formData();
  const bookingId = form.get("bookingId");
  const outcome = form.get("outcome");

  if (
    typeof bookingId !== "string" ||
    !bookingId ||
    (outcome !== "attended" && outcome !== "no_show")
  ) {
    redirectTo.searchParams.set("error", "invalid-request");
    return NextResponse.redirect(redirectTo, 303);
  }

  const supabase = supabaseAdmin();

  const { data: bookingData } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();
  const booking = bookingData as Booking | null;

  if (!booking) {
    redirectTo.searchParams.set("error", "booking-not-found");
    return NextResponse.redirect(redirectTo, 303);
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: outcome, outcome_marked_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (updateError) {
    redirectTo.searchParams.set("error", "update-failed");
    return NextResponse.redirect(redirectTo, 303);
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
        outcome === "attended" ? "Booked-Attended" : "Booked-NoShow",
        eventType.name
      );
    } catch (err) {
      console.error("ActiveCampaign sync failed on mark-outcome", err);
    }
  }

  return NextResponse.redirect(redirectTo, 303);
}
