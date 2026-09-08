import { supabaseAdmin } from "@/lib/supabase/server";
import AdminNewBookingForm, { type EventTypeOption } from "@/components/AdminNewBookingForm";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Session expired — please reload the page and log in again.",
  "invalid-request": "Please fill in name, email, phone, and pick a time.",
  "unknown-event-type": "That call type isn't available anymore. Please pick another.",
  "slot-taken": "That time was just booked — please pick another slot.",
  "lead-failed": "Failed to save the lead. Please try again.",
  "booking-failed": "The calendar event was created, but saving the booking failed. Check the calendar and try again if needed.",
};

async function loadEventTypes(): Promise<EventTypeOption[]> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("event_types")
    .select("slug, name, duration_min")
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("Failed to load event types for new-booking page", error);
    return [];
  }

  return (data ?? []).map((et) => ({
    slug: et.slug,
    name: et.name,
    durationMin: et.duration_min,
  }));
}

export default async function AdminNewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const eventTypes = await loadEventTypes();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">New Booking</h1>
      <p className="mt-1 text-sm text-gray-500">
        Schedule a call directly on Rene&apos;s calendar — for follow-ups, phone-booked
        leads, or anything that didn&apos;t come through the public widget.
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {ERROR_MESSAGES[error] ?? "Something went wrong. Please try again."}
        </div>
      )}

      {eventTypes.length === 0 ? (
        <p className="mt-8 text-sm text-gray-400">No active event types yet.</p>
      ) : (
        <AdminNewBookingForm eventTypes={eventTypes} />
      )}
    </div>
  );
}
