"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { simulationSession } from "@/lib/sim/session";

export const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Ensure the requested save is the active one before management selectors are read. */
export function useLoadedSave(saveId: string | null) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!saveId) return;
    let active = true;
    const run = async () => {
      const meta = simulationSession.getActiveSaveMeta();
      if (!meta || meta.id !== saveId) {
        const result = await simulationSession.loadSave(saveId);
        if (!active) return;
        if (!result.ok) {
          setError(result.error);
          setReady(true);
          return;
        }
      }
      if (!active) return;
      setReady(true);
    };
    void run();
    return () => {
      active = false;
    };
  }, [saveId]);

  return { ready, error };
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#151a23] px-4 text-zinc-200">
      <p className="rounded border border-zinc-700 bg-[#1b232e] px-6 py-4 text-center">{children}</p>
    </main>
  );
}

type ManagementFrameProps = {
  saveId: string | null;
  activeLabel: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function ManagementFrame({ saveId, activeLabel, title, subtitle, children }: ManagementFrameProps) {
  const { ready, error } = useLoadedSave(saveId);

  if (!saveId) {
    return (
      <Centered>
        Missing save selection. <Link className="text-cyan-300 underline" href="/">Go to saves</Link>.
      </Centered>
    );
  }
  if (error) return <Centered>{error}</Centered>;
  if (!ready) return <Centered>Loading…</Centered>;

  return (
    <DashboardShell title={title} subtitle={subtitle} sidebar={<DashboardSidebar activeLabel={activeLabel} />}>
      {children}
    </DashboardShell>
  );
}
