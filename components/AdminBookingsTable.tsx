"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingStatus } from "@/lib/types";

export interface AdminBookingRow {
  id: string;
  status: BookingStatus;
  scheduled_at: string | null;
  created_at: string;
  source_url: string | null;
  utm_source: string | null;
  lead: { name: string | null; email: string; phone: string | null } | null;
  event_type: { name: string; slug: string } | null;
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending_step2: "bg-gray-100 text-gray-600",
  confirmed: "bg-blue-100 text-blue-700",
  attended: "bg-green-100 text-green-700",
  no_show: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-400",
};

export default function AdminBookingsTable({
  bookings,
  emptyLabel,
}: {
  bookings: AdminBookingRow[];
  emptyLabel: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function markOutcome(bookingId: string, outcome: "attended" | "no_show") {
    setPendingId(bookingId);
    setErrorId(null);
    try {
      const res = await fetch("/api/booking/mark-outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, outcome }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setErrorId(bookingId);
    } finally {
      setPendingId(null);
    }
  }

  if (bookings.length === 0) {
    return <p className="text-sm text-gray-400">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Lead</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Event</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Scheduled</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Source</th>
            <th className="px-4 py-2 text-right font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {bookings.map((b) => (
            <tr key={b.id}>
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{b.lead?.name ?? "—"}</div>
                <div className="text-gray-500">{b.lead?.email}</div>
                <div className="text-gray-400">{b.lead?.phone ?? ""}</div>
              </td>
              <td className="px-4 py-3 text-gray-700">{b.event_type?.name ?? "—"}</td>
              <td className="px-4 py-3 text-gray-700">
                {b.scheduled_at
                  ? new Date(b.scheduled_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[b.status]}`}
                >
                  {b.status.replace("_", " ")}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-400">{b.utm_source ?? "—"}</td>
              <td className="px-4 py-3 text-right">
                {b.status === "confirmed" ? (
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => markOutcome(b.id, "attended")}
                      disabled={pendingId === b.id}
                      className="rounded-md border border-green-300 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                    >
                      Mark Attended
                    </button>
                    <button
                      onClick={() => markOutcome(b.id, "no_show")}
                      disabled={pendingId === b.id}
                      className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Mark No-Show
                    </button>
                  </div>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
                {errorId === b.id && (
                  <div className="mt-1 text-xs text-red-500">Failed, try again</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
