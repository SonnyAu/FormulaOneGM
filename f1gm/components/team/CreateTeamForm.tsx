"use client";

import { FormEvent, useMemo, useState } from "react";
import { ChassisNamingPattern } from "@/types/f1";

type CustomTeamDraft = {
  constructorName: string;
  teamBase: string;
  chassisPrefix: string;
  chassisNamingPattern: ChassisNamingPattern;
  driverOne: string;
  driverTwo: string;
};

type CreateTeamFormProps = {
  seasonYear?: number;
  onCreateTeam: (team: CustomTeamDraft) => void;
};

const randomPrefixes = ["VTX", "NVA", "RSG", "TMR", "QST", "AUR"];
const randomDriverNames = [
  "Alex Mercer",
  "Noah Bennett",
  "Luca Marino",
  "Maya Ibarra",
  "Ravi Khanna",
  "Sofia Novak",
  "Ethan Vale",
  "Kai Romero",
];

function buildChassisCode(prefix: string, pattern: ChassisNamingPattern, year: number) {
  const cleanPrefix = prefix.trim().toUpperCase().slice(0, 3);
  if (!cleanPrefix) {
    return "—";
  }

  if (pattern === "year-based") {
    return `${cleanPrefix}-${year.toString().slice(-2)}`;
  }

  return `${cleanPrefix} 01`;
}

function getRandomItem(list: string[]) {
  return list[Math.floor(Math.random() * list.length)];
}

export function CreateTeamForm({ seasonYear = 2026, onCreateTeam }: CreateTeamFormProps) {
  const [constructorName, setConstructorName] = useState("");
  const [teamBase, setTeamBase] = useState("");
  const [chassisPrefix, setChassisPrefix] = useState("");
  const [chassisNamingPattern, setChassisNamingPattern] =
    useState<ChassisNamingPattern>("year-based");
  const [driverOne, setDriverOne] = useState("");
  const [driverTwo, setDriverTwo] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const chassisPreview = useMemo(
    () => buildChassisCode(chassisPrefix, chassisNamingPattern, seasonYear),
    [chassisNamingPattern, chassisPrefix, seasonYear],
  );

  const onRandomPrefix = () => {
    setChassisPrefix(getRandomItem(randomPrefixes));
  };

  const onRandomDrivers = () => {
    const first = getRandomItem(randomDriverNames);
    let second = getRandomItem(randomDriverNames);

    while (second === first) {
      second = getRandomItem(randomDriverNames);
    }

    setDriverOne(first);
    setDriverTwo(second);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const draft: CustomTeamDraft = {
      constructorName: constructorName.trim(),
      teamBase: teamBase.trim(),
      chassisPrefix: chassisPrefix.trim().toUpperCase().slice(0, 3),
      chassisNamingPattern,
      driverOne: driverOne.trim(),
      driverTwo: driverTwo.trim(),
    };

    if (
      !draft.constructorName ||
      !draft.teamBase ||
      !draft.chassisPrefix ||
      !draft.driverOne ||
      !draft.driverTwo
    ) {
      setMessage("Please complete every field before creating a team.");
      return;
    }

    onCreateTeam(draft);
    setMessage(`Custom team '${draft.constructorName}' is ready for the ${seasonYear} grid.`);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-lg border border-zinc-800 bg-zinc-950 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-zinc-300">
          <span className="text-zinc-400">Constructor Name</span>
          <input
            value={constructorName}
            onChange={(event) => setConstructorName(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none transition focus:border-red-500"
            placeholder="Nova Racing"
          />
        </label>

        <label className="space-y-2 text-sm text-zinc-300">
          <span className="text-zinc-400">Team Base</span>
          <input
            value={teamBase}
            onChange={(event) => setTeamBase(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none transition focus:border-red-500"
            placeholder="Silverstone, UK"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="space-y-2 text-sm text-zinc-300">
          <span className="text-zinc-400">Chassis Code Prefix (max 3 letters)</span>
          <input
            value={chassisPrefix}
            onChange={(event) => setChassisPrefix(event.target.value.replace(/[^a-z]/gi, "").slice(0, 3))}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 uppercase text-zinc-100 outline-none transition focus:border-red-500"
            placeholder="NVR"
            maxLength={3}
          />
        </label>

        <button
          type="button"
          onClick={onRandomPrefix}
          className="self-end rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 transition hover:border-zinc-600"
        >
          Random Prefix
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-zinc-400">Chassis Naming Pattern</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setChassisNamingPattern("year-based")}
            className={`rounded-md border px-4 py-2 text-sm transition ${
              chassisNamingPattern === "year-based"
                ? "border-red-500 bg-red-950/50 text-red-200"
                : "border-zinc-700 bg-zinc-900 text-zinc-200"
            }`}
          >
            Year-based (SF-26)
          </button>
          <button
            type="button"
            onClick={() => setChassisNamingPattern("iteration-based")}
            className={`rounded-md border px-4 py-2 text-sm transition ${
              chassisNamingPattern === "iteration-based"
                ? "border-red-500 bg-red-950/50 text-red-200"
                : "border-zinc-700 bg-zinc-900 text-zinc-200"
            }`}
          >
            Iteration-based (VCARB 03)
          </button>
        </div>
        <p className="text-sm text-zinc-500">Preview: {chassisPreview}</p>
      </div>

      <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">Driver Lineup</p>
          <button
            type="button"
            onClick={onRandomDrivers}
            className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200 transition hover:border-zinc-600"
          >
            Random Drivers
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={driverOne}
            onChange={(event) => setDriverOne(event.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none transition focus:border-red-500"
            placeholder="Driver 1"
          />
          <input
            value={driverTwo}
            onChange={(event) => setDriverTwo(event.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none transition focus:border-red-500"
            placeholder="Driver 2"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500"
        >
          Create Team
        </button>
        {message && <p className="text-sm text-zinc-300">{message}</p>}
      </div>
    </form>
  );
}

export type { CustomTeamDraft };
