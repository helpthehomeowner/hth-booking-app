import { Suspense } from "react";
import BookingConfirmedContent from "@/components/BookingConfirmedContent";

export const dynamic = "force-dynamic";

export default function BookingConfirmedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Suspense fallback={<div className="text-sm text-gray-400">Loading…</div>}>
        <BookingConfirmedContent />
      </Suspense>
    </div>
  );
}
