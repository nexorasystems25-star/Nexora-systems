"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  Heart,
  ArrowRight,
  GraduationCap,
  ChatsCircle,
  Coins,
  Check,
  ArrowUpRight,
} from "@phosphor-icons/react";
import { motion, useReducedMotion, useInView } from "motion/react";

function Reveal({
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
      initial={reduce ? false : { opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const products = [
  {
    name: "ChurchFlow",
    tagline: "Church management, simplified.",
    description:
      "The complete platform for managing church members, events, finances, and communication. Built for modern ministries in Ghana.",
    icon: Heart,
    color: "green",
    href: "https://churchflow.app",
    features: [
      "Member profiles and family tracking",
      "Event scheduling and volunteer management",
      "Tithe and offering recording",
      "SMS and email communication",
      "Financial reporting and budgeting",
      "Group and department management",
    ],
    pricing: "From GHS 99/month",
  },
  {
    name: "School Suite",
    tagline: "School administration, reimagined.",
    description:
      "Student records, attendance, grading, and parent communication. Everything a school needs in one platform.",
    icon: GraduationCap,
    color: "blue",
    href: "https://school-suite.app",
    features: [
      "Student enrollment and records",
      "Attendance tracking",
      "Gradebook and report cards",
      "Parent portal and messaging",
      "Fee management and invoicing",
      "Staff and timetable scheduling",
    ],
    pricing: "From GHS 149/month",
  },
  {
    name: "Counseling Platform",
    tagline: "Therapy practice, managed.",
    description:
      "Appointment scheduling, client records, session notes, and billing for counselors and therapists.",
    icon: ChatsCircle,
    color: "purple",
    href: "https://counselingplatform.app",
    features: [
      "Client intake and records",
      "Session scheduling and reminders",
      "Progress notes and treatment plans",
      "Billing and insurance tracking",
      "Telehealth video sessions",
      "Outcome measurement tools",
    ],
    pricing: "From GHS 199/month",
  },
  {
    name: "Susu Platform",
    tagline: "Susu groups, digitized.",
    description:
      "Track contributions, manage members, and automate payouts for susu groups and savings circles.",
    icon: Coins,
    color: "amber",
    href: "https://susuplatform.app",
    features: [
      "Contribution tracking",
      "Member management",
      "Automated payout scheduling",
      "Mobile money integration",
      "Financial reports and transparency",
      "Group chat and notifications",
    ],
    pricing: "From GHS 149/month",
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string; darkBg: string; darkText: string; darkBorder: string }> = {
  green: {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-200",
    darkBg: "dark:bg-green-900/30",
    darkText: "dark:text-green-400",
    darkBorder: "dark:border-green-800",
  },
  blue: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-200",
    darkBg: "dark:bg-blue-900/30",
    darkText: "dark:text-blue-400",
    darkBorder: "dark:border-blue-800",
  },
  purple: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    border: "border-purple-200",
    darkBg: "dark:bg-purple-900/30",
    darkText: "dark:text-purple-400",
    darkBorder: "dark:border-purple-800",
  },
  amber: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-200",
    darkBg: "dark:bg-amber-900/30",
    darkText: "dark:text-amber-400",
    darkBorder: "dark:border-amber-800",
  },
};

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/60 bg-slate-50/80 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600">
            <span className="text-sm font-bold text-white">N</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Nexora
          </span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <Link href="/products" className="text-sm font-medium text-green-600 dark:text-green-400">
            Products
          </Link>
          <Link href="/about" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
            About
          </Link>
          <Link href="/contact" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
            Contact
          </Link>
        </div>
        <Link href="/contact" className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-green-700 active:scale-[0.98]">
          Get in touch
        </Link>
      </div>
    </nav>
  );
}

export default function ProductsPage() {
  return (
    <>
      <Nav />
      <main className="pt-16">
        {/* Header */}
        <section className="bg-slate-50 py-24 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <Reveal>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                Our products
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl lg:text-6xl dark:text-slate-100">
                Four platforms.
                <br />
                One mission.
              </h1>
              <p className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
                Each product solves a real problem for Ghanaian organizations.
                Standalone or together, they share a unified experience.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Products */}
        <section className="bg-white py-24 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl space-y-24 px-6 lg:px-8">
            {products.map((product, i) => {
              const c = colorMap[product.color];
              const Icon = product.icon;
              const isEven = i % 2 === 0;
              return (
                <Reveal key={product.name}>
                  <div
                    className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${
                      !isEven ? "lg:[direction:rtl]" : ""
                    }`}
                  >
                    {/* Copy */}
                    <div className={isEven ? "" : "lg:[direction:ltr]"}>
                      <div
                        className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${c.bg} ${c.darkBg}`}
                      >
                        <Icon className={`h-6 w-6 ${c.text} ${c.darkText}`} />
                      </div>
                      <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl dark:text-slate-100">
                        {product.name}
                      </h2>
                      <p className="mt-1 text-lg font-medium text-slate-500 dark:text-slate-400">
                        {product.tagline}
                      </p>
                      <p className="mt-4 text-slate-600 dark:text-slate-400">
                        {product.description}
                      </p>
                      <ul className="mt-6 space-y-3">
                        {product.features.map((f) => (
                          <li key={f} className="flex items-start gap-3">
                            <Check
                              className={`mt-0.5 h-4 w-4 shrink-0 ${c.text} ${c.darkText}`}
                              weight="bold"
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {f}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-8 flex flex-wrap items-center gap-4">
                        <Link
                          href={product.href}
                          className={`group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
                            product.color === "green"
                              ? "bg-green-600 text-white hover:bg-green-700"
                              : product.color === "blue"
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : product.color === "purple"
                                  ? "bg-purple-600 text-white hover:bg-purple-700"
                                  : "bg-amber-500 text-white hover:bg-amber-600"
                          }`}
                        >
                          Visit {product.name}
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" weight="bold" />
                        </Link>
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          {product.pricing}
                        </span>
                      </div>
                    </div>

                    {/* Visual */}
                    <div className={`${isEven ? "" : "lg:[direction:ltr]"}`}>
                      <div
                        className={`overflow-hidden rounded-2xl border ${c.border} ${c.darkBorder} bg-white p-8 dark:bg-slate-900`}
                      >
                        <div className="flex h-48 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800">
                          <Icon className={`h-16 w-16 ${c.text} opacity-30 ${c.darkText}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* Bundle CTA */}
        <section className="bg-green-600 py-24">
          <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
            <Reveal>
              <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                Need more than one?
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-lg text-green-100">
                Bundle two or more products and save up to 30%. One login, one
                billing dashboard, one support team.
              </p>
              <Link
                href="/contact"
                className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-green-700 shadow-lg shadow-green-700/30 transition-all hover:shadow-xl active:scale-[0.98]"
              >
                Talk to sales
                <ArrowRight className="h-4 w-4" weight="bold" />
              </Link>
            </Reveal>
          </div>
        </section>
      </main>
    </>
  );
}
