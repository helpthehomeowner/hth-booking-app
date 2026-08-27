import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = supabaseAdmin();

  const { data: eventType } = await supabase
    .from("event_types")
    .select("slug, name, headline, duration_min")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (!eventType) {
    return NextResponse.json({ error: "Unknown or inactive eventType" }, { status: 404 });
  }

  return NextResponse.json({
    slug: eventType.slug,
    name: eventType.name,
    headline: eventType.headline,
    durationMin: eventType.duration_min,
  });
}
