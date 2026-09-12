import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Lists active event types. Same trust level as GET /api/event-types/[slug]
 * (already public, used by the embedded widget) — no booking/lead data, just
 * the public-facing name/slug/duration. Used by the cross-app widgets
 * directory (hth-widgets-directory) to show live booking-call listings.
 */
export async function GET() {
  const supabase = supabaseAdmin();

  const { data: eventTypes } = await supabase
    .from("event_types")
    .select("slug, name, headline, duration_min")
    .eq("active", true)
    .order("name");

  return NextResponse.json({
    eventTypes: (eventTypes ?? []).map((e) => ({
      slug: e.slug,
      name: e.name,
      headline: e.headline,
      durationMin: e.duration_min,
    })),
  });
}
