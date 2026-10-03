"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  PORTAL_LABEL,
  isPathInPortal,
  portalsForRole,
  type Portal,
} from "@/lib/portals";
import { Button } from "@/components/ui";

interface NavLink {
  href: string;
  label: string;
}

/** Each portal owns its own pages, so the two never share a screen. */
const PORTAL_NAV: Record<Portal, NavLink[]> = {
  rider: [
    { href: "/", label: "Book a ride" },
    { href: "/rides", label: "My rides" },
  ],
  driver: [
    { href: "/driver", label: "Go online" },
    { href: "/driver/dashboard", label: "Driver dashboard" },
    { href: "/driver/nearby", label: "Drivers nearby" },
  ],
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initialsFor(name: string, email: string): string {
  const source = name.trim() || email.split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // A "both" account can be in either portal; `null` means follow the URL.
  const [chosenPortal, setChosenPortal] = useState<Portal | null>(null);

  const allowedPortals = portalsForRole(user?.role);

  // While signed out every link is shown so the landing page is reachable.
  const visiblePortals: Portal[] = allowedPortals.length > 0 ? allowedPortals : ["rider", "driver"];

  const portalFromPath = visiblePortals.find((portal) => isPathInPortal(pathname, portal));
  const activePortal = chosenPortal ?? portalFromPath ?? visiblePortals[0];

  const navLinks = PORTAL_NAV[activePortal];

  function handleLogout() {
    logout();
    setMenuOpen(false);
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
              C
            </span>
            <span className="hidden text-lg font-bold tracking-tight text-slate-900 sm:block">
              Carpool
            </span>
          </Link>

          {/* Portal switcher — only rendered when the account may use both. */}
          {visiblePortals.length > 1 && (
            <div
              role="tablist"
              aria-label="Choose portal"
              className="ml-2 hidden items-center rounded-lg bg-slate-100 p-0.5 md:flex"
            >
              {visiblePortals.map((portal) => (
                <button
                  key={portal}
                  type="button"
                  role="tab"
                  aria-selected={activePortal === portal}
                  onClick={() => setChosenPortal(portal)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    activePortal === portal
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {PORTAL_LABEL[portal]}
                </button>
              ))}
            </div>
          )}

          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive(pathname, link.href)
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-slate-100"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                    {initialsFor(user.full_name, user.email)}
                  </span>
                  <span className="hidden max-w-[10rem] truncate text-sm font-medium text-slate-700 sm:block">
                    {user.full_name || user.email}
                  </span>
                  <svg
                    className="h-4 w-4 text-slate-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuOpen(false)}
                      aria-hidden="true"
                    />
                    <div
                      role="menu"
                      className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200"
                    >
                      <div className="border-b border-slate-100 px-4 py-3">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {user.full_name || "Your account"}
                        </p>
                        <p className="truncate text-xs text-slate-500">{user.email}</p>
                      </div>
                      <Link
                        href="/profile"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Profile
                      </Link>
                      <Link
                        href="/settings"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Settings
                      </Link>
                      <Link
                        href="/notifications"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Notifications
                      </Link>
                      <div className="border-t border-slate-100 p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={handleLogout}
                        >
                          Sign out
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => router.push("/login")}>
                  Sign in
                </Button>
                <Button size="sm" onClick={() => router.push("/signup")}>
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile navigation */}
        <nav className="flex flex-wrap items-center gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
          {visiblePortals.length > 1 && (
            <span className="mr-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
              {PORTAL_LABEL[activePortal]}
            </span>
          )}
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive(pathname, link.href)
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-slate-500 sm:px-6 lg:px-8">
          <p>Carpool — share rides, split costs, travel better.</p>
        </div>
      </footer>
    </div>
  );
}