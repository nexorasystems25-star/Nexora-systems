"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, Envelope, MapPin, Phone } from "@phosphor-icons/react";
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
          <Link href="/about" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
            About
          </Link>
          <Link href="/contact" className="text-sm font-medium text-green-600 dark:text-green-400">
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

export default function ContactPage() {
  return (
    <>
      <Nav />
      <main className="pt-16">
        <section className="bg-slate-50 py-24 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid gap-16 lg:grid-cols-2">
              {/* Left: Copy */}
              <Reveal>
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                    Contact us
                  </p>
                  <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl dark:text-slate-100">
                    Let&apos;s talk.
                  </h1>
                  <p className="mt-4 max-w-md text-lg text-slate-600 dark:text-slate-400">
                    Whether you need a demo, have a question about pricing, or
                    want to explore a partnership, we would love to hear from
                    you.
                  </p>

                  <div className="mt-10 space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                        <Envelope className="h-5 w-5 text-green-700 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Email
                        </p>
                        <a
                          href="mailto:nexorasystems25@gmail.com"
                          className="text-sm text-slate-600 transition-colors hover:text-green-600 dark:text-slate-400 dark:hover:text-green-400"
                        >
                          nexorasystems25@gmail.com
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                        <MapPin className="h-5 w-5 text-green-700 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Location
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Accra, Ghana
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                        <Phone className="h-5 w-5 text-green-700 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Admin Portal
                        </p>
                        <a
                          href="https://admin.nexora.com"
                          className="text-sm text-slate-600 transition-colors hover:text-green-600 dark:text-slate-400 dark:hover:text-green-400"
                        >
                          admin.nexora.com
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* Right: Form */}
              <Reveal delay={0.15}>
                <form
                  onSubmit={(e) => e.preventDefault()}
                  className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="space-y-5">
                    <div>
                      <label
                        htmlFor="name"
                        className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                      >
                        Name
                      </label>
                      <input
                        id="name"
                        type="text"
                        placeholder="Your name"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="email"
                        className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                      >
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="product"
                        className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                      >
                        Interested in
                      </label>
                      <select
                        id="product"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition-colors focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option>ChurchFlow</option>
                        <option>School Suite</option>
                        <option>Counseling Platform</option>
                        <option>Susu Platform</option>
                        <option>Multiple products</option>
                        <option>Partnership</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="message"
                        className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                      >
                        Message
                      </label>
                      <textarea
                        id="message"
                        rows={4}
                        placeholder="Tell us about your organization and what you need..."
                        className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="group flex w-full items-center justify-center gap-2 rounded-full bg-green-600 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/20 active:scale-[0.98]"
                    >
                      Send message
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" weight="bold" />
                    </button>
                  </div>
                </form>
              </Reveal>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
