"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, Target, Users, Shield, Lightning } from "@phosphor-icons/react";
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
          <Link href="/products" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
            Products
          </Link>
          <Link href="/about" className="text-sm font-medium text-green-600 dark:text-green-400">
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

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main className="pt-16">
        {/* Hero */}
        <section className="bg-slate-50 py-24 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <Reveal>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                About Nexora
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl lg:text-6xl dark:text-slate-100">
                Building software for
                <br />
                <span className="gradient-text">communities that matter.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
                Nexora Systems was founded with a simple idea: the organizations
                that hold communities together deserve better software. Churches,
                schools, counselors, savings groups. They run on dedication and
                spreadsheets. We want to fix the second part.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Mission */}
        <section className="bg-white py-24 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid gap-16 lg:grid-cols-2">
              <Reveal>
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                    Our mission
                  </p>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl dark:text-slate-100">
                    Make community
                    <br />
                    organizations effective.
                  </h2>
                  <p className="mt-6 text-lg text-slate-600 dark:text-slate-400">
                    We believe every church, school, and community group should
                    have access to tools that actually work for them. Not
                    enterprise software scaled down. Not consumer apps stretched
                    up. Purpose-built for how these organizations actually
                    operate.
                  </p>
                </div>
              </Reveal>

              <Reveal delay={0.15}>
                <div className="space-y-8">
                  {[
                    {
                      icon: Target,
                      title: "Problem-first",
                      text: "Every product starts with a real problem we have observed in Ghanaian organizations.",
                    },
                    {
                      icon: Users,
                      title: "Community-centered",
                      text: "We build for the people who run these organizations, not the IT departments.",
                    },
                    {
                      icon: Shield,
                      title: "Trust by default",
                      text: "SOC2-ready, GDPR-compliant, Ghana Data Protection Act aligned from day one.",
                    },
                    {
                      icon: Lightning,
                      title: "Fast and reliable",
                      text: "Built on modern infrastructure. Fast load times, 99.9% uptime target.",
                    },
                  ].map((pillar, i) => {
                    const Icon = pillar.icon;
                    return (
                      <div key={pillar.title} className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                          <Icon className="h-5 w-5 text-green-700 dark:text-green-400" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-slate-100">
                            {pillar.title}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            {pillar.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="bg-slate-50 py-24 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <Reveal>
              <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                {[
                  { value: "4", label: "Products" },
                  { value: "100+", label: "Organizations" },
                  { value: "99.9%", label: "Uptime" },
                  { value: "Ghana", label: "Headquarters" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl dark:text-slate-100">
                      {stat.value}
                    </p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-green-600 py-24">
          <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
            <Reveal>
              <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                Want to work with us?
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-lg text-green-100">
                We are always looking for partners, beta testers, and people who
                care about community software.
              </p>
              <Link
                href="/contact"
                className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-green-700 shadow-lg shadow-green-700/30 transition-all hover:shadow-xl active:scale-[0.98]"
              >
                Get in touch
                <ArrowRight className="h-4 w-4" weight="bold" />
              </Link>
            </Reveal>
          </div>
        </section>
      </main>
    </>
  );
}
