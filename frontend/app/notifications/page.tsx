"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchNotifications, type Notification } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from "@/components/ui";

function relativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;

  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setItems(await fetchNotifications(user.id));
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not reach the notification service."
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void load();
  }, [authLoading, user, load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Notifications"
        description="Ride updates sent by the notification service."
        action={
          <Button variant="secondary" onClick={() => void load()} loading={loading}>
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {!authLoading && !user ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-600">Please sign in to view notifications.</p>
          <Link href="/login?next=/notifications" className="mt-4 inline-block">
            <Button>Sign in</Button>
          </Link>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-6 w-6 text-brand-600" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="No notifications yet"
            description="Updates about your rides will appear here."
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 p-4">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M10 2a6 6 0 00-6 6v3.586l-1.707 1.707A1 1 0 003.707 15h12.586a1 1 0 00.707-1.707L15 11.586V8a6 6 0 00-6-6zm0 16a3 3 0 002.83-2H7.17A3 3 0 0010 18z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-900">{item.message}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>{relativeTime(item.created_at)}</span>
                    {item.ride_id && (
                      <Link
                        href={`/rides/${item.ride_id}`}
                        className="font-semibold text-brand-600 hover:text-brand-700"
                      >
                        View ride
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}