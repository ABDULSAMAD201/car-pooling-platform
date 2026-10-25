import Link from "next/link";

const STEPS = [
  {
    title: "Set your route",
    body: "Drop a pickup and destination on the map and choose when you want to leave.",
  },
  {
    title: "Get matched",
    body: "Drivers heading your way see your request and show interest. You pick who rides with you.",
  },
  {
    title: "Ride and save",
    body: "Share the journey, split the cost, and keep track of every trip in one place.",
  },
];

const FEATURES = [
  {
    title: "For passengers",
    body: "Request a ride in under a minute, compare drivers and follow your trip status live.",
    href: "/signup",
    cta: "Book a ride",
  },
  {
    title: "For drivers",
    body: "Go online with your route, browse open requests nearby and fill empty seats.",
    href: "/signup",
    cta: "Start driving",
  },
  {
    title: "Stay informed",
    body: "Notifications keep you updated when a driver responds or your ride changes.",
    href: "/login",
    cta: "Sign in",
  },
];

export function Landing() {
  return (
    <div>
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/20">
            Share rides, split costs
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Travel together, <span className="text-brand-600">spend less.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">
            Carpool connects people going the same way. Book a seat or offer one, in a few
            taps.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700 sm:w-auto"
            >
              Create a free account
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-white px-6 py-3 text-base font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 sm:w-auto"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
            How it works
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
            >
              <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-1.5 flex-1 text-sm text-slate-600">{feature.body}</p>
              <Link
                href={feature.href}
                className="mt-5 text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                {feature.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
