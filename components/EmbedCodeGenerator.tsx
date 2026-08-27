"use client";

import { useMemo, useState } from "react";

export interface EmbedEventType {
  slug: string;
  name: string;
}

function useOrigin() {
  const [origin, setOrigin] = useState("");
  useMemo(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);
  return origin;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be blocked (permissions, non-HTTPS); nothing more we can do here.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-brand hover:text-brand"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function EventTypeCard({ eventType, origin }: { eventType: EmbedEventType; origin: string }) {
  const [source, setSource] = useState("");

  const embedUrl = `${origin}/embed/booking?event=${encodeURIComponent(eventType.slug)}${
    source ? `&source=${encodeURIComponent(source)}` : ""
  }`;
  const directUrl = `${origin}/book/${encodeURIComponent(eventType.slug)}${
    source ? `?source=${encodeURIComponent(source)}` : ""
  }`;
  const iframeSnippet = `<iframe\n  src="${embedUrl}"\n  style="width:100%;max-width:480px;height:640px;border:0"\n  title="Book a call"\n></iframe>`;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900">{eventType.name}</h2>
      <p className="text-xs text-gray-400">{eventType.slug}</p>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Source label (optional — identifies which page this came from)
        </label>
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="e.g. reviewmyhouse-quiz"
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-gray-700">
            Iframe embed (WordPress, Thrive, static HTML)
          </label>
          <CopyButton text={iframeSnippet} />
        </div>
        <textarea
          readOnly
          value={iframeSnippet}
          rows={5}
          className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700"
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-gray-700">Direct link (standalone page)</label>
          <CopyButton text={directUrl} />
        </div>
        <input
          readOnly
          value={directUrl}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700"
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
    </div>
  );
}

export default function EmbedCodeGenerator({ eventTypes }: { eventTypes: EmbedEventType[] }) {
  const origin = useOrigin();

  return (
    <div className="mt-6 space-y-4">
      {eventTypes.map((et) => (
        <EventTypeCard key={et.slug} eventType={et} origin={origin} />
      ))}
    </div>
  );
}
