"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  Heart,
  ArrowRight,
  Church,
  GraduationCap,
  ChatsCircle,
  Coins,
  Shield,
  Users,
  Lightning,
  ArrowUpRight,
} from "@phosphor-icons/react";
import { motion, useReducedMotion, useInView } from "motion/react";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Products Data                                                              */
/* -------------------------------------------------------------------------- */

const products = [
  {
    name: "ChurchFlow",
    tagline: "Church management, simplified.",
    description:
      "Manage members, events, finances, and communication from one platform. Built for modern ministries.",
    icon: Heart,
    color: "green",
    href: "https://churchflow.app",
    features: ["Member tracking", "Event planning", "Financial reporting", "SMS alerts"],
  },
  {
    name: "School Suite",
    tagline: "School administration, reimagined.",
    description:
      "Student records, attendance, grading, and parent communication. Everything a school needs in one place.",
    icon: GraduationCap,
    color: "blue",
    href: "https://school-suite.app",
    features: ["Student records", "Attendance", "Gradebook", "Parent portal"],
  },
  {
    name: "Counseling Platform",
    tagline: "Therapy practice, managed.",
    description:
      "Appointment scheduling, client records, session notes, and billing for counselors and therapists.",
    icon: ChatsCircle,
    color: "purple",
    href: "https://counselingplatform.app",
    features: ["Client management", "Session notes", "Billing", "Telehealth"],
  },
  {
    name: "Susu Platform",
    tagline: "Susu groups, digitized.",
    description:
      "Track contributions, manage members, and automate payouts for susu groups and savings circles.",
    icon: Coins,
    color: "amber",
    href: "https://susuplatform.app",
    features: ["Contribution tracking", "Member management", "Auto payouts", "Reports"],
  },
];

const colorMap: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  green: {
    bg: "bg-green-100",
    text: "text-green-700",
    darkBg: "dark:bg-green-900/30",
    darkText: "dark:text-green-400",
  },
  blue: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    darkBg: "dark:bg-blue-900/30",
    darkText: "dark:text-blue-400",
  },
  purple: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    darkBg: "dark:bg-purple-900/30",
    darkText: "dark:text-purple-400",
  },
  amber: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    darkBg: "dark:bg-amber-900/30",
    darkText: "dark:text-amber-400",
  },
};

