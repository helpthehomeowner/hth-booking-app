import { Suspense } from "react";
import BookingWidget from "@/components/BookingWidget";

export const dynamic = "force-dynamic";

export default async function StandaloneBookingPage({
  params,
}: {
  params: Promise<{ eventType: string }>;
}) {
  const { eventType } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Suspense fallback={<div className="text-sm text-gray-400">Loading…</div>}>
        <BookingWidget eventTypeSlug={eventType} />
      </Suspense>
    </div>
  );
}
