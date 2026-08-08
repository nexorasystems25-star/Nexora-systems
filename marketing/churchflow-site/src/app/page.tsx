"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  Users,
  Calendar,
  CurrencyDollar,
  Chats,
  ArrowRight,
  Check,
  Shield,
  ChartBar,
  Heart,
  Star,
} from "@phosphor-icons/react";
import { motion, useReducedMotion, useInView } from "motion/react";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function RevealSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Nav                                                                        */
/* -------------------------------------------------------------------------- */

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-stone-200/60 bg-stone-50/80 backdrop-blur-xl dark:border-stone-800/60 dark:bg-stone-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600">
            <Heart className="h-4 w-4 text-white" weight="fill" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            ChurchFlow
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="#features"
            className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          >
            Features
          </Link>
          <Link
            href="#pricing"
            className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          >
            Pricing
          </Link>
          <Link
            href="#testimonials"
            className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          >
            Testimonials
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="https://app.churchflow.app/login"
            className="hidden text-sm font-medium text-stone-600 transition-colors hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 sm:block"
          >
            Log in
          </Link>
          <Link
            href="https://app.churchflow.app/register"
            className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/20 active:scale-[0.98]"
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero — Split-screen                                                        */
/* -------------------------------------------------------------------------- */

function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-stone-50 pt-16 dark:bg-stone-950">
      {/* Background texture */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(31,165,98,0.06),transparent_50%)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(31,165,98,0.08),transparent_50%)]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
        {/* Left: Copy */}
        <motion.div
          initial={reduce ? false : { opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            <Shield className="h-3.5 w-3.5" weight="bold" />
            Built for ministries
          </div>

          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-stone-900 md:text-5xl lg:text-6xl dark:text-stone-100">
            Your church
            <br />
            <span className="gradient-text">deserves better</span>
            <br />
            than spreadsheets.
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-stone-600 dark:text-stone-400">
            Manage members, events, finances, and communication from one place.
            No more scattered tools. No more lost data.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="https://app.churchflow.app/register"
              className="group inline-flex items-center gap-2 rounded-full bg-green-600 px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-green-700 hover:shadow-xl hover:shadow-green-600/25 active:scale-[0.98]"
            >
              Start free trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" weight="bold" />
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-7 py-3.5 text-sm font-semibold text-stone-700 transition-all hover:border-stone-400 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:border-stone-600 dark:hover:bg-stone-800"
            >
              See how it works
            </Link>
          </div>
        </motion.div>

        {/* Right: Dashboard Preview */}
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 40, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl shadow-stone-200/50 dark:border-stone-800 dark:bg-stone-900 dark:shadow-stone-900/50">
            {/* Fake dashboard header */}
            <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-100/50 px-4 py-3 dark:border-stone-800 dark:bg-stone-800/50">
              <div className="h-3 w-3 rounded-full bg-red-400" />
              <div className="h-3 w-3 rounded-full bg-amber-400" />
              <div className="h-3 w-3 rounded-full bg-green-400" />
              <span className="ml-3 text-xs text-stone-400">app.churchflow.app</span>
            </div>

            {/* Fake dashboard content */}
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  Dashboard
                </h3>
                <span className="text-xs text-stone-400">This week</span>
              </div>

              {/* Stats row */}
              <div className="mb-4 grid grid-cols-3 gap-3">
                {[
                  { label: "Members", value: "1,247", trend: "+12" },
                  { label: "Events", value: "8", trend: "+2" },
                  { label: "Tithes", value: "GHS 12.4k", trend: "+18%" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-800"
                  >
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      {stat.label}
                    </p>
                    <p className="text-lg font-bold text-stone-900 dark:text-stone-100">
                      {stat.value}
                    </p>
                    <p className="text-[10px] font-medium text-green-600 dark:text-green-400">
                      {stat.trend}
                    </p>
                  </div>
                ))}
              </div>

              {/* Activity list */}
              <div className="space-y-2">
                {[
                  { name: "Grace Fellowship", action: "Added 12 new members" },
                  { name: "Sunday Service", action: "234 attendees recorded" },
                  { name: "Tithe Collection", action: "GHS 3,200 deposited" },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 rounded-lg border border-stone-100 bg-white p-3 dark:border-stone-800 dark:bg-stone-900"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                      <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-stone-900 dark:text-stone-100">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400">
                        {item.action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Floating accent card */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="absolute -bottom-6 -left-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-xl dark:border-stone-800 dark:bg-stone-900"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <ChartBar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-stone-900 dark:text-stone-100">
                  Monthly Report
                </p>
                <p className="text-[11px] text-green-600 dark:text-green-400">
                  +23% engagement
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Trust Wall — Logos under hero                                              */
/* -------------------------------------------------------------------------- */

function TrustWall() {
  const churches = [
    "Grace Fellowship",
    "Hope Community",
    "Faith Assembly",
    "New Life Church",
    "Redeemer Ministries",
    "Cornerstone Chapel",
  ];

  return (
    <section className="border-y border-stone-200 bg-stone-100/50 py-10 dark:border-stone-800 dark:bg-stone-900/50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
          Trusted by churches across Ghana
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {churches.map((name) => (
            <span
              key={name}
              className="text-sm font-semibold text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-600 dark:hover:text-stone-400"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Features — Asymmetric Bento Grid                                           */
/* -------------------------------------------------------------------------- */

function Features() {
  return (
    <section id="features" className="bg-stone-50 py-24 dark:bg-stone-950">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <RevealSection className="mb-16">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
            What you get
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-stone-900 md:text-4xl lg:text-5xl dark:text-stone-100">
            Everything your ministry needs.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-stone-600 dark:text-stone-400">
            One platform to replace the scattered tools. Built specifically for
            how churches actually operate.
          </p>
        </RevealSection>

        {/* Bento Grid — 2+1 top, 1+2 bottom */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Top row: 2 large + 1 small */}
          <RevealSection className="md:col-span-2" delay={0.1}>
            <div className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-8 transition-all hover:shadow-xl hover:shadow-stone-200/50 dark:border-stone-800 dark:bg-stone-900 dark:hover:shadow-stone-900/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 transition-colors group-hover:bg-green-200 dark:bg-green-900/30 dark:group-hover:bg-green-900/50">
                <Users className="h-6 w-6 text-green-700 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                Member Management
              </h3>
              <p className="mt-2 max-w-md text-stone-600 dark:text-stone-400">
                Track every member, their family, giving history, and
                engagement. Search by name, phone, or group in seconds.
              </p>
              <div className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-800">
                <img
                  src="https://picsum.photos/seed/church-members/800/400"
                  alt="ChurchFlow member management dashboard showing member profiles and search"
                  className="h-48 w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                  loading="lazy"
                />
              </div>
            </div>
          </RevealSection>

          <RevealSection delay={0.2}>
            <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white p-8 transition-all hover:shadow-xl hover:shadow-stone-200/50 dark:border-stone-800 dark:bg-stone-900 dark:hover:shadow-stone-900/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 transition-colors group-hover:bg-amber-200 dark:bg-amber-900/30 dark:group-hover:bg-amber-900/50">
                <Calendar className="h-6 w-6 text-amber-700 dark:text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                Event Planning
              </h3>
              <p className="mt-2 flex-1 text-stone-600 dark:text-stone-400">
                Schedule services, track attendance, and manage volunteers.
                Never double-book a room again.
              </p>
              <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-800">
                <div className="space-y-2">
                  {["Sunday Service", "Bible Study", "Youth Night"].map(
                    (event) => (
                      <div
                        key={event}
                        className="flex items-center justify-between rounded-lg bg-white p-3 dark:bg-stone-900"
                      >
                        <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
                          {event}
                        </span>
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Confirmed
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </RevealSection>

          {/* Bottom row: 1 small + 2 large */}
          <RevealSection delay={0.15}>
            <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white p-8 transition-all hover:shadow-xl hover:shadow-stone-200/50 dark:border-stone-800 dark:bg-stone-900 dark:hover:shadow-stone-900/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 transition-colors group-hover:bg-green-200 dark:bg-green-900/30 dark:group-hover:bg-green-900/50">
                <CurrencyDollar className="h-6 w-6 text-green-700 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                Financial Tracking
              </h3>
              <p className="mt-2 flex-1 text-stone-600 dark:text-stone-400">
                Record tithes, offerings, and expenses. Generate reports for
                leadership meetings.
              </p>
              <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-800">
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  This month
                </p>
                <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                  GHS 45,200
                </p>
                <p className="text-[11px] font-medium text-green-600 dark:text-green-400">
                  +18% from last month
                </p>
              </div>
            </div>
          </RevealSection>

          <RevealSection className="md:col-span-2" delay={0.25}>
            <div className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-8 transition-all hover:shadow-xl hover:shadow-stone-200/50 dark:border-stone-800 dark:bg-stone-900 dark:hover:shadow-stone-900/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 transition-colors group-hover:bg-stone-200 dark:bg-stone-800 dark:group-hover:bg-stone-700">
                <Chats className="h-6 w-6 text-stone-700 dark:text-stone-300" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                Communication Hub
              </h3>
              <p className="mt-2 max-w-md text-stone-600 dark:text-stone-400">
                Send announcements, reminders, and prayer requests via SMS or
                email. Reach your entire congregation in minutes.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  { sent: "1,247", label: "SMS delivered" },
                  { sent: "98%", label: "Open rate" },
                  { sent: "< 2 min", label: "Avg. delivery" },
                  { sent: "GHS 0.05", label: "Per message" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-800"
                  >
                    <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                      {stat.sent}
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </RevealSection>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Testimonials                                                               */
/* -------------------------------------------------------------------------- */

function Testimonials() {
  const quotes = [
    {
      text: "We switched from spreadsheets to ChurchFlow last year. Our admin time dropped by half, and we finally have a clear picture of our congregation.",
      name: "Pastor Kwame Mensah",
      role: "Senior Pastor, Grace Fellowship",
    },
    {
      text: "The financial reporting alone saved us hours every month. Our treasurer can now generate reports in minutes instead of days.",
      name: "Abena Osei",
      role: "Treasurer, Hope Community Church",
    },
    {
      text: "Our youth group loves the event coordination. We can manage volunteers, track attendance, and send reminders all from one place.",
      name: "Daniel Asante",
      role: "Youth Leader, Faith Assembly",
    },
  ];

  return (
    <section id="testimonials" className="bg-stone-100/50 py-24 dark:bg-stone-900/50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <RevealSection className="mb-16">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
            What leaders say
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-stone-900 md:text-4xl lg:text-5xl dark:text-stone-100">
            Trusted by ministries
          </h2>
        </RevealSection>

        <div className="grid gap-6 md:grid-cols-3">
          {quotes.map((q, i) => (
            <RevealSection key={q.name} delay={i * 0.1}>
              <blockquote className="flex h-full flex-col rounded-2xl border border-stone-200 bg-white p-8 dark:border-stone-800 dark:bg-stone-900">
                <div className="mb-4 flex gap-1">
                  {[...Array(5)].map((_, j) => (
                    <Star
                      key={j}
                      className="h-4 w-4 text-amber-400"
                      weight="fill"
                    />
                  ))}
                </div>
                <p className="flex-1 text-stone-700 dark:text-stone-300">
                  &ldquo;{q.text}&rdquo;
                </p>
                <footer className="mt-6 border-t border-stone-100 pt-4 dark:border-stone-800">
                  <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    {q.name}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {q.role}
                  </p>
                </footer>
              </blockquote>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pricing                                                                    */
/* -------------------------------------------------------------------------- */

function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "99",
      description: "For small churches getting organized",
      features: [
        "Up to 200 members",
        "Basic event scheduling",
        "Tithe tracking",
        "SMS reminders (100/month)",
        "Email support",
      ],
      cta: "Start free trial",
      featured: false,
    },
    {
      name: "Growth",
      price: "299",
      description: "For growing congregations",
      features: [
        "Up to 1,000 members",
        "Full event management",
        "Financial reporting",
        "SMS reminders (500/month)",
        "Volunteer coordination",
        "Priority support",
      ],
      cta: "Start free trial",
      featured: true,
    },
    {
      name: "Enterprise",
      price: "599",
      description: "For multi-campus churches",
      features: [
        "Unlimited members",
        "Multi-campus support",
        "Advanced analytics",
        "Unlimited SMS",
        "Custom integrations",
        "Dedicated account manager",
      ],
      cta: "Contact sales",
      featured: false,
    },
  ];

  return (
    <section id="pricing" className="bg-stone-50 py-24 dark:bg-stone-950">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <RevealSection className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
            Simple pricing
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-stone-900 md:text-4xl lg:text-5xl dark:text-stone-100">
            Plans that grow with you
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-stone-600 dark:text-stone-400">
            Start free for 14 days. No credit card required. Cancel anytime.
          </p>
        </RevealSection>

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <RevealSection key={plan.name} delay={i * 0.1}>
              <div
                className={`flex h-full flex-col rounded-2xl border p-8 transition-all ${
                  plan.featured
                    ? "border-green-300 bg-white shadow-xl shadow-green-600/10 dark:border-green-700 dark:bg-stone-900 dark:shadow-green-600/5"
                    : "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
                }`}
              >
                {plan.featured && (
                  <span className="mb-4 inline-flex w-fit rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                  {plan.description}
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                    GHS {plan.price}
                  </span>
                  <span className="text-sm text-stone-500 dark:text-stone-400">
                    /month
                  </span>
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400"
                        weight="bold"
                      />
                      <span className="text-sm text-stone-600 dark:text-stone-400">
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={
                    plan.featured
                      ? "https://app.churchflow.app/register"
                      : plan.name === "Enterprise"
                        ? "/contact"
                        : "https://app.churchflow.app/register"
                  }
                  className={`mt-8 block rounded-full py-3 text-center text-sm font-semibold transition-all active:scale-[0.98] ${
                    plan.featured
                      ? "bg-green-600 text-white hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/20"
                      : "border border-stone-300 text-stone-700 hover:border-stone-400 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:border-stone-600 dark:hover:bg-stone-800"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  CTA                                                                        */
/* -------------------------------------------------------------------------- */

function CTA() {
  return (
    <section className="bg-green-600 py-24">
      <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
        <RevealSection>
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
            Ready to transform your church management?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-green-100">
            Join hundreds of churches already using ChurchFlow to streamline
            their operations and focus on what matters most.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="https://app.churchflow.app/register"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-green-700 shadow-lg shadow-green-700/30 transition-all hover:shadow-xl hover:shadow-green-700/40 active:scale-[0.98]"
            >
              Start free trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" weight="bold" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-green-400/30 px-8 py-4 text-sm font-semibold text-white transition-all hover:border-green-300/50 hover:bg-green-700"
            >
              Talk to sales
            </Link>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Footer                                                                     */
/* -------------------------------------------------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-stone-950 py-12 dark:border-stone-800">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-600">
              <Heart className="h-3.5 w-3.5 text-white" weight="fill" />
            </div>
            <span className="text-sm font-semibold text-stone-300">
              ChurchFlow
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-stone-500">
            <Link
              href="/privacy"
              className="transition-colors hover:text-stone-300"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-stone-300"
            >
              Terms
            </Link>
            <Link
              href="/contact"
              className="transition-colors hover:text-stone-300"
            >
              Contact
            </Link>
          </div>

          <p className="text-xs text-stone-600">
            &copy; 2026 Nexora Systems. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function Home() {
  return (
    <>
      <Nav />
      <Hero />
      <TrustWall />
      <Features />
      <Testimonials />
      <Pricing />
      <CTA />
      <Footer />
    </>
  );
}
