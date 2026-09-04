import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deleteCalendarEvent } from "@/lib/google/calendar";
import type { Booking, EventType, Host } from "@/lib/types";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Submitted as a plain HTML <form method="POST"> for the same reason
// mark-outcome is: browsers don't reliably resend cached Basic Auth
// credentials on background fetch()/XHR requests, only on real
// navigations/form submissions.
export async function POST(req: NextRequest) {
  const redirectTo = new URL("/admin/bookings", req.url);

  if (!isAdminAuthorized(req)) {
    redirectTo.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(redirectTo, 303);
  }

  const form = await req.formData();
  const bookingId = form.get("bookingId");

  if (typeof bookingId !== "string" || !bookingId) {
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
    // Already gone — treat as success rather than erroring.
    return NextResponse.redirect(redirectTo, 303);
  }

  // Clean up the real Google Calendar event too, so deleting a booking here
  // doesn't leave a stale event on the host's actual calendar.
  if (booking.google_event_id) {
    try {
      const { data: eventTypeData } = await supabase
        .from("event_types")
        .select("*")
        .eq("id", booking.event_type_id)
        .single();
      const eventType = eventTypeData as EventType | null;

      if (eventType) {
        const { data: hostData } = await supabase
          .from("hosts")
          .select("*")
          .eq("id", eventType.host_id)
          .single();
        const host = hostData as Host | null;

        if (host) {
          await deleteCalendarEvent(host.calendar_id, booking.google_event_id);
        }
      }
    } catch (err) {
      console.error(`Failed to delete Google Calendar event for booking ${bookingId}`, err);
      redirectTo.searchParams.set("error", "calendar-delete-failed");
      return NextResponse.redirect(redirectTo, 303);
    }
  }

  const { error: deleteError } = await supabase.from("bookings").delete().eq("id", bookingId);

  if (deleteError) {
    redirectTo.searchParams.set("error", "delete-failed");
    return NextResponse.redirect(redirectTo, 303);
  }

  return NextResponse.redirect(redirectTo, 303);
}
