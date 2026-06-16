"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ManagementFrame, money } from "@/components/management/ManagementFrame";
import { simulationSession } from "@/lib/sim/session";
import type { PowerUnitManagement, PowerUnitMarketRow } from "@/lib/sim/selectors";
import type { PowerUnitDevelopmentProgram, PowerUnitManufacturerId, PowerUnitRatings } from "@/types/sim";

function readPowerUnitManagement(): PowerUnitManagement | null {
  const result = simulationSession.getPowerUnitManagement();
  return result.ok ? result.data : null;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "neutral" }) {
  const color =
    tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : tone === "neutral" ? "text-cyan-200" : "text-zinc-100";
  return (
    <div className="rounded border border-zinc-700 bg-[#222a35] p-3">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function RatingPill({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="font-mono text-zinc-200">{Math.round(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-zinc-800">
        <div className="h-full bg-cyan-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function RatingGrid({ ratings }: { ratings: PowerUnitRatings | null }) {
  if (!ratings) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <RatingPill label="ICE" value={ratings.ice} />
      <RatingPill label="ERS" value={ratings.ers} />
      <RatingPill label="Reliability" value={ratings.reliability} />
      <RatingPill label="Integration" value={ratings.integration} />
    </div>
  );
}

function ContractOverview({ data }: { data: PowerUnitManagement }) {
  const supplier = data.currentManufacturer;
  const contract = data.currentContract;
  const status = !contract
    ? "No active contract"
    : contract.endSeason <= data.seasonYear
      ? "Final season"
      : `${data.yearsRemaining} seasons remaining`;

  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">Current Power Unit</p>
          <h3 className="mt-1 text-2xl font-semibold text-zinc-50">{supplier?.name ?? "Unassigned"}</h3>
          <p className="mt-1 text-sm text-zinc-400">{supplier?.engineName ?? "Awaiting FIA allocation"}</p>
        </div>
        <div className="text-right text-sm">
          <p className="text-zinc-400">Contract</p>
          <p className="font-semibold text-zinc-100">{status}</p>
          {data.adaptationActive ? <p className="mt-1 text-red-300">Integration penalty active</p> : null}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Annual cost" value={money.format(data.financials.annualCost)} />
        <Stat label="Annual revenue" value={money.format(data.financials.annualRevenue)} tone={data.financials.annualRevenue > 0 ? "good" : undefined} />
        <Stat label="Weekly net" value={money.format(data.financials.weeklyNet)} tone={data.financials.weeklyNet >= 0 ? "good" : "bad"} />
        <Stat label="Season" value={`${data.seasonYear}`} tone="neutral" />
      </div>
      {supplier ? (
        <div className="mt-4 rounded border border-zinc-700 bg-[#222a35] p-3">
          <RatingGrid ratings={supplier.ratings} />
        </div>
      ) : null}
    </section>
  );
}

function MarketCard({
  row,
  onSign,
}: {
  row: PowerUnitMarketRow;
  onSign: (manufacturerId: PowerUnitManufacturerId, lengthYears: number) => void;
}) {
  return (
    <div className={`rounded border p-3 ${row.isCurrentSupplier ? "border-cyan-700 bg-cyan-950/20" : "border-zinc-700 bg-[#222a35]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold text-zinc-100">{row.name}</h4>
          <p className="text-xs text-zinc-500">{row.engineName}</p>
        </div>
        <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
          {row.customerCount}/{row.customerCapacity} customers
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <RatingPill label="ICE" value={row.ratings.ice} />
        <RatingPill label="Reliability" value={row.ratings.reliability} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-zinc-400">
          {money.format(row.annualPrice)} yearly / {money.format(row.weeklyPrice)} weekly
        </span>
        {row.canSign ? (
          <div className="flex gap-1">
            {[1, 2, 3].map((years) => (
              <button
                key={years}
                type="button"
                onClick={() => onSign(row.manufacturerId, years)}
                className="ui-interactive rounded border border-cyan-700 px-2 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-950"
              >
                {years}y
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs text-zinc-500">{row.blockedReason}</span>
        )}
      </div>
    </div>
  );
}

function CustomerPanel({
  data,
  onSign,
}: {
  data: PowerUnitManagement;
  onSign: (manufacturerId: PowerUnitManufacturerId, lengthYears: number) => void;
}) {
  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Supplier Market</h3>
        {data.futureContract ? (
          <p className="text-sm text-emerald-300">
            Future deal signed for {data.futureContract.startSeason}: {data.futureContract.manufacturerId}
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {data.market.map((row) => (
          <MarketCard key={row.manufacturerId} row={row} onSign={onSign} />
        ))}
      </div>
    </section>
  );
}

function WorksPanel({
  data,
  onCommit,
}: {
  data: PowerUnitManagement;
  onCommit: (program: PowerUnitDevelopmentProgram) => void;
}) {
  const works = data.works;
  const [program, setProgram] = useState<PowerUnitDevelopmentProgram>(
    works?.pendingProgram ?? { level: "standard", focus: "balanced" },
  );

  if (!works) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
        <h3 className="mb-3 text-lg font-semibold">Customer Supply</h3>
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <Stat label="Customers" value={`${works.customerCount}/${works.customerCapacity}`} />
          <Stat label="Available slots" value={`${works.availableSlots}`} tone={works.availableSlots > 0 ? "good" : "bad"} />
          <Stat label="Annual revenue" value={money.format(data.financials.annualRevenue)} tone={data.financials.annualRevenue > 0 ? "good" : undefined} />
        </div>
        {works.customers.length === 0 ? (
          <p className="text-sm text-zinc-500">No customer teams currently supplied.</p>
        ) : (
          <div className="space-y-2">
            {works.customers.map((customer) => (
              <div key={customer.teamId} className="flex items-center justify-between rounded border border-zinc-700 bg-[#222a35] px-3 py-2 text-sm">
                <span className="font-medium text-zinc-100">{customer.abbreviation}</span>
                <span className="text-zinc-400">{money.format(customer.annualPrice)} through {customer.endSeason}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
        <h3 className="mb-3 text-lg font-semibold">Offseason Program</h3>
        <div className="space-y-3">
          <label className="block text-sm text-zinc-300">
            Investment
            <select
              value={program.level}
              onChange={(event) => setProgram((current) => ({ ...current, level: event.target.value as PowerUnitDevelopmentProgram["level"] }))}
              className="mt-1 w-full rounded border border-zinc-700 bg-[#222a35] px-3 py-2 text-zinc-100"
            >
              <option value="none">None ({money.format(works.developmentCosts.none)})</option>
              <option value="standard">Standard ({money.format(works.developmentCosts.standard)})</option>
              <option value="aggressive">Aggressive ({money.format(works.developmentCosts.aggressive)})</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-300">
            Focus
            <select
              value={program.focus}
              onChange={(event) => setProgram((current) => ({ ...current, focus: event.target.value as PowerUnitDevelopmentProgram["focus"] }))}
              className="mt-1 w-full rounded border border-zinc-700 bg-[#222a35] px-3 py-2 text-zinc-100"
            >
              <option value="balanced">Balanced</option>
              <option value="ice">ICE</option>
              <option value="ers">ERS</option>
              <option value="reliability">Reliability</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => onCommit(program)}
            className="ui-interactive w-full rounded border border-cyan-700 bg-cyan-950/40 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-900/50"
          >
            Commit Program
          </button>
          {works.pendingProgram ? (
            <p className="text-xs text-emerald-300">
              Pending: {works.pendingProgram.level} / {works.pendingProgram.focus}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function PowerUnitBody() {
  const [data, setData] = useState<PowerUnitManagement | null>(readPowerUnitManagement);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => setData(readPowerUnitManagement());

  if (!data) return <p className="text-zinc-400">Loading power unit...</p>;

  const onCommit = (program: PowerUnitDevelopmentProgram) => {
    const result = simulationSession.commitPowerUnitDevelopmentProgram(program);
    setMessage(result.ok ? "Power unit development program committed." : result.error);
    refresh();
  };

  const onSign = (manufacturerId: PowerUnitManufacturerId, lengthYears: number) => {
    const result = simulationSession.signPlayerPowerUnitContract(manufacturerId, lengthYears);
    setMessage(result.ok ? "Future power unit contract signed." : result.error);
    refresh();
  };

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded border border-cyan-800 bg-cyan-950/30 px-4 py-3 text-sm text-cyan-100">{message}</div>
      ) : null}
      <ContractOverview data={data} />
      {data.isWorksTeam ? <WorksPanel data={data} onCommit={onCommit} /> : <CustomerPanel data={data} onSign={onSign} />}
    </div>
  );
}

function PowerUnitWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  return (
    <ManagementFrame saveId={saveId} activeLabel="Power Unit" title="Power Unit" subtitle="Supply, contracts & development">
      <PowerUnitBody />
    </ManagementFrame>
  );
}

export default function PowerUnitPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <PowerUnitWithSaveId />
    </Suspense>
  );
}
