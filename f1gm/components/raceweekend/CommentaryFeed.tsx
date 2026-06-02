import { RaceWeekendState } from "@/lib/sim/raceweekend/raceTypes";

type CommentaryFeedProps = {
  weekend: RaceWeekendState;
};

const IMPORTANCE_CLASS: Record<string, string> = {
  high: "text-amber-200",
  medium: "text-zinc-200",
  low: "text-zinc-400",
};

export function CommentaryFeed({ weekend }: CommentaryFeedProps) {
  const messages = weekend.race?.commentary ?? [];
  const recent = [...messages].slice(-40).reverse();

  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="mb-3 text-lg font-semibold">Commentary</h3>
      <div className="standings-scroll h-[28rem] space-y-1.5 overflow-y-auto pr-1 text-sm">
        {recent.length === 0 ? (
          <p className="text-zinc-500">Race not started.</p>
        ) : (
          recent.map((message) => (
            <p key={message.id} className={IMPORTANCE_CLASS[message.importance] ?? "text-zinc-300"}>
              {message.text}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
