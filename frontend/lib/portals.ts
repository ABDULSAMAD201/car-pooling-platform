import type { User, UserRole } from "@/lib/api";

/**
 * The product has two separate portals. A passenger books and tracks rides, a
 * driver publishes availability and picks up matches. They are deliberately
 * different surfaces: a passenger must never land in the driver portal, and a
 * driver has no reason to see the booking form.
 *
 * `role` on the account decides which portals exist for that user. A "both"
 * account legitimately belongs to each portal in turn, so the header offers a
 * switcher rather than forcing one choice at signup.
 */
export type Portal = "rider" | "driver";

export const PORTAL_HOME: Record<Portal, string> = {
  rider: "/",
  driver: "/driver",
};

export const PORTAL_LABEL: Record<Portal, string> = {
  rider: "Passenger",
  driver: "Driver",
};

export const PORTAL_DESCRIPTION: Record<Portal, string> = {
  rider: "Book rides and track your trips.",
  driver: "Go online and manage your routes.",
};

/** Roles that are allowed into each portal. */
const PORTAL_ROLES: Record<Portal, readonly UserRole[]> = {
  rider: ["rider", "both"],
  driver: ["driver", "both"],
};

export function canAccessPortal(role: UserRole | undefined, portal: Portal): boolean {
  if (!role) return false;
  return PORTAL_ROLES[portal].includes(role);
}

/** Every portal the given account may enter, in display order. */
export function portalsForRole(role: UserRole | undefined): Portal[] {
  return (["rider", "driver"] as const).filter((portal) => canAccessPortal(role, portal));
}

/**
 * Where to send someone straight after they sign in or create an account.
 * A driver-only account should never be dropped on the passenger home page.
 */
export function landingPathForRole(role: UserRole | undefined): string {
  if (canAccessPortal(role, "driver") && !canAccessPortal(role, "rider")) {
    return PORTAL_HOME.driver;
  }
  return PORTAL_HOME.rider;
}

/**
 * True when `path` belongs to the given portal. Used to keep the header's
 * active state in sync with the portal the user is actually looking at.
 */
export function isPathInPortal(path: string, portal: Portal): boolean {
  const prefix = PORTAL_HOME[portal];
  if (prefix === "/") return path === "/" || !path.startsWith("/driver");
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isDriverOnlyUser(user: User | null): boolean {
  if (!user) return false;
  return canAccessPortal(user.role, "driver") && !canAccessPortal(user.role, "rider");
}