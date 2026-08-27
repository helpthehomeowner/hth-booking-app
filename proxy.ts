import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

// Next.js 16 renamed the "middleware" convention to "proxy" (nodejs runtime only).
export function proxy(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="HTH Booking Admin"' },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
