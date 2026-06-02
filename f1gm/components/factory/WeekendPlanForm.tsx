"use client";

import { useState } from "react";
import { SaveDifficulty, WeekendPlan } from "@/types/sim";

type Option<T extends string> = { value: T; label: string };

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="inline-flex flex-wrap gap-0.5 rounded border border-zinc-600 p-0.5 text-xs">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={
              value === option.value
                ? "rounded bg-zinc-700 px-2.5 py-1 text-zinc-100"
                : "ui-interactive rounded px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type WeekendPlanFormProps = {
  initialPlan: WeekendPlan;
  recommendation: { plan: WeekendPlan; rationale: string } | null;
  difficulty: SaveDifficulty;
  onCommit: (plan: WeekendPlan) => void;
};

export function WeekendPlanForm({ initialPlan, recommendation, difficulty, onCommit }: WeekendPlanFormProps) {
  const [plan, setPlan] = useState<WeekendPlan>(initialPlan);
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof WeekendPlan>(key: K, value: WeekendPlan[K]) => {
    setPlan((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const acceptRecommendation = () => {
    if (recommendation) {
      setPlan({ ...recommendation.plan, autoManaged: plan.autoManaged });
      setSaved(false);
    }
  };

  const commit = () => {
    onCommit(plan);
    setSaved(true);
  };

  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="mb-3 text-lg font-semibold">Weekend Development Plan</h3>

      {recommendation ? (
        <div className="mb-4 rounded border border-cyan-800/60 bg-cyan-950/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Race Engineer</p>
          <p className="mt-1 text-sm text-zinc-200">{recommendation.rationale}</p>
          <button
            type="button"
            onClick={acceptRecommendation}
            className="ui-interactive mt-2 rounded bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600"
          >
            Accept recommendation
          </button>
        </div>
      ) : null}

      <div className="space-y-3">
        <Segmented
          label="Development focus"
          value={plan.developmentFocus}
          onChange={(v) => update("developmentFocus", v)}
          options={[
            { value: "balanced", label: "Balanced" },
            { value: "aero", label: "Aero" },
            { value: "power", label: "Power" },
            { value: "mechanical", label: "Mechanical" },
            { value: "reliability", label: "Reliability" },
          ]}
        />
        <Segmented
          label="Investment"
          value={plan.investmentLevel}
          onChange={(v) => update("investmentLevel", v)}
          options={[
            { value: "save", label: "Save money" },
            { value: "steady", label: "Steady" },
            { value: "push", label: "Push hard" },
          ]}
        />
        <Segmented
          label="Facility upgrade"
          value={plan.facilityUpgrade}
          onChange={(v) => update("facilityUpgrade", v)}
          options={[
            { value: "none", label: "None" },
            { value: "factory", label: "Factory" },
            { value: "cfd", label: "CFD" },
            { value: "simulator", label: "Simulator" },
          ]}
        />
        <Segmented
          label="Sponsors"
          value={plan.sponsorRisk}
          onChange={(v) => update("sponsorRisk", v)}
          options={[
            { value: "low", label: "Play safe" },
            { value: "balanced", label: "Balanced" },
            { value: "high", label: "Chase payouts" },
          ]}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={commit}
          className="ui-interactive rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
        >
          Commit plan
        </button>
        {difficulty === "easy" ? (
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={plan.autoManaged}
              onChange={(e) => update("autoManaged", e.target.checked)}
            />
            Auto-manage factory (Easy)
          </label>
        ) : (
          <span className="text-xs text-zinc-500">Auto-manage available on Easy difficulty.</span>
        )}
        {saved ? <span className="text-xs text-emerald-300">Plan committed for the next race weekend.</span> : null}
      </div>
    </section>
  );
}
