"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTracking } from "@/hooks/useTracking";

interface Slot {
  startISO: string;
  endISO: string;
}

interface EventTypeInfo {
  name: string;
  headline: string | null;
  durationMin: number;
}

export default function BookingWidget({ eventTypeSlug }: { eventTypeSlug: string }) {
  const router = useRouter();
  const tracking = useTracking();

  const [step, setStep] = useState<1 | 2>(1);
  const [eventTypeInfo, setEventTypeInfo] = useState<EventTypeInfo | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [bookingId, setBookingId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Best-effort only: this just fills in the display name/duration. If it
    // fails (network blip, cold start), the widget still works — an actually
    // unknown eventType surfaces as a real error when step 1 is submitted.
    fetch(`/api/event-types/${encodeURIComponent(eventTypeSlug)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) =>
        setEventTypeInfo({ name: data.name, headline: data.headline, durationMin: data.durationMin })
      )
      .catch(() => {});
  }, [eventTypeSlug]);

  useEffect(() => {
    if (step !== 2) return;
    setSlotsLoading(true);
    fetch(`/api/availability?eventType=${encodeURIComponent(eventTypeSlug)}`)
      .then((res) => res.json())
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setError("Couldn't load available times. Please refresh and try again."))
      .finally(() => setSlotsLoading(false));
  }, [step, eventTypeSlug]);

  const slotsByDay = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    for (const slot of slots) {
      const d = new Date(slot.startISO);
      const key = d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      const list = groups.get(key) ?? [];
      list.push(slot);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [slots]);

  async function submitStep1(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError("Please enter your name and email.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/booking/step1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          eventTypeSlug,
          ...tracking,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");

      setBookingId(data.bookingId);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitStep2(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }
    if (!selectedSlot) {
      setError("Please choose a time.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/booking/step2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          phone: phone.trim(),
          slotStartISO: selectedSlot.startISO,
          slotEndISO: selectedSlot.endISO,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");

      const params = new URLSearchParams({
        scheduledAt: data.scheduledAt,
        eventTypeName: data.eventTypeName,
      });
      router.push(`/booking/confirmed?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full ${
              step === 1 ? "bg-brand text-white" : "bg-brand-light text-brand"
            }`}
          >
            1
          </span>
          <span className="h-px w-6 bg-gray-200" />
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full ${
              step === 2 ? "bg-brand text-white" : "bg-gray-100 text-gray-400"
            }`}
          >
            2
          </span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">
          {eventTypeInfo ? eventTypeInfo.headline ?? eventTypeInfo.name : "Book a call"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {step === 1
            ? "Start with your name and email — takes 10 seconds."
            : `Add your phone number and pick a time${
                eventTypeInfo ? ` (${eventTypeInfo.durationMin} min)` : ""
              }.`}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {step === 1 && (
        <form onSubmit={submitStep1} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="Jane Smith"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="jane@example.com"
              autoComplete="email"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {submitting ? "Continuing…" : "Continue"}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={submitStep2} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="(555) 555-5555"
              autoComplete="tel"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Choose a time</label>
            {slotsLoading && <p className="text-sm text-gray-500">Loading available times…</p>}
            {!slotsLoading && slotsByDay.length === 0 && (
              <p className="text-sm text-gray-500">No open times found. Please check back soon.</p>
            )}
            <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {slotsByDay.map(([day, daySlots]) => (
                <div key={day}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {day}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {daySlots.map((slot) => {
                      const isSelected = selectedSlot?.startISO === slot.startISO;
                      return (
                        <button
                          type="button"
                          key={slot.startISO}
                          onClick={() => setSelectedSlot(slot)}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                            isSelected
                              ? "border-brand bg-brand text-white"
                              : "border-gray-200 text-gray-700 hover:border-brand"
                          }`}
                        >
                          {new Date(slot.startISO).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {submitting ? "Booking…" : "Confirm booking"}
          </button>
        </form>
      )}
    </div>
  );
}
