import { Suspense } from "react";
import BookingWidget from "@/components/BookingWidget";

export const dynamic = "force-dynamic";

export default async function EmbedBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event: eventTypeSlug } = await searchParams;

  if (!eventTypeSlug) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4 text-sm text-gray-500">
        Missing required &quot;event&quot; query param, e.g. ?event=tier4-workshop
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <Suspense fallback={<div className="text-sm text-gray-400">Loading…</div>}>
        <BookingWidget eventTypeSlug={eventTypeSlug} />
      </Suspense>
    </div>
  );
}
