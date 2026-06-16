"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ManagementFrame } from "@/components/management/ManagementFrame";
import { simulationSession } from "@/lib/sim/session";
import { OwnerConfidenceReview, OwnerRiskTier, OwnerWarningLevel } from "@/types/sim";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const riskLabels: Record<OwnerRiskTier, string> = {
  secure: "Secure",
  watched: "Watched",
  "at-risk": "At Risk",
  "final-warning": "Final Warning",
};

const warningLabels: Record<OwnerWarningLevel, string> = {
  none: "No warning",
  watched: "Board watch",
  "at-risk": "At risk",
  "final-warning": "Final warning",
  fired: "Fired",
};

function toneClass(tone: "good" | "neutral" | "bad") {
  if (tone === "good") return "border-emerald-700/70 bg-emerald-950/25 text-emerald-200";
  if (tone === "bad") return "border-red-700/70 bg-red-950/25 text-red-200";
  return "border-zinc-700 bg-[#1b232e] text-zinc-200";
}

function riskClass(riskTier: OwnerRiskTier, wasFired: boolean) {
  if (wasFired || riskTier === "final-warning") return "text-red-300";
  if (riskTier === "at-risk") return "text-orange-300";
  if (riskTier === "watched") return "text-amber-300";
  return "text-emerald-300";
}

function confidenceBarClass(score: number) {
  if (score >= 72) return "bg-emerald-500";
  if (score >= 55) return "bg-amber-400";
  if (score >= 38) return "bg-orange-500";
  return "bg-red-500";
}

function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded border border-zinc-700 bg-[#1b232e] p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-50">{value}</p>
      {detail ? <p className="mt-1 text-sm text-zinc-400">{detail}</p> : null}
    </div>
  );
}

function OwnerConfidenceBody({ saveId }: { saveId: string }) {
  const router = useRouter();
  const [review, setReview] = useState<OwnerConfidenceReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void simulationSession.getOwnerConfidenceReview().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setReview(result.data);
      } else {
        setError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onContinue = useCallback(() => {
    setBusy(true);
    setError(null);
    const result = simulationSession.completeOffseasonStep("owner-confidence");
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/offseason/resign-drivers?saveId=${saveId}`);
  }, [router, saveId]);

  if (error && !review) {
    return (
      <div className="rounded border border-red-800 bg-red-950/30 p-4 text-red-200">
        <p>{error}</p>
        <Link href={`/dashboard?saveId=${saveId}`} className="mt-3 inline-block text-sm text-red-100 underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!review) return <p className="text-zinc-400">Loading board review...</p>;

  const scoreDelta = review.confidenceScore - review.previousConfidenceScore;
  const scoreDeltaLabel = `${scoreDelta >= 0 ? "+" : ""}${scoreDelta}`;

  return (
    <div className="space-y-6">
      <section className="rounded border border-zinc-700 bg-[#1b232e] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-zinc-500">{review.seasonYear} Owner Confidence</p>
            <h2 className="mt-2 text-3xl font-bold text-zinc-50">{review.teamName}</h2>
            <p className="mt-1 text-sm text-zinc-400">{review.expectationProfile.roleLabel}</p>
          </div>
          <div className="text-left md:text-right">
            <p className={`text-3xl font-bold ${riskClass(review.riskTier, review.wasFired)}`}>
              {review.wasFired ? "Fired" : riskLabels[review.riskTier]}
            </p>
            <p className="text-sm text-zinc-400">{warningLabels[review.warningLevel]}</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-zinc-400">Board confidence</span>
            <span className="font-semibold text-zinc-100">{review.confidenceScore}/100</span>
          </div>
          <div className="h-3 overflow-hidden rounded bg-zinc-800">
            <div className={`h-full ${confidenceBarClass(review.confidenceScore)}`} style={{ width: `${review.confidenceScore}%` }} />
          </div>
          <p className="mt-2 text-sm text-zinc-400">Change from previous review: {scoreDeltaLabel}</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Constructor result"
          value={`P${review.seasonResult.constructorPosition}`}
          detail={`${review.seasonResult.points} pts, ${review.seasonResult.wins} wins`}
        />
        <StatCard
          label="Board target"
          value={`P${review.expectationProfile.expectedConstructorPosition}`}
          detail={`Minimum acceptable: P${review.expectationProfile.minimumAcceptablePosition}`}
        />
        <StatCard
          label="Prestige rating"
          value={`${review.expectationProfile.prestigeRating}/100`}
          detail="Brand and historical pressure"
        />
        <StatCard
          label="Role-aware rating"
          value={`${review.expectationProfile.roleAwareRating}/100`}
          detail="Team-specific ownership pressure"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded border border-zinc-700 bg-[#1b232e] p-4">
          <h3 className="mb-3 text-lg font-semibold">Board Feedback</h3>
          <div className="space-y-3">
            {review.reasons.map((reason) => (
              <div key={`${reason.label}-${reason.detail}`} className={`rounded border p-3 ${toneClass(reason.tone)}`}>
                <p className="font-semibold">{reason.label}</p>
                <p className="mt-1 text-sm opacity-90">{reason.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-zinc-700 bg-[#1b232e] p-4">
          <h3 className="mb-3 text-lg font-semibold">Financial Review</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-zinc-400">Ending budget</dt>
              <dd className="font-medium text-zinc-100">{money.format(review.seasonResult.budget)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-zinc-400">Budget movement</dt>
              <dd className={review.seasonResult.budgetDelta >= 0 ? "font-medium text-emerald-300" : "font-medium text-red-300"}>
                {money.format(review.seasonResult.budgetDelta)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-zinc-400">Low-confidence streak</dt>
              <dd className="font-medium text-zinc-100">{review.consecutiveLowConfidenceSeasons}</dd>
            </div>
          </dl>
        </div>
      </section>

      {review.wasFired ? (
        <section className="rounded border border-red-800 bg-red-950/30 p-4 text-red-100">
          <h3 className="font-semibold">The owners have ended your tenure.</h3>
          <p className="mt-1 text-sm text-red-200">The save remains available for review, but this career cannot advance to another season as this team principal.</p>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onContinue}
          disabled={busy || review.wasFired}
          className="ui-interactive rounded bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to driver contracts
        </button>
        <Link href={`/season-review?saveId=${saveId}`} className="ui-interactive rounded border border-zinc-600 px-4 py-2 text-sm text-zinc-200">
          Back to season review
        </Link>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}

function OwnerConfidenceWithSaveId() {
  const saveId = useSearchParams().get("saveId");
  if (!saveId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#151a23] text-zinc-200">
        <p>Missing save selection.</p>
      </main>
    );
  }
  return (
    <ManagementFrame saveId={saveId} activeLabel="Season Review" title="Owner Confidence" subtitle="Board confidence & job security">
      <OwnerConfidenceBody saveId={saveId} />
    </ManagementFrame>
  );
}

export default function OwnerConfidencePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#151a23]" />}>
      <OwnerConfidenceWithSaveId />
    </Suspense>
  );
}
