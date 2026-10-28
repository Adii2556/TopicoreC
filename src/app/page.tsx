import { GenerationForm } from "@/components/generation-form";
import { generatePracticeSetRequestSchema } from "@/domain/practice/schemas";

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const topicValue = params.topic;
  const parsedInitial = generatePracticeSetRequestSchema.safeParse({
    subject: first(params.subject),
    topics: Array.isArray(topicValue) ? topicValue : topicValue ? [topicValue] : undefined,
    difficulty: first(params.difficulty),
    questionCount: Number(first(params.questionCount)),
    mode: first(params.mode),
  });

  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-5 py-12 sm:px-8"
      id="main-content"
    >
      <div className="grid w-full items-center gap-12 lg:grid-cols-[1fr_0.9fr]">
        <section aria-labelledby="hero-title" className="max-w-2xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-[var(--accent)] uppercase">
            <span aria-hidden="true" className="size-2 rounded-full bg-[var(--accent)]" />
            Focused practice
          </div>
          <h1
            className="text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl"
            id="hero-title"
          >
            Practice the topics that matter.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--text-muted)]">
            Turn a SQL or Python topic into a focused practice session. Clear questions, useful
            explanations, and no setup detours.
          </p>
          <div className="mt-9 grid max-w-xl gap-4 sm:grid-cols-3">
            {[
              ["01", "Choose a topic"],
              ["02", "Generate a set"],
              ["03", "Practice and review"],
            ].map(([step, label]) => (
              <div className="border-l border-[var(--border)] pl-4" key={step}>
                <p className="text-xs font-bold text-[var(--accent)]">{step}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="generator-title"
          className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[rgb(15_20_28_/_0.9)] p-5 shadow-[var(--shadow)] backdrop-blur sm:p-7"
        >
          <div className="mb-6">
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--accent)] uppercase">
              New session
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]" id="generator-title">
              Build your practice set
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Start focused. You can always generate a different set afterward.
            </p>
          </div>
          <GenerationForm initialConfig={parsedInitial.success ? parsedInitial.data : undefined} />
        </section>
      </div>
    </main>
  );
}
