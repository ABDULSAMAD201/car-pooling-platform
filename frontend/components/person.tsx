import type { ReactNode } from "react";

export type PersonRole = "passenger" | "driver";

const ROLE_STYLES: Record<PersonRole, { label: string; badge: string; avatar: string }> = {
  passenger: {
    label: "Passenger",
    badge: "bg-sky-100 text-sky-800 ring-sky-600/20",
    avatar: "bg-sky-100 text-sky-700",
  },
  driver: {
    label: "Driver",
    badge: "bg-brand-100 text-brand-800 ring-brand-600/20",
    avatar: "bg-brand-100 text-brand-700",
  },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

/** One person on a ride, always labelled with the part they play in it. */
export function PersonRow({
  role,
  name,
  isYou = false,
  detail,
  empty,
}: {
  role: PersonRole;
  name?: string;
  isYou?: boolean;
  detail?: ReactNode;
  /** Shown instead of a person while nobody fills this role yet. */
  empty?: string;
}) {
  const style = ROLE_STYLES[role];

  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          name ? style.avatar : "bg-slate-100 text-slate-400"
        }`}
        aria-hidden="true"
      >
        {name ? initials(name) : "?"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${style.badge}`}
          >
            {style.label}
          </span>
          {isYou && (
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
              You
            </span>
          )}
        </div>
        <p className={`mt-1 truncate text-sm font-semibold ${name ? "text-slate-900" : "text-slate-400"}`}>
          {name || empty || "Not assigned yet"}
        </p>
        {detail && <p className="truncate text-xs text-slate-500">{detail}</p>}
      </div>
    </div>
  );
}
