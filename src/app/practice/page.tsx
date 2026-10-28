import type { Metadata } from "next";

import { PracticeWorkspace } from "@/components/practice-workspace";

export const metadata: Metadata = {
  title: "Practice",
  description: "Complete and review your Topicore practice session.",
  robots: { index: false, follow: false },
};

export default function PracticePage() {
  return <PracticeWorkspace />;
}
