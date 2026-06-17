"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ManagementFrame, money } from "@/components/management/ManagementFrame";
import { simulationSession, type SponsorDealPreview, type SponsorMarketStatus, type SponsorRenewalRow } from "@/lib/sim/session";

const SPONSOR_TERM_OPTIONS = [3, 4, 5];

function readRenewals(): SponsorRenewalRow[] {
  const result = simulationSession.getSponsorRenewals();
  return result.ok ? result.data : [];
}

function readMarketStatus(): SponsorMarketStatus {
  const result = simulationSession.getSponsorMarketStatus();
  return result.ok ? result.data : { market: [], slotsFull: false, nextSeason: 0 };
}

function SponsorTargetPreview({ preview }: { preview: SponsorDealPreview | null }) {
  if (!preview) return <p className="text-sm text-zinc-500">Target preview unavailable.</p>;
  return (
    <div className="rounded border border-zinc-700 bg-[#222a35] p-3 text-sm">
      <p className="text-zinc-400">{preview.termYears}-year deal expectations</p>
      <p className="mt-1 text-zinc-200">{preview.target.description}</p>
      <p className="mt-2 text-xs text-zinc-500">
        Team anchor P{preview.teamAnchor} | Prestige cap P{preview.prestigeCap} or better
      </p>
    </div>
  );
}

