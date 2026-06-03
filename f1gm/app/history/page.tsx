"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ManagementFrame } from "@/components/management/ManagementFrame";
import { simulationSession } from "@/lib/sim/session";
import type { HistoryView } from "@/lib/sim/selectors";

type HistorySeason = HistoryView["seasons"][number];
type HistoryRaceParticipant = NonNullable<HistorySeason["racePodiums"]>[number]["podium"][number];

function AwardCard({ title, recipient }: { title: string; recipient: { name: string; value?: number | string } | null }) {
  return (
    <div className="rounded border border-zinc-700 bg-[#1b232e] p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{title}</p>
      {recipient ? (
        <>
          <p className="mt-1 text-lg font-semibold text-zinc-100">{recipient.name}</p>
          {recipient.value !== undefined ? <p className="text-sm text-amber-400">{recipient.value}</p> : null}
        </>
      ) : (
        <p className="mt-1 text-zinc-500">-</p>
      )}
    </div>
  );
}

function SeasonList({
  seasons,
  selectedYear,
  onSelect,
}: {
  seasons: HistorySeason[];
  selectedYear: number;
  onSelect: (year: number) => void;
}) {
  return (
    <aside className="space-y-2">
      {seasons.map((season) => {
        const active = season.seasonYear === selectedYear;
        return (
          <button
            key={season.seasonYear}
            type="button"
            onClick={() => onSelect(season.seasonYear)}
            aria-pressed={active}
            className={
              active
                ? "ui-interactive block w-full rounded border border-cyan-600/50 bg-cyan-950/40 px-3 py-3 text-left"
                : "ui-interactive block w-full rounded border border-zinc-700 bg-[#1b232e] px-3 py-3 text-left hover:border-zinc-500"
            }
          >
            <span className="block text-sm font-semibold text-zinc-100">{season.seasonYear}</span>
            <span className="mt-1 block text-xs text-zinc-500">
              {season.canViewFullDetails ? "Full record" : "Awards archive"}
              {season.isCurrentSeason ? " - current" : ""}
            </span>
          </button>
        );
      })}
    </aside>
  );
}

function StandingsTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ name: string; teamAbbreviation?: string; abbreviation?: string; points: number; wins: number; podiums: number }>;
}) {
  return (
    <section className="rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="pb-1">P</th>
              <th className="pb-1">Name</th>
              <th className="pb-1">Team</th>
              <th className="pb-1 text-right">Wins</th>
              <th className="pb-1 text-right">Podiums</th>
              <th className="pb-1 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${row.name}-${index}`} className="text-zinc-300">
                <td className="border-t border-zinc-800 py-1.5">{index + 1}</td>
                <td className="border-t border-zinc-800 py-1.5">{row.name}</td>
                <td className="border-t border-zinc-800 py-1.5">{row.teamAbbreviation ?? row.abbreviation ?? "-"}</td>
                <td className="border-t border-zinc-800 py-1.5 text-right">{row.wins}</td>
                <td className="border-t border-zinc-800 py-1.5 text-right">{row.podiums}</td>
                <td className="border-t border-zinc-800 py-1.5 text-right">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function positionLabel(row: HistoryRaceParticipant) {
  return row.dnf ? "DNF" : `P${row.position}`;
}

function participantRowClass(row: HistoryRaceParticipant) {
  return row.isPlayerEntry ? "bg-cyan-950/40 text-cyan-100" : "text-zinc-300";
}

function participantBorderClass(row: HistoryRaceParticipant) {
  return row.isPlayerEntry ? "border-cyan-700/50" : "border-zinc-800";
}

function FastestLapMarker({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="ml-2 rounded border border-purple-400/40 px-1 py-0.5 text-[10px] font-semibold text-purple-200">FL</span>;
}

function RacePodiumsPanel({ season }: { season: HistorySeason }) {
  const races = season.racePodiums ?? [];
  if (!races.length) {
    return (
      <section className="rounded border border-zinc-700 bg-[#1b232e] p-4">
        <h3 className="text-lg font-semibold">Race Podiums</h3>
        <p className="mt-2 text-sm text-zinc-500">Race podium detail is not available for this season.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Race Podiums</h3>
      {races.map((race) => (
        <div key={`${season.seasonYear}-${race.round}`} className="rounded border border-zinc-700 bg-[#1b232e] p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-semibold">
              Round {race.round}: {race.raceName}
            </h4>
            {!race.hasDriverResults ? <p className="text-xs uppercase tracking-wider text-zinc-500">Team podium archive</p> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="pb-1">P</th>
                  <th className="pb-1">Driver/Team</th>
                  <th className="pb-1">Team</th>
                  <th className="pb-1 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {race.podium.map((row) => (
                  <tr key={`${row.kind}-${row.driverId ?? row.teamId}-${row.position}`} className={participantRowClass(row)}>
                    <td className={`border-t py-2 pl-2 font-semibold ${participantBorderClass(row)}`}>{positionLabel(row)}</td>
                    <td className={`border-t py-2 ${participantBorderClass(row)}`}>
                      {row.name}
                      <FastestLapMarker show={row.hasFastestLap} />
                    </td>
                    <td className={`border-t py-2 ${participantBorderClass(row)}`}>{row.teamAbbreviation}</td>
                    <td className={`border-t py-2 pr-2 text-right ${participantBorderClass(row)}`}>{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {race.playerResults.length ? (
            <div className="mt-4">
              <p className="mb-2 text-xs uppercase tracking-wider text-cyan-300">Your drivers</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500">
                      <th className="pb-1">Pos</th>
                      <th className="pb-1">Driver</th>
                      <th className="pb-1">Team</th>
                      <th className="pb-1 text-right">Pts</th>
                      <th className="pb-1 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {race.playerResults.map((row) => (
                      <tr key={`${row.driverId ?? row.teamId}-${row.position}`} className={participantRowClass(row)}>
                        <td className={`border-t py-1.5 pl-2 font-semibold ${participantBorderClass(row)}`}>{positionLabel(row)}</td>
                        <td className={`border-t py-1.5 ${participantBorderClass(row)}`}>
                          {row.name}
                          <FastestLapMarker show={row.hasFastestLap} />
                        </td>
                        <td className={`border-t py-1.5 ${participantBorderClass(row)}`}>{row.teamAbbreviation}</td>
                        <td className={`border-t py-1.5 text-right ${participantBorderClass(row)}`}>{row.points}</td>
                        <td className={`border-t py-1.5 pr-2 text-right text-xs ${participantBorderClass(row)}`}>
                          {row.dnf ? "Retired" : "Finished"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function TeamSnapshotsPanel({ season }: { season: HistorySeason }) {
  const rows = season.teamSnapshots ?? [];
  if (!rows.length) return null;

  return (
    <section className="rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="mb-3 text-lg font-semibold">Team Snapshots</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="pb-1">Team</th>
              <th className="pb-1 text-right">Points</th>
              <th className="pb-1 text-right">Pace</th>
              <th className="pb-1 text-right">Reliability</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.teamId} className="text-zinc-300">
                <td className="border-t border-zinc-800 py-1.5">
                  {row.name} <span className="text-xs text-zinc-500">({row.abbreviation})</span>
                </td>
                <td className="border-t border-zinc-800 py-1.5 text-right">{row.points}</td>
                <td className="border-t border-zinc-800 py-1.5 text-right">{row.carPace}</td>
                <td className="border-t border-zinc-800 py-1.5 text-right">{row.reliability}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RetirementsPanel({ season }: { season: HistorySeason }) {
  return (
    <section className="rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="mb-2 text-lg font-semibold">Retirements</h3>
      {season.retirements.length ? (
        <ul className="space-y-1 text-sm text-zinc-300">
          {season.retirements.map((driver) => (
            <li key={`${driver.driverId}-${driver.teamId}`}>
              {driver.name} <span className="text-zinc-500">({driver.teamId})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No confirmed retirements recorded.</p>
      )}
    </section>
  );
}

function SeasonDetail({ season, fullDetailLimit }: { season: HistorySeason; fullDetailLimit: number }) {
  return (
    <div className="space-y-5">
      <section className="rounded border border-amber-600/40 bg-gradient-to-br from-amber-950/40 to-[#1b232e] p-5">
        <p className="text-sm uppercase tracking-widest text-amber-400">{season.seasonYear} Season</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-zinc-500">World Drivers&apos; Champion</p>
            <p className="text-2xl font-bold text-zinc-50">{season.champions.wdc.name}</p>
            {season.champions.wdc.value !== undefined ? <p className="text-amber-300">{season.champions.wdc.value} pts</p> : null}
          </div>
          <div>
            <p className="text-xs text-zinc-500">World Constructors&apos; Champion</p>
            <p className="text-2xl font-bold text-zinc-50">{season.champions.wcc.name}</p>
            {season.champions.wcc.value !== undefined ? <p className="text-amber-300">{season.champions.wcc.value} pts</p> : null}
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Season Awards</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AwardCard title="Rookie of the Year" recipient={season.awards.rookieOfYear} />
          <AwardCard title="Most Pole Positions" recipient={season.awards.mostPoles} />
          <AwardCard title="Most Wins" recipient={season.awards.mostWins} />
          <AwardCard title="Most Podiums" recipient={season.awards.mostPodiums} />
          <AwardCard title="Most Fastest Laps" recipient={season.awards.mostFastestLaps} />
          <AwardCard
            title="Fastest Pit Stop"
            recipient={season.awards.fastestPitStop ? { name: season.awards.fastestPitStop.name, value: season.awards.fastestPitStop.value } : null}
          />
        </div>
      </section>

      {!season.canViewFullDetails ? (
        <section className="rounded border border-zinc-700 bg-[#1b232e] p-4">
          <h3 className="text-lg font-semibold">Summary Archive</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Full stats are retained for the most recent {fullDetailLimit} completed seasons. Champions and awards remain available for this season.
          </p>
        </section>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            {season.driverStandings ? (
              <StandingsTable title="Final Drivers' Standings" rows={season.driverStandings} />
            ) : (
              <section className="rounded border border-zinc-700 bg-[#1b232e] p-4">
                <h3 className="text-lg font-semibold">Final Drivers&apos; Standings</h3>
                <p className="mt-2 text-sm text-zinc-500">Driver standings are not available for this archived save.</p>
              </section>
            )}
            {season.constructorStandings ? (
              <StandingsTable title="Final Constructors' Standings" rows={season.constructorStandings} />
            ) : (
              <section className="rounded border border-zinc-700 bg-[#1b232e] p-4">
                <h3 className="text-lg font-semibold">Final Constructors&apos; Standings</h3>
                <p className="mt-2 text-sm text-zinc-500">Constructor standings are not available for this archived save.</p>
              </section>
            )}
          </div>
          <TeamSnapshotsPanel season={season} />
          <RacePodiumsPanel season={season} />
        </>
      )}

      <RetirementsPanel season={season} />
    </div>
  );
}

function HistoryBody() {
  const [view] = useState<HistoryView | null>(() => {
    const result = simulationSession.getHistory();
    return result.ok ? result.data : null;
  });
  const [selectedYear, setSelectedYear] = useState(() => view?.seasons[0]?.seasonYear ?? 0);

  if (!view) return <p className="text-zinc-400">Loading history...</p>;
  if (view.seasons.length === 0) {
    return (
      <section className="rounded border border-zinc-700 bg-[#1b232e] p-6">
        <h3 className="text-lg font-semibold">No completed seasons yet</h3>
        <p className="mt-2 text-sm text-zinc-500">Completed seasons will appear here after a season review is reached.</p>
      </section>
    );
  }

  const selectedSeason = view.seasons.find((season) => season.seasonYear === selectedYear) ?? view.seasons[0];

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <SeasonList seasons={view.seasons} selectedYear={selectedSeason.seasonYear} onSelect={setSelectedYear} />
      <SeasonDetail season={selectedSeason} fullDetailLimit={view.fullDetailLimit} />
    </div>
  );
}

function HistoryWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  return (
    <ManagementFrame saveId={saveId} activeLabel="History" title="History" subtitle="Completed seasons">
      <HistoryBody />
    </ManagementFrame>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <HistoryWithSaveId />
    </Suspense>
  );
}
