"use client";

import { BookRide } from "@/components/book-ride";
import { Landing } from "@/components/landing";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    );
  }

  return user ? <BookRide /> : <Landing />;
}