/* -------------------------------------------------------------------------- */
/*  Nav                                                                        */
/* -------------------------------------------------------------------------- */

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
          <Link
            href="/products"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Products
          </Link>
          <Link
            href="/about"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            About
          </Link>
          <Link
            href="/contact"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Contact
          </Link>
          <Link
            href="https://admin.nexora.com"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Admin
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/contact"
            className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/20 active:scale-[0.98]"
          >
            Get in touch
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-slate-50 pt-16 dark:bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(31,165,98,0.05),transparent_50%)] dark:bg-[radial-gradient(circle_at_70%_30%,rgba(31,165,98,0.07),transparent_50%)]" />

      <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col items-center justify-center px-6 text-center lg:px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            <Lightning className="h-3.5 w-3.5" weight="bold" />
            Multi-product SaaS platform
          </div>

          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 md:text-5xl lg:text-7xl dark:text-slate-100">
            Digital tools for
            <br />
            <span className="gradient-text">real communities.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            Nexora builds software for churches, schools, counselors, and
            savings groups. One company, four products, built for Ghana.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/products"
              className="group inline-flex items-center gap-2 rounded-full bg-green-600 px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-green-700 hover:shadow-xl hover:shadow-green-600/25 active:scale-[0.98]"
            >
              Explore our products
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" weight="bold" />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-8 py-3.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              About Nexora
            </Link>
          </div>
        </motion.div>

        {/* Product Preview Strip */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 grid w-full max-w-4xl grid-cols-2 gap-4 md:grid-cols-4"
        >
          {products.map((p) => {
            const c = colorMap[p.color];
            const Icon = p.icon;
            return (
              <Link
                key={p.name}
                href={p.href}
                className="group rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:shadow-lg hover:shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-slate-900/50"
              >
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${c.bg} ${c.darkBg}`}
                >
                  <Icon className={`h-5 w-5 ${c.text} ${c.darkText}`} />
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {p.name}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {p.tagline}
                </p>
              </Link>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Why Nexora                                                                 */
/* -------------------------------------------------------------------------- */

function WhyNexora() {
  const pillars = [
    {
      icon: Shield,
      title: "Built for trust",
      description:
        "SOC2-ready architecture. GDPR-compliant. Ghana Data Protection Act aligned. Your data is secure.",
    },
    {
      icon: Users,
      title: "Built for communities",
      description:
        "Every product is designed around how real organizations operate in Ghana. Not a generic template.",
    },
    {
      icon: Lightning,
      title: "Built to scale",
      description:
        "From a 50-member church to a 10,000-student school district. The platform grows with you.",
    },
  ];

  return (
    <section className="bg-white py-24 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <Reveal className="mb-16">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
            Why Nexora
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl lg:text-5xl dark:text-slate-100">
            One company, four products.
            <br />
            One mission.
          </h2>
        </Reveal>

        <div className="grid gap-8 md:grid-cols-3">
          {pillars.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <Reveal key={pillar.title} delay={i * 0.1}>
                <div className="group">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 transition-colors group-hover:bg-green-200 dark:bg-green-900/30 dark:group-hover:bg-green-900/50">
                    <Icon className="h-6 w-6 text-green-700 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-slate-600 dark:text-slate-400">
                    {pillar.description}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Products Grid                                                              */
/* -------------------------------------------------------------------------- */

function ProductsGrid() {
  return (
    <section className="bg-slate-50 py-24 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <Reveal className="mb-16">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
            Our products
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl lg:text-5xl dark:text-slate-100">
            Four platforms. One ecosystem.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
            Each product is standalone. Together, they share auth, billing, and
            a unified admin experience.
          </p>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-2">
          {products.map((product, i) => {
            const c = colorMap[product.color];
            const Icon = product.icon;
            return (
              <Reveal key={product.name} delay={i * 0.1}>
                <Link
                  href={product.href}
                  className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 transition-all hover:shadow-xl hover:shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-slate-900/50"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${c.bg} ${c.darkBg}`}
                    >
                      <Icon className={`h-6 w-6 ${c.text} ${c.darkText}`} />
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-slate-300 transition-transform group-hover:-translate-y-0.5 group-hover:text-slate-500 dark:text-slate-700 dark:group-hover:text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {product.name}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {product.tagline}
                  </p>
                  <p className="mt-3 text-slate-600 dark:text-slate-400">
                    {product.description}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {product.features.map((f) => (
                      <span
                        key={f}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </Link>
              </Reveal>
            );
          })}
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
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-green-100">
            Whether you need one product or all four, Nexora scales with your
            organization. Start a free trial or talk to our team.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="https://churchflow.app"
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
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Footer                                                                     */
/* -------------------------------------------------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 py-12 dark:border-slate-800">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-600">
                <span className="text-xs font-bold text-white">N</span>
              </div>
              <span className="text-sm font-semibold text-slate-300">
                Nexora
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Building digital tools for
              <br />
              real communities.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Products
            </p>
            <ul className="mt-3 space-y-2">
              {["ChurchFlow", "School Suite", "Counseling Platform", "Susu Platform"].map(
                (name) => (
                  <li key={name}>
                    <Link
                      href="/products"
                      className="text-sm text-slate-400 transition-colors hover:text-slate-200"
                    >
                      {name}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Company
            </p>
            <ul className="mt-3 space-y-2">
              {["About", "Contact", "Privacy", "Terms"].map((name) => (
                <li key={name}>
                  <Link
                    href={`/${name.toLowerCase()}`}
                    className="text-sm text-slate-400 transition-colors hover:text-slate-200"
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Admin
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="https://admin.nexora.com"
                  className="text-sm text-slate-400 transition-colors hover:text-slate-200"
                >
                  AICOS Portal
                </Link>
              </li>
              <li>
                <Link
                  href="https://admin.nexora.com/login"
                  className="text-sm text-slate-400 transition-colors hover:text-slate-200"
                >
                  Staff Login
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-800 pt-8 text-center">
          <p className="text-xs text-slate-600">
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
      <WhyNexora />
      <ProductsGrid />
      <CTA />
      <Footer />
    </>
  );
}