function SponsorsBody({ saveId }: { saveId: string }) {
  const router = useRouter();
  const [renewals, setRenewals] = useState<SponsorRenewalRow[]>(readRenewals);
  const [marketStatus, setMarketStatus] = useState<SponsorMarketStatus>(readMarketStatus);
  const market = marketStatus.market;
  const [message, setMessage] = useState<string | null>(null);
  const [renewTerms, setRenewTerms] = useState<Record<string, number>>({});
  const [marketTerms, setMarketTerms] = useState<Record<string, number>>({});

  const refresh = () => {
    setRenewals(readRenewals());
    setMarketStatus(readMarketStatus());
  };

  const renewTermFor = (contractId: string) => renewTerms[contractId] ?? 3;
  const marketTermFor = (sponsorId: string) => marketTerms[sponsorId] ?? 3;

  const renewPreview = useMemo(() => {
    const map = new Map<string, SponsorDealPreview>();
    for (const row of renewals) {
      const termYears = renewTerms[row.contract.id] ?? 3;
      const result = simulationSession.previewSponsorRenew(row.contract.id, termYears);
      if (result.ok) map.set(row.contract.id, result.data);
    }
    return map;
  }, [renewals, renewTerms]);

  const marketPreview = useMemo(() => {
    const map = new Map<string, SponsorDealPreview>();
    for (const sponsor of market) {
      const termYears = marketTerms[sponsor.sponsorId] ?? 3;
      const result = simulationSession.previewSponsorSign(sponsor.sponsorId, termYears);
      if (result.ok) map.set(sponsor.sponsorId, result.data);
    }
    return map;
  }, [market, marketTerms]);

  const renew = (contractId: string) => {
    const result = simulationSession.renewSponsor(contractId, renewTermFor(contractId));
    setMessage(result.ok ? `Sponsor renewed for ${renewTermFor(contractId)} seasons.` : result.error);
    refresh();
  };

  const sign = (sponsorId: string) => {
    const result = simulationSession.signSponsor(sponsorId, marketTermFor(sponsorId));
    setMessage(result.ok ? `Sponsor signed for ${marketTermFor(sponsorId)} seasons.` : result.error);
    refresh();
  };

  const continueNext = () => {
    const result = simulationSession.completeOffseasonStep("resign-sponsors");
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    router.push(`/offseason/technical-review?saveId=${saveId}`);
  };

  return (
    <div className="space-y-5">
      {message ? <p className="rounded border border-cyan-800 bg-cyan-950/30 px-3 py-2 text-sm text-cyan-100">{message}</p> : null}

      <section>
        <h3 className="mb-3 text-lg font-semibold text-zinc-100">Expiring Sponsors</h3>
        {renewals.length === 0 ? (
          <p className="rounded border border-zinc-700 bg-[#1b232e] p-4 text-sm text-zinc-400">No sponsor contracts require renewal.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {renewals.map((row) => (
              <article key={row.contract.id} className="rounded border border-zinc-700 bg-[#1b232e] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500 capitalize">{row.contract.category}</p>
                    <h4 className="text-lg font-semibold text-zinc-50">{row.contract.titleName ?? row.contract.name}</h4>
                    <p className="text-sm text-zinc-400">{money.format(row.contract.annualValue)} annual value</p>
                  </div>
                  <span className={row.passed ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-red-300"}>
                    {row.passed ? "Eligible" : "Target missed"}
                  </span>
                </div>
                <div className="mt-3 rounded border border-zinc-700 bg-[#222a35] p-3 text-sm">
                  <p className="text-zinc-300">{row.target.description}</p>
                  <p className="mt-2 text-zinc-500">
                    Actual: P{row.actual.constructorPosition}, {row.actual.points} pts, {row.actual.podiums} podiums, {row.actual.wins} wins
                  </p>
                </div>
                <label className="mt-3 block text-sm text-zinc-300">
                  Renewal term
                  <select
                    value={renewTermFor(row.contract.id)}
                    onChange={(event) =>
                      setRenewTerms((current) => ({ ...current, [row.contract.id]: Number(event.target.value) }))
                    }
                    className="mt-1 w-full rounded border border-zinc-700 bg-[#222a35] px-3 py-2 text-zinc-100"
                  >
                    {SPONSOR_TERM_OPTIONS.map((years) => (
                      <option key={years} value={years}>{years} years</option>
                    ))}
                  </select>
                </label>
                <div className="mt-3">
                  <SponsorTargetPreview preview={renewPreview.get(row.contract.id) ?? null} />
                </div>
                <button
                  type="button"
                  onClick={() => renew(row.contract.id)}
                  disabled={!row.passed}
                  className="ui-interactive mt-3 rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Re-sign sponsor
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-zinc-100">Sponsor Market</h3>
        <p className="mb-3 text-sm text-zinc-400">
          Deals run 3–5 years. Longer terms bring more stability but raise expectations based on your team&apos;s current prestige.
        </p>
        {market.length === 0 ? (
          <p className="rounded border border-zinc-700 bg-[#1b232e] p-4 text-sm text-zinc-400">
            {marketStatus.slotsFull
              ? "Every sponsor category is covered for next season."
              : "No sponsors are available — remaining brands are tied to other teams."}
          </p>
        ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {market.map((sponsor) => (
            <article key={sponsor.sponsorId} className="rounded border border-zinc-700 bg-[#1b232e] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 capitalize">{sponsor.category}</p>
                  <h4 className="text-lg font-semibold text-zinc-50">{sponsor.titleName ?? sponsor.name}</h4>
                  <p className="text-sm text-zinc-400">{sponsor.name}</p>
                </div>
                <p className="text-sm font-semibold text-zinc-100">{money.format(sponsor.annualValue)}</p>
              </div>
              <label className="mt-3 block text-sm text-zinc-300">
                Contract term
                <select
                  value={marketTermFor(sponsor.sponsorId)}
                  onChange={(event) =>
                    setMarketTerms((current) => ({ ...current, [sponsor.sponsorId]: Number(event.target.value) }))
                  }
                  className="mt-1 w-full rounded border border-zinc-700 bg-[#222a35] px-3 py-2 text-zinc-100"
                >
                  {SPONSOR_TERM_OPTIONS.map((years) => (
                    <option key={years} value={years}>{years} years</option>
                  ))}
                </select>
              </label>
              <div className="mt-3">
                <SponsorTargetPreview preview={marketPreview.get(sponsor.sponsorId) ?? null} />
              </div>
              <button
                type="button"
                onClick={() => sign(sponsor.sponsorId)}
                className="ui-interactive mt-3 rounded border border-cyan-700 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-950"
              >
                Sign sponsor
              </button>
            </article>
          ))}
        </div>
        )}
      </section>

      <button
        type="button"
        onClick={continueNext}
        className="ui-interactive rounded bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
      >
        Continue to technical review
      </button>
    </div>
  );
}

function SponsorsWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  return (
    <ManagementFrame saveId={saveId} activeLabel="Season Review" title="Re-sign Sponsors" subtitle="Renewal targets and sponsor market">
      {saveId ? <SponsorsBody saveId={saveId} /> : null}
    </ManagementFrame>
  );
}

export default function SponsorsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <SponsorsWithSaveId />
    </Suspense>
  );
}
