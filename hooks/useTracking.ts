"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export interface Tracking {
  source_url: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
}

/**
 * Resolves where a booking came from. When embedded (iframe on a quiz page,
 * landing page, etc.) the page itself is the widget, not the landing page,
 * so source_url prefers document.referrer (the parent page) over the
 * iframe's own URL. utm_* params come from whatever query string this page
 * was loaded with; the embed's shorthand `source` param (e.g.
 * "reviewmyhouse-quiz") is used as a utm_source fallback when no explicit
 * utm_source was passed.
 */
export function useTracking(): Tracking {
  const searchParams = useSearchParams();
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  useEffect(() => {
    const isEmbedded = window.self !== window.top;
    const referrer = document.referrer || null;
    setSourceUrl(isEmbedded && referrer ? referrer : window.location.href);
  }, []);

  const source = searchParams.get("source");

  return {
    source_url: sourceUrl,
    utm_source: searchParams.get("utm_source") ?? source ?? null,
    utm_campaign: searchParams.get("utm_campaign"),
    utm_medium: searchParams.get("utm_medium"),
  };
}
