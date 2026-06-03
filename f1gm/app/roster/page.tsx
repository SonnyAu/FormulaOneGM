"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ManagementFrame } from "@/components/management/ManagementFrame";
import { RosterAcademyTable } from "@/components/roster/RosterAcademyTable";
import { RosterDriverCard } from "@/components/roster/RosterDriverCard";
import { RosterView } from "@/lib/sim/selectors";
import { simulationSession } from "@/lib/sim/session";

function RosterBody() {
  const [data, setData] = useState<RosterView | null>(() => {
    const result = simulationSession.getRoster();
    return result.ok ? result.data : null;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const result = simulationSession.getRoster();
    if (result.ok) setData(result.data);
  }, []);

  const onSwap = useCallback(
    async (raceDriverId: string) => {
      setBusy(true);
      setError(null);
      const result = await simulationSession.swapWithReserve(raceDriverId);
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        refresh();
        return;
      }
      setData(result.data);
    },
    [refresh],
  );

  if (!data) return <p className="text-zinc-400">Loading roster…</p>;

  return (
    <div className="space-y-6">
      {!data.swapAllowed && data.swapBlockedReason ? (
        <p className="rounded border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          {data.swapBlockedReason}
        </p>
      ) : null}

      {error ? (
        <p className="rounded border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">{error}</p>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-100">Race Lineup</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {data.raceDrivers.map((driver) => (
            <RosterDriverCard
              key={driver.driverId}
              driver={driver}
              badge="Race"
              onSwap={() => void onSwap(driver.driverId)}
              swapBusy={busy}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-100">Reserve Driver</h3>
        {data.reserve ? (
          <div className="max-w-xl">
            <RosterDriverCard driver={data.reserve} badge="Reserve" />
          </div>
        ) : (
          <p className="text-zinc-500">No reserve driver assigned.</p>
        )}
      </section>

      <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
        <h3 className="mb-1 text-lg font-semibold text-zinc-100">Academy Pipeline</h3>
        <p className="mb-3 text-sm text-zinc-400">
          Prospects are promoted automatically when a race seat opens at season rollover.
        </p>
        <RosterAcademyTable rows={data.academy} />
      </section>
    </div>
  );
}

function RosterWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  return (
    <ManagementFrame saveId={saveId} activeLabel="Roster" title="Team Roster" subtitle="Race lineup, reserve & academy">
      <RosterBody />
    </ManagementFrame>
  );
}

export default function RosterPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <RosterWithSaveId />
    </Suspense>
  );
}
