import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DevMonitorDashboard } from "@/components/dev-monitor-dashboard";
import { getMonitorSnapshot, isDevMonitorEnabled } from "@/monitoring/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Developer monitor",
  robots: { index: false, follow: false },
};

export default function DevMonitorPage() {
  if (!isDevMonitorEnabled()) notFound();
  return <DevMonitorDashboard initialSnapshot={getMonitorSnapshot()} />;
}
