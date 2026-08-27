import { supabaseAdmin } from "@/lib/supabase/server";
import EmbedCodeGenerator, { type EmbedEventType } from "@/components/EmbedCodeGenerator";

export const dynamic = "force-dynamic";

async function loadEventTypes(): Promise<EmbedEventType[]> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("event_types")
    .select("slug, name")
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("Failed to load event types for embed codes page", error);
    return [];
  }

  return data ?? [];
}

export default async function EmbedCodesPage() {
  const eventTypes = await loadEventTypes();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Embed Codes</h1>
      <p className="mt-1 text-sm text-gray-500">
        Copy an iframe snippet for any landing page or quiz platform (WordPress, Thrive,
        static HTML), or a direct link for a standalone page. Fill in a source label to
        track which page a booking came from.
      </p>

      {eventTypes.length === 0 ? (
        <p className="mt-8 text-sm text-gray-400">No active event types yet.</p>
      ) : (
        <EmbedCodeGenerator eventTypes={eventTypes} />
      )}
    </div>
  );
}
