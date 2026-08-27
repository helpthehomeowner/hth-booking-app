import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl gap-6 px-4 py-3 text-sm font-medium">
          <Link href="/admin/bookings" className="text-gray-700 hover:text-brand">
            Bookings
          </Link>
          <Link href="/admin/embed-codes" className="text-gray-700 hover:text-brand">
            Embed Codes
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
