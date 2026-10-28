"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-5" id="main-content">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold text-[var(--danger)]">Something went wrong</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
          Topicore could not display this page.
        </h1>
        <p className="mt-4 leading-7 text-[var(--text-muted)]">
          Try the page again. Your current tab session may still be available.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={reset}>Try again</Button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm font-semibold"
            href="/"
          >
            Return to generator
          </Link>
        </div>
      </section>
    </main>
  );
}
