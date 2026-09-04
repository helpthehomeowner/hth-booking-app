"use client";

import type { FormEvent } from "react";
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

function confirmDelete(e: FormEvent<HTMLFormElement>, label: string) {
  if (!window.confirm(`Delete this booking (${label})? This also removes its Google Calendar event, if any. This can't be undone.`)) {
    e.preventDefault();
  }
}

export default function AdminBookingsTable({
  bookings,
  emptyLabel,
}: {
  bookings: AdminBookingRow[];
  emptyLabel: string;
}) {
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
                <div className="flex flex-wrap justify-end gap-2">
                  {b.status === "confirmed" && (
                    <>
                      <form action="/api/booking/mark-outcome" method="POST">
                        <input type="hidden" name="bookingId" value={b.id} />
                        <input type="hidden" name="outcome" value="attended" />
                        <button
                          type="submit"
                          className="rounded-md border border-green-300 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                        >
                          Mark Attended
                        </button>
                      </form>
                      <form action="/api/booking/mark-outcome" method="POST">
                        <input type="hidden" name="bookingId" value={b.id} />
                        <input type="hidden" name="outcome" value="no_show" />
                        <button
                          type="submit"
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Mark No-Show
                        </button>
                      </form>
                    </>
                  )}
                  <form
                    action="/api/booking/delete"
                    method="POST"
                    onSubmit={(e) => confirmDelete(e, b.lead?.email ?? b.id)}
                  >
                    <input type="hidden" name="bookingId" value={b.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
