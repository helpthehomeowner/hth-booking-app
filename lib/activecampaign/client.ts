// Minimal ActiveCampaign API v3 client, scoped to exactly what this app
// needs: find/create a contact by email, and keep exactly one "booking
// status" tag on a contact at a time.

// The exclusive status tags are event-type-specific in practice (e.g.
// "Booked-Pending — Already Listed Workshop"), so exclusivity is matched by
// prefix rather than an exact set of known tag strings.
const STATUS_PREFIXES = ["Booked-Pending", "Booked-Attended", "Booked-NoShow"] as const;

function acConfig() {
  const baseUrl = process.env.ACTIVECAMPAIGN_API_URL;
  const apiKey = process.env.ACTIVECAMPAIGN_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Missing ACTIVECAMPAIGN_API_URL or ACTIVECAMPAIGN_API_KEY env vars");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

async function acFetch(path: string, init: RequestInit = {}) {
  const { baseUrl, apiKey } = acConfig();
  const res = await fetch(`${baseUrl}/api/3${path}`, {
    ...init,
    headers: {
      "Api-Token": apiKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ActiveCampaign API error ${res.status} on ${path}: ${body}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export interface ContactFields {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

/** Finds a contact by email, creating one if none exists. Returns the AC contact id. */
export async function getOrCreateAcContact(
  email: string,
  fields: ContactFields = {}
): Promise<string> {
  const search = await acFetch(`/contacts?email=${encodeURIComponent(email)}`);
  const existing = search?.contacts?.[0];

  if (existing) {
    // Patch in any newly-known fields (e.g. phone captured at step 2) without clobbering existing data.
    const hasUpdates = fields.firstName || fields.lastName || fields.phone;
    if (hasUpdates) {
      await acFetch(`/contacts/${existing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          contact: {
            ...(fields.firstName ? { firstName: fields.firstName } : {}),
            ...(fields.lastName ? { lastName: fields.lastName } : {}),
            ...(fields.phone ? { phone: fields.phone } : {}),
          },
        }),
      });
    }
    return existing.id as string;
  }

  const created = await acFetch(`/contacts`, {
    method: "POST",
    body: JSON.stringify({
      contact: {
        email,
        firstName: fields.firstName ?? undefined,
        lastName: fields.lastName ?? undefined,
        phone: fields.phone ?? undefined,
      },
    }),
  });

  return created.contact.id as string;
}

async function findOrCreateTagId(tagName: string): Promise<string> {
  const search = await acFetch(`/tags?search=${encodeURIComponent(tagName)}`);
  const existing = (search?.tags ?? []).find((t: { tag: string }) => t.tag === tagName);
  if (existing) return existing.id as string;

  const created = await acFetch(`/tags`, {
    method: "POST",
    body: JSON.stringify({ tag: { tag: tagName, tagType: "contact" } }),
  });
  return created.tag.id as string;
}

async function getContactTagLinks(
  contactId: string
): Promise<{ contactTagId: string; tagId: string; tagName: string }[]> {
  const res = await acFetch(`/contacts/${contactId}/contactTags`);
  const links = res?.contactTags ?? [];

  const withNames = await Promise.all(
    links.map(async (link: { id: string; tag: string }) => {
      const tag = await acFetch(`/tags/${link.tag}`);
      return { contactTagId: link.id, tagId: link.tag, tagName: tag?.tag?.tag as string };
    })
  );

  return withNames;
}

/**
 * The single place a booking-status tag ever changes on a contact. The tag
 * always encodes both the status and the event type (e.g.
 * "Booked-Pending — Already Listed Workshop"), so multiple event types stay
 * distinguishable in ActiveCampaign. Removes whichever of the
 * mutually-exclusive status tags (Booked-Pending, Booked-Attended,
 * Booked-NoShow — for any event type) the contact currently has, then adds
 * the new one, so a contact never carries more than one status tag at once
 * even across different event types. Also used for the funnel-stage tags
 * (Booking-Started, Booking-Abandoned-Step2), which simply get added on top
 * without removing anything.
 */
export async function syncBookingTag(
  contactId: string,
  statusBase: string,
  eventTypeName: string
): Promise<void> {
  const fullTag = `${statusBase} — ${eventTypeName}`;
  const tagId = await findOrCreateTagId(fullTag);
  const current = await getContactTagLinks(contactId);

  const toRemove = current.filter(
    (c) => c.tagId !== tagId && STATUS_PREFIXES.some((p) => c.tagName.startsWith(p))
  );
  await Promise.all(
    toRemove.map((c) => acFetch(`/contactTags/${c.contactTagId}`, { method: "DELETE" }))
  );

  if (!current.some((c) => c.tagId === tagId)) {
    await acFetch(`/contactTags`, {
      method: "POST",
      body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } }),
    });
  }
}
