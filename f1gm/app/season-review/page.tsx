"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ManagementFrame } from "@/components/management/ManagementFrame";
import { simulationSession } from "@/lib/sim/session";
import { getStandings } from "@/lib/sim/selectors";
import { ConstructorDevelopmentReport, SeasonAwards } from "@/types/sim";

type RetirementRow = { driverId: string; name: string; teamId: string; age: number; overall: number };

function AwardCard({ title, recipient }: { title: string; recipient: { name: string; value?: number | string } | null }) {
  if (!recipient) {
    return (
      <div className="rounded border border-zinc-700 bg-[#1b232e] p-4">
        <p className="text-xs uppercase tracking-wider text-zinc-500">{title}</p>
        <p className="mt-1 text-zinc-500">-</p>
      </div>
    );
  }
  return (
    <div className="rounded border border-zinc-700 bg-[#1b232e] p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{title}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-100">{recipient.name}</p>
      {recipient.value !== undefined ? <p className="text-sm text-amber-400">{recipient.value}</p> : null}
    </div>
  );
}

function tierClass(tier: ConstructorDevelopmentReport["tier"]) {
  if (tier === "breakthrough") return "border-emerald-600/60 bg-emerald-950/25 text-emerald-100";
  if (tier === "gain") return "border-cyan-600/50 bg-cyan-950/20 text-cyan-100";
  if (tier === "collapse") return "border-red-700/70 bg-red-950/25 text-red-100";
  if (tier === "setback") return "border-orange-700/60 bg-orange-950/20 text-orange-100";
  return "border-zinc-700 bg-[#1b232e] text-zinc-200";
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function ConstructorWinterChanges({ reports }: { reports: ConstructorDevelopmentReport[] }) {
  if (!reports.length) return null;

  return (
    <section>
      <h3 className="mb-3 text-lg font-semibold">Constructor winter changes</h3>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <article key={`${report.seasonYear}-${report.teamId}`} className={`rounded border p-4 ${tierClass(report.tier)}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{report.teamName}</p>
                <p className="mt-1 text-xs uppercase tracking-wider opacity-75">{report.tier}</p>
              </div>
              <p className="text-right text-sm font-semibold">
                Pace {signed(report.paceDelta)}
                <br />
                Rel {signed(report.reliabilityDelta)}
              </p>
            </div>
            <p className="mt-3 text-sm opacity-90">{report.headline}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SeasonReviewBody({ saveId }: { saveId: string }) {
  const [awards, setAwards] = useState<SeasonAwards | null>(null);
  const [retirements, setRetirements] = useState<RetirementRow[]>([]);
  const [standings, setStandings] = useState<ReturnType<typeof getStandings> | null>(null);
  const [constructorReports, setConstructorReports] = useState<ConstructorDevelopmentReport[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const a = simulationSession.getSeasonAwards();
      const r = simulationSession.getLikelyRetirements();
      const s = simulationSession.getStandings();
      const c = simulationSession.getConstructorDevelopmentReports();
      if (a.ok) setAwards(a.data);
      if (r.ok) setRetirements(r.data);
      if (s.ok) setStandings(s.data);
      if (c.ok) setConstructorReports(c.data);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  if (!awards) return <p className="text-zinc-400">Loading season review...</p>;

  return (
    <div className="space-y-6">
      <section className="ui-card rounded border border-amber-600/40 bg-gradient-to-br from-amber-950/40 to-[#1b232e] p-6 text-center">
        <p className="text-sm uppercase tracking-widest text-amber-400">{awards.seasonYear} Season Champions</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-zinc-500">World Drivers&apos; Champion</p>
            <p className="text-3xl font-bold text-zinc-50">{awards.wdc.name}</p>
            <p className="text-amber-300">{awards.wdc.value} pts</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">World Constructors&apos; Champion</p>
            <p className="text-3xl font-bold text-zinc-50">{awards.wcc.name}</p>
            <p className="text-amber-300">{awards.wcc.value} pts</p>
          </div>
        </div>
      </section>

      <ConstructorWinterChanges reports={constructorReports} />

      <section>
        <h3 className="mb-3 text-lg font-semibold">Season Awards</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AwardCard title="Rookie of the Year" recipient={awards.rookieOfYear} />
          <AwardCard title="Most Pole Positions" recipient={awards.mostPoles} />
          <AwardCard title="Most Wins" recipient={awards.mostWins} />
          <AwardCard title="Most Podiums" recipient={awards.mostPodiums} />
          <AwardCard title="Most Fastest Laps" recipient={awards.mostFastestLaps} />
          <AwardCard
            title="Fastest Pit Stop"
            recipient={
              awards.fastestPitStop
                ? { name: awards.fastestPitStop.name, value: awards.fastestPitStop.value }
                : null
            }
          />
        </div>
      </section>

      {retirements.length > 0 ? (
        <section className="rounded border border-zinc-700 bg-[#1b232e] p-4">
          <h3 className="mb-2 text-lg font-semibold">Drivers at risk of retirement</h3>
          <p className="mb-3 text-sm text-zinc-400">Veterans whose form may force retirement after the next season rollover.</p>
          <ul className="space-y-1 text-sm text-zinc-300">
            {retirements.map((d) => (
              <li key={d.driverId}>
                {d.name} - age {d.age}, overall {d.overall}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {standings ? (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-zinc-700 bg-[#1b232e] p-4">
            <h3 className="mb-2 font-semibold">Final Drivers&apos; Standings</h3>
            <ol className="space-y-1 text-sm text-zinc-300">
              {standings.drivers.slice(0, 10).map((d, i) => (
                <li key={d.driverId}>
                  {i + 1}. {d.name} ({d.teamAbbreviation}) - {d.points} pts
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded border border-zinc-700 bg-[#1b232e] p-4">
            <h3 className="mb-2 font-semibold">Final Constructors&apos; Standings</h3>
            <ol className="space-y-1 text-sm text-zinc-300">
              {standings.constructors.map((t, i) => (
                <li key={t.teamId}>
                  {i + 1}. {t.name} - {t.points} pts
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/owner-confidence?saveId=${saveId}`}
          className="ui-interactive rounded bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Continue to board review
        </Link>
        <Link href={`/dashboard?saveId=${saveId}`} className="ui-interactive rounded border border-zinc-600 px-4 py-2 text-sm text-zinc-200">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function SeasonReviewWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  if (!saveId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#151a23] text-zinc-200">
        <p>Missing save selection.</p>
      </main>
    );
  }
  return (
    <ManagementFrame saveId={saveId} activeLabel="Season Review" title="Season Review" subtitle="Champions & awards">
      <SeasonReviewBody saveId={saveId} />
    </ManagementFrame>
  );
}

export default function SeasonReviewPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <SeasonReviewWithSaveId />
    </Suspense>
  );
}
