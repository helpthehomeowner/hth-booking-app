export const dynamic = "force-dynamic";

export default async function BookingConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ scheduledAt?: string; eventTypeName?: string }>;
}) {
  const params = await searchParams;
  const scheduledAt = params.scheduledAt ? new Date(params.scheduledAt) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">You&apos;re booked!</h1>
        {params.eventTypeName && (
          <p className="mt-2 text-sm text-gray-600">{params.eventTypeName}</p>
        )}
        {scheduledAt && (
          <p className="mt-1 text-sm font-medium text-gray-900">
            {scheduledAt.toLocaleString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
        <p className="mt-4 text-sm text-gray-500">
          We&apos;ve sent a calendar invite to your email. See you then!
        </p>
      </div>
    </div>
  );
}
