import Link from "next/link";
import type { EventLogEntry } from "@/types/sim";

type RecordPanelProps = {
  raceRecord: string;
  championshipPos: string;
};

export function RecordPanel({ raceRecord, championshipPos }: RecordPanelProps) {
  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-5 text-center">
      <p className="text-6xl font-semibold leading-none text-zinc-100">{raceRecord}</p>
      <p className="mt-2 text-3xl leading-tight text-zinc-300">{championshipPos}</p>
    </section>
  );
}

type LinkListProps = {
  title: string;
  rows: Array<{ label: string; value?: string }>;
  footerLink?: string;
  footerHref?: string;
};

export function LinkList({ title, rows, footerLink, footerHref }: LinkListProps) {
  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="text-4xl font-semibold leading-none">{title}</h3>
      <ul className="mt-3 space-y-1.5 text-sm text-zinc-300">
        {rows.map((row) => (
          <li key={row.label} className="flex items-start justify-between gap-3">
            <span>{row.label}</span>
            {row.value ? <span className="text-zinc-100">{row.value}</span> : null}
          </li>
        ))}
      </ul>
      {footerLink && footerHref ? (
        <Link href={footerHref} className="ui-interactive mt-2 inline-block text-xs text-amber-400 hover:text-amber-300">
          » {footerLink}
        </Link>
      ) : footerLink ? (
        <p className="mt-2 text-xs text-amber-400">» {footerLink}</p>
      ) : null}
    </section>
  );
}

type HeadlinesProps = {
  teamName: string;
  headlines: EventLogEntry[];
  newsFeedHref?: string;
};

export function Headlines({ teamName, headlines, newsFeedHref }: HeadlinesProps) {
  const items = headlines.filter((e) => e.category === "news" || e.category === "race").slice(0, 4);

  return (
    <section className="ui-card rounded border border-zinc-700 bg-[#1b232e] p-4">
      <h3 className="text-4xl font-semibold leading-none">League Headlines</h3>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="overflow-hidden rounded border border-cyan-700/40">
            <p className="bg-cyan-900/40 px-3 py-1 text-sm text-cyan-200">{teamName}</p>
            <p className="px-3 py-2 text-sm text-zinc-300">Welcome to your new league. Season planning has begun.</p>
          </div>
        ) : (
          items.map((entry) => (
            <div key={entry.id} className="overflow-hidden rounded border border-zinc-700/60">
              <p className="bg-zinc-800/60 px-3 py-1 text-xs text-zinc-500">Week {entry.week}</p>
              <p className="px-3 py-2 text-sm text-zinc-300">{entry.message}</p>
            </div>
          ))
        )}
      </div>
      {newsFeedHref ? (
        <a href={newsFeedHref} className="mt-2 inline-block text-xs text-amber-400 hover:text-amber-300">
          » News Feed
        </a>
      ) : (
        <p className="mt-2 text-xs text-amber-400">» News Feed</p>
      )}
    </section>
  );
}
