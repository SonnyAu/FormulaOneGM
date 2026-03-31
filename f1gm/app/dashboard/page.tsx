import Link from "next/link";
import { driverMap } from "@/data/drivers";
import { teams } from "@/data/teams";

type DashboardSearchParams = {
  teamId?: string;
  entrant?: string;
  constructor?: string;
  chassis?: string;
  powerUnit?: string;
  driverOne?: string;
  driverTwo?: string;
};

const seasonYear = 2026;

function formatOrdinal(value: number) {
  const teen = value % 100;
  if (teen >= 11 && teen <= 13) {
    return `${value}th`;
  }

  const remainder = value % 10;
  if (remainder === 1) {
    return `${value}st`;
  }
  if (remainder === 2) {
    return `${value}nd`;
  }
  if (remainder === 3) {
    return `${value}rd`;
  }

  return `${value}th`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const params = await searchParams;
  const selectedTeam = teams.find((team) => team.id === params.teamId) ?? null;

  const entrant = selectedTeam?.entrant ?? params.entrant ?? "Custom Entry";
  const constructor = selectedTeam?.constructor ?? params.constructor ?? "Independent";
  const chassis = selectedTeam?.chassis ?? params.chassis ?? "TBD";
  const powerUnit = selectedTeam?.power_unit ?? params.powerUnit ?? "TBD";
  const drivers = selectedTeam
    ? selectedTeam.driverIds
        .map((driverId) => driverMap.get(driverId))
        .filter((driver): driver is NonNullable<typeof driver> => driver !== undefined)
        .map((driver) => driver.name)
    : [params.driverOne, params.driverTwo].filter((driver): driver is string => Boolean(driver));

  const standings = teams.map((team, index) => ({
    position: index + 1,
    team: team.constructor,
    points: Math.max(0, 215 - index * 18),
  }));

  const selectedStanding =
    standings.find((standing) => standing.team === constructor) ??
    standings[standings.length - 1];

  const raceRecord = selectedTeam ? "0 podiums · 0 wins" : "Debut season";
  const winsPodiumsRecord = "0-0";

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">
              {seasonYear} preseason · Idle
            </p>
            <h1 className="mt-1 text-3xl font-semibold">{constructor} Dashboard</h1>
          </div>
          <Link
            href="/team-setup"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
          >
            Switch Team
          </Link>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr_1.2fr]">
          <article className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="text-lg font-semibold">Constructors Standings</h2>
            <table className="mt-3 w-full text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="text-left font-medium">Pos</th>
                  <th className="text-left font-medium">Team</th>
                  <th className="text-right font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((standing) => (
                  <tr
                    key={standing.team}
                    className={`border-t border-zinc-800 ${
                      standing.team === constructor ? "bg-cyan-900/30" : ""
                    }`}
                  >
                    <td className="py-1.5">{standing.position}</td>
                    <td className="py-1.5">{standing.team}</td>
                    <td className="py-1.5 text-right">{standing.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Wins-Podiums</p>
              <p className="text-5xl font-semibold">{winsPodiumsRecord}</p>
              <p className="text-2xl text-zinc-300">{formatOrdinal(selectedStanding.position)} in standings</p>
            </div>

            <div className="space-y-1 border-t border-zinc-800 pt-3 text-left text-sm">
              <h3 className="text-lg font-semibold">Team Snapshot</h3>
              <p>
                <span className="text-zinc-500">Entrant:</span> {entrant}
              </p>
              <p>
                <span className="text-zinc-500">Chassis:</span> {chassis}
              </p>
              <p>
                <span className="text-zinc-500">Power Unit:</span> {powerUnit}
              </p>
              <p>
                <span className="text-zinc-500">Record:</span> {raceRecord}
              </p>
            </div>

            <div className="space-y-1 border-t border-zinc-800 pt-3 text-left text-sm">
              <h3 className="text-lg font-semibold">Driver Lineup</h3>
              {drivers.length > 0 ? (
                <ul className="space-y-1">
                  {drivers.map((driver) => (
                    <li key={driver}>{driver}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-zinc-400">No drivers set yet.</p>
              )}
            </div>
          </article>

          <article className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="text-lg font-semibold">League Headlines</h2>
            <div className="mt-3 space-y-2 rounded-md border border-zinc-700 bg-zinc-900 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-cyan-300">{constructor}</p>
                <span className="rounded border border-zinc-600 px-2 py-0.5 text-xs text-zinc-300">
                  New Save
                </span>
              </div>
              <p className="text-sm text-zinc-300">
                Welcome to your new garage. Make your staffing and development calls to prepare for race one.
              </p>
            </div>
            <div className="mt-4 space-y-1 text-sm text-zinc-400">
              <p>› Car development update due in 5 days</p>
              <p>› Sponsor objective: Score points in first 3 races</p>
              <p>› Regulations vote scheduled this month</p>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
