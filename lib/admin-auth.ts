import { NextRequest } from "next/server";

/** Validates the HTTP Basic Auth header against ADMIN_BASIC_AUTH_USER/PASSWORD. */
export function isAdminAuthorized(req: NextRequest): boolean {
  const expectedUser = process.env.ADMIN_BASIC_AUTH_USER;
  const expectedPassword = process.env.ADMIN_BASIC_AUTH_PASSWORD;
  if (!expectedUser || !expectedPassword) return false;

  const header = req.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  // atob (not Buffer) so this also works from Edge-runtime middleware.
  const decoded = atob(header.slice(6));
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return false;

  const user = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  return user === expectedUser && password === expectedPassword;
}
