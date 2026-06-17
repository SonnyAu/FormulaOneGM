"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/components/management/ManagementFrame";
import { type DriverMarketRow } from "@/lib/sim/driverContracts";
import { simulationSession, type DriverOfferPreview } from "@/lib/sim/session";
import type { DriverLineupRole, OffseasonStep } from "@/types/sim";

type DriverMarketScreenProps = {
  saveId: string;
  mode: "resign" | "free-agent";
};

function readRows(mode: DriverMarketScreenProps["mode"]): DriverMarketRow[] {
  const result = mode === "resign" ? simulationSession.getDriverReSignMarket() : simulationSession.getFreeAgentMarket();
  return result.ok ? result.data : [];
}

function moodClass(score: number) {
  if (score >= 75) return "text-emerald-300";
  if (score >= 58) return "text-cyan-300";
  if (score >= 40) return "text-amber-300";
  return "text-red-300";
}

function previewClass(label: DriverOfferPreview["label"]) {
  if (label === "likely") return "text-emerald-300";
  if (label === "uncertain") return "text-amber-300";
  return "text-red-300";
}

function hrefForStep(saveId: string, step: OffseasonStep) {
  if (step === "free-agent-drivers") return `/offseason/free-agents?saveId=${saveId}`;
  if (step === "resign-sponsors") return `/offseason/sponsors?saveId=${saveId}`;
  if (step === "technical-review") return `/offseason/technical-review?saveId=${saveId}`;
  return `/offseason/sponsors?saveId=${saveId}`;
}

function stepForMode(mode: DriverMarketScreenProps["mode"]): OffseasonStep {
  return mode === "resign" ? "resign-drivers" : "free-agent-drivers";
}

