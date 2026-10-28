import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-5" id="main-content">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold text-[var(--accent)]">Page not found</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
          This page does not exist.
        </h1>
        <p className="mt-4 leading-7 text-[var(--text-muted)]">
          Return to the generator to create a new SQL or Python practice session.
        </p>
        <Link
          className="mt-7 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] bg-[var(--accent)] px-5 font-semibold text-[var(--accent-ink)]"
          href="/"
        >
          Return to generator
        </Link>
      </section>
    </main>
  );
}
