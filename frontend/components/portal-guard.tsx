"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  PORTAL_DESCRIPTION,
  PORTAL_HOME,
  PORTAL_LABEL,
  canAccessPortal,
  landingPathForRole,
  portalsForRole,
  type Portal,
} from "@/lib/portals";
import { Button, Card, Spinner } from "@/components/ui";

/**
 * Gate for portal pages. Anyone who is not allowed inside is sent back to the
 * portal they do belong to, so a passenger who types /driver into the URL is
 * redirected instead of being shown driver-only screens.
 *
 * Signed-out visitors are sent to sign in with a `next` param so they land
 * back here after authenticating.
 */
export function RequirePortal({
  portal,
  children,
}: {
  portal: Portal;
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  const allowed = canAccessPortal(user?.role, portal);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(PORTAL_HOME[portal])}`);
      return;
    }
    if (!allowed) {
      router.replace(landingPathForRole(user.role));
    }
  }, [loading, user, allowed, portal, router]);

  if (loading || !user || !allowed) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-6 w-6 text-indigo-600" />
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Shown when a signed-in user reaches a portal they cannot use. It explains
 * why and offers the correct portal plus a way to change their role, instead
 * of a silent redirect that looks like a broken link.
 */
export function PortalNotAllowed({ portal }: { portal: Portal }) {
  const { user } = useAuth();

  if (!user) return null;

  const ownPortals = portalsForRole(user.role);
  const ownPortal = ownPortals[0] ?? "rider";

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          {PORTAL_LABEL[portal]} access only
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This area is for {PORTAL_LABEL[portal].toLowerCase()} accounts. Your account is set up
          for {ownPortals.map((item) => PORTAL_LABEL[item].toLowerCase()).join(" and ")}.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link href={PORTAL_HOME[ownPortal]}>
            <Button className="w-full">Go to my {PORTAL_LABEL[ownPortal].toLowerCase()} portal</Button>
          </Link>
          <Link href="/profile">
            <Button variant="secondary" className="w-full">
              Change my account type
            </Button>
          </Link>
        </div>

        <p className="mt-5 text-xs text-slate-400">{PORTAL_DESCRIPTION[portal]}</p>
      </Card>
    </div>
  );
}