"use client";

import { type ReactNode, useState } from "react";
import { Driver } from "@/types/f1";

export type ConstructorStanding = {
  pos: number;
  team: string;
  pts: number;
};

export type DriverStanding = {
  pos: number;
  name: string;
  team: string;
  pts: number;
};

type StandingsTableProps = {
  constructorStandings: ConstructorStanding[];
  driverStandings: DriverStanding[];
  highlightedTeam: string;
};

/** Fixed height matches ~11–12 constructor rows so Drivers view uses the same panel size. */
const STANDINGS_TABLE_BODY_HEIGHT_CLASS = "h-[25rem]";

type StandingsScrollTableProps = {
  children: ReactNode;
};

function StandingsScrollTable({ children }: StandingsScrollTableProps) {
  return (
    <div
      className={`standings-scroll ${STANDINGS_TABLE_BODY_HEIGHT_CLASS} overflow-y-auto overflow-x-auto [scrollbar-gutter:stable]`}
    >
      {children}
    </div>
  );
}

export function StandingsTable({
  constructorStandings,
  driverStandings,
  highlightedTeam,
}: StandingsTableProps) {
  const [view, setView] = useState<"constructors" | "drivers">(
    "constructors",
  );

  const theadStickyClass =
    "sticky top-0 z-[1] bg-[#1b232e] shadow-[inset_0_-1px_0_0_rgb(39_39_42)]";

  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">
            {view === "constructors" ? "Constructors" : "Drivers"}
          </h3>
          <div
            className="inline-flex rounded border border-zinc-600 p-0.5 text-xs"
            role="tablist"
            aria-label="Standings view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === "constructors"}
              className={
                view === "constructors"
                  ? "ui-tab rounded bg-zinc-700 px-2.5 py-1 text-zinc-100"
                  : "ui-tab ui-interactive rounded px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
              }
              onClick={() => setView("constructors")}
            >
              Constructors
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "drivers"}
              className={
                view === "drivers"
                  ? "ui-tab rounded bg-zinc-700 px-2.5 py-1 text-zinc-100"
                  : "ui-tab ui-interactive rounded px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
              }
              onClick={() => setView("drivers")}
            >
              Drivers
            </button>
          </div>
        </div>
        <span className="text-xs text-amber-400">» Full standings</span>
      </div>
      {view === "constructors" ? (
        <StandingsScrollTable>
          <table className="w-full text-sm">
            <thead className={theadStickyClass}>
              <tr className="text-left text-zinc-500">
                <th className="pb-1">#</th>
                <th className="pb-1">Team</th>
                <th className="pb-1 text-right">PTS</th>
              </tr>
            </thead>
            <tbody>
              {constructorStandings.map((row) => (
                <tr
                  key={row.team}
                  className={
                    row.team === highlightedTeam
                      ? "bg-cyan-900/30 text-cyan-200"
                      : "text-zinc-300"
                  }
                >
                  <td className="border-t border-zinc-800 py-1.5">{row.pos}</td>
                  <td className="border-t border-zinc-800 py-1.5">{row.team}</td>
                  <td className="border-t border-zinc-800 py-1.5 text-right">
                    {row.pts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </StandingsScrollTable>
      ) : (
        <StandingsScrollTable>
          <table className="w-full text-sm">
            <thead className={theadStickyClass}>
              <tr className="text-left text-zinc-500">
                <th className="pb-1">#</th>
                <th className="pb-1">Driver</th>
                <th className="pb-1">Team</th>
                <th className="pb-1 text-right">PTS</th>
              </tr>
            </thead>
            <tbody>
              {driverStandings.map((row) => (
                <tr
                  key={`${row.team}-${row.name}`}
                  className={
                    row.team === highlightedTeam
                      ? "bg-cyan-900/30 text-cyan-200"
                      : "text-zinc-300"
                  }
                >
                  <td className="border-t border-zinc-800 py-1.5">{row.pos}</td>
                  <td className="border-t border-zinc-800 py-1.5">{row.name}</td>
                  <td className="border-t border-zinc-800 py-1.5">{row.team}</td>
                  <td className="border-t border-zinc-800 py-1.5 text-right">
                    {row.pts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </StandingsScrollTable>
      )}
    </section>
  );
}

type DriverLineupTableProps = {
  drivers: Driver[];
};

export function DriverLineupTable({ drivers }: DriverLineupTableProps) {
  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="text-3xl font-semibold">Starting Lineup</h3>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="pb-1">No</th>
            <th className="pb-1">Name</th>
            <th className="pb-1">Role</th>
            <th className="pb-1">Nationality</th>
            <th className="pb-1 text-right">Contract</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((driver, idx) => (
            <tr key={driver.id} className="text-zinc-300">
              <td className="border-t border-zinc-800 py-1.5">
                #{driver.number}
              </td>
              <td className="border-t border-zinc-800 py-1.5">{driver.name}</td>
              <td className="border-t border-zinc-800 py-1.5">
                {idx === 0 ? "Lead" : "Wing"}
              </td>
              <td className="border-t border-zinc-800 py-1.5">
                {driver.nationality}
              </td>
              <td className="border-t border-zinc-800 py-1.5 text-right">
                {idx === 0 ? "to 2028" : "to 2027"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-amber-400">» Full roster</p>
    </section>
  );
}
