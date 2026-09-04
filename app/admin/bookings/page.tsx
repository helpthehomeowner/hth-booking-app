import { supabaseAdmin } from "@/lib/supabase/server";
import AdminBookingsTable, { type AdminBookingRow } from "@/components/AdminBookingsTable";

export const dynamic = "force-dynamic";

async function loadBookings(): Promise<AdminBookingRow[]> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, status, scheduled_at, created_at, source_url, utm_source, lead:leads(name, email, phone), event_type:event_types(name, slug)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Failed to load bookings for admin page", error);
    return [];
  }

  // Supabase types the embedded relation as an array even for a to-one join; flatten it.
  return (data ?? []).map((row: any) => ({
    id: row.id,
    status: row.status,
    scheduled_at: row.scheduled_at,
    created_at: row.created_at,
    source_url: row.source_url,
    utm_source: row.utm_source,
    lead: Array.isArray(row.lead) ? row.lead[0] ?? null : row.lead,
    event_type: Array.isArray(row.event_type) ? row.event_type[0] ?? null : row.event_type,
  }));
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Session expired — please reload the page and log in again.",
  "invalid-request": "That request was missing required data. Please try again.",
  "booking-not-found": "That booking no longer exists.",
  "update-failed": "Failed to update the booking. Please try again.",
  "calendar-delete-failed":
    "Couldn't remove the Google Calendar event, so the booking was left in place rather than deleting it without cleaning that up. Please try again.",
  "delete-failed": "Failed to delete the booking. Please try again.",
};

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const bookings = await loadBookings();
  const now = Date.now();

  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && b.scheduled_at && new Date(b.scheduled_at).getTime() >= now
  );
  const recent = bookings.filter((b) => !upcoming.includes(b));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Bookings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Mark calls as attended or no-show once they&apos;ve happened.
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {ERROR_MESSAGES[error] ?? "Something went wrong. Please try again."}
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Upcoming ({upcoming.length})
        </h2>
        <AdminBookingsTable bookings={upcoming} emptyLabel="No upcoming confirmed calls." />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Recent
        </h2>
        <AdminBookingsTable bookings={recent} emptyLabel="No other bookings yet." />
      </section>
    </div>
  );
}
