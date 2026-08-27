import { NextRequest } from "next/server";

/** Vercel Cron automatically sends "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set. */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
