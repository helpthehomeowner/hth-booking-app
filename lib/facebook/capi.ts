// Facebook / Meta Conversions API (server-side) client, scoped to sending one
// standard "Schedule" event when a call is booked. Mirrors the signup
// widget's client (hth-signup-widget/lib/facebook/capi.ts) so both apps send
// to the same pixel the same way.
//
// Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
// Endpoint: POST https://graph.facebook.com/v21.0/<PIXEL_ID>/events
//
// Match quality comes from `user_data`: email, phone and name are SHA-256
// hashed (normalized first); IP and user-agent are sent raw; fbc/fbp are
// forwarded from the page that sent the seller here (e.g. the Walk-Away quiz).

import { createHash } from "crypto";

const GRAPH_VERSION = "v21.0";

function capiConfig() {
  const pixelId = process.env.FACEBOOK_PIXEL_ID;
  const accessToken = process.env.FACEBOOK_CAPI_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    throw new Error("Missing FACEBOOK_PIXEL_ID or FACEBOOK_CAPI_ACCESS_TOKEN env vars");
  }
  return { pixelId, accessToken, testEventCode: process.env.FACEBOOK_TEST_EVENT_CODE || null };
}

/** True when CAPI is configured; callers skip silently otherwise. */
export function isCapiConfigured(): boolean {
  return Boolean(process.env.FACEBOOK_PIXEL_ID && process.env.FACEBOOK_CAPI_ACCESS_TOKEN);
}

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Meta wants digits only, with country code; assume US for 10-digit numbers. */
function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "1" + digits;
  return digits.length >= 11 ? digits : null;
}

/** Meta's fbc format: fb.1.<click-time-ms>.<fbclid>. */
export function buildFbc(fbclid: string | null | undefined, clickTimeMs: number): string | null {
  if (!fbclid) return null;
  return `fb.1.${clickTimeMs}.${fbclid}`;
}

export interface CapiEventInput {
  eventName: string;
  /** Stable id so Meta de-dupes a retry or a matching browser Pixel event. */
  eventId: string;
  eventSourceUrl: string | null;
  email: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbc?: string | null;
  fbp?: string | null;
}

/** Sends a single event. Throws on a non-2xx response. */
export async function sendCapiEvent(input: CapiEventInput): Promise<number> {
  const { pixelId, accessToken, testEventCode } = capiConfig();

  const userData: Record<string, unknown> = { em: [sha256(input.email)] };
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (phone) userData.ph = [sha256(phone)];
  if (input.firstName) userData.fn = [sha256(input.firstName)];
  if (input.lastName) userData.ln = [sha256(input.lastName)];
  if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;
  if (input.fbc) userData.fbc = input.fbc;
  if (input.fbp) userData.fbp = input.fbp;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_id: input.eventId,
        ...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
        user_data: userData,
      },
    ],
  };
  if (testEventCode) body.test_event_code = testEventCode;

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(
      accessToken
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Facebook CAPI error: ${json?.error?.message ?? `HTTP ${res.status}`}`);
  }
  return json?.events_received ?? 0;
}

/** Best-effort client IP from Vercel/proxy headers (first hop of x-forwarded-for). */
export function clientIpFromHeaders(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip");
}
