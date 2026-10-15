import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Read-only booking feed for the signup widget's Ads dashboard, which joins
// bookings to signups by email so you can see which ads led to booked and
// attended calls. Authorized either as an admin (Basic Auth) or with a shared
// read-only bearer token (ATTRIBUTION_EXPORT_TOKEN) — the token exists so the
// other app doesn't have to store this app's admin password.
function hasValidBearerToken(req: NextRequest): boolean {
  const expected = process.env.ATTRIBUTION_EXPORT_TOKEN;
  if (!expected) return false;

  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(header.slice(7));
  const wanted = Buffer.from(expected);
  return provided.length === wanted.length && timingSafeEqual(provided, wanted);
}

const PAGE_SIZE = 1000; // PostgREST's default max rows per request

export async function GET(req: NextRequest) {
  if (!hasValidBearerToken(req) && !isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const bookings: {
    email: string;
    name: string | null;
    status: string;
    scheduledAt: string | null;
    createdAt: string;
    eventType: string | null;
  }[] = [];

  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from("bookings")
      .select("status, scheduled_at, created_at, lead:leads(email, name), event_type:event_types(name)")
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error("bookings-export query failed", error);
      return NextResponse.json({ error: "Failed to load bookings" }, { status: 500 });
    }

    for (const row of (data ?? []) as any[]) {
      // Supabase types a to-one embed as an array; flatten it.
      const lead = Array.isArray(row.lead) ? row.lead[0] : row.lead;
      const eventType = Array.isArray(row.event_type) ? row.event_type[0] : row.event_type;
      if (!lead?.email) continue;

      bookings.push({
        email: String(lead.email).toLowerCase(),
        name: lead.name ?? null,
        status: row.status,
        scheduledAt: row.scheduled_at,
        createdAt: row.created_at,
        eventType: eventType?.name ?? null,
      });
    }

    if (!data || data.length < PAGE_SIZE) break;
  }

  return NextResponse.json({ bookings });
}