function NegotiationModal({
  row,
  onClose,
  onSigned,
}: {
  row: DriverMarketRow;
  onClose: () => void;
  onSigned: () => void;
}) {
  const [years, setYears] = useState(row.optimalOffer?.years ?? 1);
  const [salary, setSalary] = useState(row.optimalOffer?.salary ?? row.expectedSalary);
  const [role, setRole] = useState<DriverLineupRole>(row.role);
  const [message, setMessage] = useState<string | null>(null);

  const preview = useMemo(() => {
    const result = simulationSession.previewDriverOffer(row.driverId, role, years, salary);
    return result.ok ? result.data : null;
  }, [row.driverId, role, salary, years]);

  const confirm = () => {
    const result = simulationSession.negotiateDriverContract(row.driverId, role, years, salary);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    onSigned();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="driver-negotiation-title"
        className="w-full max-w-lg rounded border border-zinc-700 bg-[#1b232e] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Negotiate Contract</p>
            <h3 id="driver-negotiation-title" className="text-xl font-semibold text-zinc-50">{row.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="ui-interactive rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
            Close
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-zinc-300">
            Role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as DriverLineupRole)}
              className="mt-1 w-full rounded border border-zinc-700 bg-[#222a35] px-3 py-2 text-zinc-100"
            >
              <option value="race">Race</option>
              <option value="reserve">Reserve</option>
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Years
            <select
              value={years}
              onChange={(event) => setYears(Number(event.target.value))}
              className="mt-1 w-full rounded border border-zinc-700 bg-[#222a35] px-3 py-2 text-zinc-100"
            >
              {row.yearOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Salary
            <select
              value={salary}
              onChange={(event) => setSalary(Number(event.target.value))}
              className="mt-1 w-full rounded border border-zinc-700 bg-[#222a35] px-3 py-2 text-zinc-100"
            >
              {row.salaryOptions.map((option) => (
                <option key={option} value={option}>{money.format(option)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 rounded border border-zinc-700 bg-[#222a35] p-3 text-sm">
          <p className="text-zinc-400">Acceptance preview</p>
          <p className={`mt-1 font-semibold capitalize ${preview ? previewClass(preview.label) : "text-zinc-400"}`}>
            {preview?.label ?? "Unavailable"}
          </p>
          <p className="mt-1 text-zinc-400">{preview?.reason ?? "No preview available."}</p>
          {preview ? <p className="mt-1 text-xs text-zinc-500">Conviction score: {preview.score}/100</p> : null}
          {preview?.factors.length ? (
            <div className="mt-3 space-y-1 border-t border-zinc-700 pt-2 text-xs text-zinc-400">
              {preview.factors.map((item) => (
                <p key={item.label}>
                  {item.label}: {item.delta >= 0 ? "+" : ""}{item.delta} | {item.detail}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        {message ? <p className="mt-3 text-sm text-red-300">{message}</p> : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={confirm}
            disabled={!preview?.accepted}
            className="ui-interactive rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm offer
          </button>
        </div>
      </section>
    </div>
  );
}

export function DriverMarketScreen({ saveId, mode }: DriverMarketScreenProps) {
  const router = useRouter();
  const [rows, setRows] = useState<DriverMarketRow[]>(() => readRows(mode));
  const [message, setMessage] = useState<string | null>(null);
  const [negotiating, setNegotiating] = useState<DriverMarketRow | null>(null);

  const refresh = () => setRows(readRows(mode));

  const sign = (row: DriverMarketRow) => {
    const result = simulationSession.signOptimalDriver(row.driverId, row.role);
    setMessage(result.ok ? `${row.name} signed.` : result.error);
    refresh();
  };

  const continueNext = () => {
    const result = simulationSession.completeOffseasonStep(stepForMode(mode));
    if (!result.ok) {
      setMessage(result.error);
      refresh();
      return;
    }
    router.push(hrefForStep(saveId, result.data.step));
  };

  return (
    <div className="space-y-4">
      {message ? <p className="rounded border border-cyan-800 bg-cyan-950/30 px-3 py-2 text-sm text-cyan-100">{message}</p> : null}

      {rows.length === 0 ? (
        <section className="rounded border border-zinc-700 bg-[#1b232e] p-5">
          <h3 className="text-lg font-semibold text-zinc-100">No required decisions</h3>
          <p className="mt-1 text-sm text-zinc-400">
            {mode === "resign" ? "No expiring player-team driver contracts need action." : "Your race seats are covered for next season."}
          </p>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <article key={row.driverId} className="rounded border border-zinc-700 bg-[#1b232e] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">{row.currentTeamName}</p>
                  <h3 className="text-lg font-semibold text-zinc-50">{row.name}</h3>
                  <p className="text-sm text-zinc-400">
                    {row.age} yrs | OVR {row.overall} | POT {row.potential} | {row.role}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold capitalize ${moodClass(row.mood.score)}`}>{row.mood.label}</p>
                  <p className="text-xs text-zinc-500">{row.mood.score}/100 mood</p>
                </div>
              </div>

              <div className="mt-3 rounded border border-zinc-700 bg-[#222a35] p-3 text-sm">
                <p className="text-zinc-400">Expected salary</p>
                <p className="font-semibold text-zinc-100">{money.format(row.expectedSalary)}</p>
                {row.optimalOffer ? (
                  <p className="mt-1 text-zinc-400">
                    Auto-sign: {row.optimalOffer.years}y / {money.format(row.optimalOffer.salary)}
                  </p>
                ) : (
                  <p className="mt-1 text-red-300">{row.signDisabledReason}</p>
                )}
              </div>

              <div className="mt-3 space-y-1 text-xs text-zinc-400">
                {row.mood.factors.slice(0, 3).map((item) => (
                  <p key={`${row.driverId}-${item.label}`}>
                    {item.label}: {item.delta >= 0 ? "+" : ""}{item.delta} | {item.detail}
                  </p>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => sign(row)}
                  disabled={!row.optimalOffer}
                  className="ui-interactive rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sign
                </button>
                <button
                  type="button"
                  onClick={() => setNegotiating(row)}
                  className="ui-interactive rounded border border-zinc-600 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-400"
                >
                  Negotiate
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={continueNext}
        className="ui-interactive rounded bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
      >
        Continue
      </button>

      {negotiating ? (
        <NegotiationModal
          row={negotiating}
          onClose={() => setNegotiating(null)}
          onSigned={() => {
            setNegotiating(null);
            setMessage(`${negotiating.name} signed.`);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}
