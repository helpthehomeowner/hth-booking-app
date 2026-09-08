"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

export interface EventTypeOption {
  slug: string;
  name: string;
  durationMin: number;
}

interface Slot {
  startISO: string;
  endISO: string;
}

export default function AdminNewBookingForm({ eventTypes }: { eventTypes: EventTypeOption[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventTypeSlug, setEventTypeSlug] = useState(eventTypes[0]?.slug ?? "");

  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const selectedEventType = eventTypes.find((et) => et.slug === eventTypeSlug) ?? null;

  useEffect(() => {
    if (!eventTypeSlug) return;
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedSlot(null);
    // Public endpoint (same one the visitor-facing widget uses) — fine to
    // call directly with fetch, unlike the admin-gated mutation routes.
    fetch(`/api/availability?eventType=${encodeURIComponent(eventTypeSlug)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlotsError("Couldn't load available times."))
      .finally(() => setSlotsLoading(false));
  }, [eventTypeSlug]);

  const slotsByDay = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = new Date(slot.startISO).toLocaleDateString(undefined, {
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

  const isValid = name.trim() && email.trim() && phone.trim() && eventTypeSlug && selectedSlot;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    if (!isValid) {
      e.preventDefault();
      window.alert("Please fill in name, email, phone, and pick a time before booking.");
    }
  }

  return (
    <form
      action="/api/admin/create-booking"
      method="POST"
      onSubmit={onSubmit}
      className="mt-6 space-y-5 rounded-xl border border-gray-200 bg-white p-5"
    >
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="eventTypeSlug" value={eventTypeSlug} />
      <input type="hidden" name="slotStartISO" value={selectedSlot?.startISO ?? ""} />
      <input type="hidden" name="slotEndISO" value={selectedSlot?.endISO ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Full name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            placeholder="Jane Smith"
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
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Phone number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            placeholder="(555) 555-5555"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Call type</label>
          <select
            value={eventTypeSlug}
            onChange={(e) => setEventTypeSlug(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {eventTypes.map((et) => (
              <option key={et.slug} value={et.slug}>
                {et.name} ({et.durationMin} min)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Choose a time{selectedEventType ? ` (${selectedEventType.durationMin} min)` : ""}
        </label>
        {slotsLoading && <p className="text-sm text-gray-500">Loading Rene&apos;s availability…</p>}
        {slotsError && <p className="text-sm text-red-600">{slotsError}</p>}
        {!slotsLoading && !slotsError && slotsByDay.length === 0 && (
          <p className="text-sm text-gray-500">No open times found for this call type.</p>
        )}
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {slotsByDay.map(([day, daySlots]) => (
            <div key={day}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{day}</p>
              <div className="grid grid-cols-4 gap-2">
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
        className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        Create Booking
      </button>
    </form>
  );
}
