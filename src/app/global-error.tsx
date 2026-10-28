"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="grid min-h-screen place-items-center bg-[#080b10] px-5 text-[#f4f7fb]">
          <section className="max-w-md text-center">
            <p className="text-sm font-semibold text-[#ff8f8f]">Something went wrong</p>
            <h1 className="mt-3 text-4xl font-semibold">Topicore could not start.</h1>
            <p className="mt-4 leading-7 text-[#9aa8ba]">
              Try loading the application again. If the problem continues, wait a moment and retry.
            </p>
            <button
              className="mt-7 min-h-11 rounded-lg bg-[#71e3b0] px-5 font-semibold text-[#052417]"
              onClick={reset}
              type="button"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
