import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const eventTypeSlug = req.nextUrl.searchParams.get("eventType");

  if (!eventTypeSlug) {
    return NextResponse.json({ error: "eventType query param is required" }, { status: 400 });
  }

  const result = await getAvailableSlots(eventTypeSlug);

  if (!result) {
    return NextResponse.json({ error: "Unknown or inactive eventType" }, { status: 404 });
  }

  return NextResponse.json({
    eventType: {
      slug: result.eventType.slug,
      name: result.eventType.name,
      durationMin: result.eventType.duration_min,
    },
    timezone: result.host.timezone,
    slots: result.slots,
  });
}
