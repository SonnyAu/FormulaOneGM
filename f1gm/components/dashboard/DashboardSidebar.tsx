"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type MenuLink = {
  label: string;
  href?: string;
};

const menuSections: Array<{ label: string; links: MenuLink[] }> = [
  {
    label: "League",
    links: [
      { label: "Standings", href: "/standings" },
      { label: "Calendar", href: "/calendar" },
      { label: "Race Weekend", href: "/race-weekend" },
      { label: "Results", href: "/results" },
      { label: "Regulations" },
      { label: "News Feed" },
    ],
  },
  {
    label: "Team",
    links: [
      { label: "Roster" },
      { label: "Finances", href: "/finances" },
      { label: "Factory", href: "/factory" },
      { label: "R&D", href: "/rd" },
      { label: "Inbox" },
    ],
  },
  {
    label: "Drivers",
    links: [{ label: "Contracts" }, { label: "Scouting" }, { label: "Transfer List" }, { label: "Academy" }],
  },
  {
    label: "Stats",
    links: [{ label: "Race Pace" }, { label: "Qualifying" }, { label: "Pit Stops" }, { label: "Reliability" }, { label: "Car Comparison" }],
  },
];

type DashboardSidebarProps = {
  activeLabel?: string;
};

export function DashboardSidebar({ activeLabel = "Dashboard" }: DashboardSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const saveId = searchParams.get("saveId");

  const withSave = (href: string) => (saveId ? `${href}?saveId=${saveId}` : href);

  return (
    <div className="h-full min-h-[calc(100vh-44px)] p-3">
      <Link
        href={withSave("/dashboard")}
        className="ui-interactive block rounded bg-cyan-950/50 px-3 py-2 text-sm font-semibold tracking-wide text-cyan-100 hover:bg-cyan-900/50"
      >
        {activeLabel}
      </Link>
      <div className="mt-4 space-y-5">
        {menuSections.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">▾ {section.label}</p>
            <ul className="space-y-1">
              {section.links.map((link) => {
                const isActive = link.href ? pathname === link.href : false;
                if (!link.href) {
                  return (
                    <li key={link.label}>
                      <span
                        className="block w-full cursor-not-allowed rounded px-2.5 py-1.5 text-left text-sm text-zinc-600"
                        title="Coming soon"
                      >
                        {link.label}
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={link.label}>
                    <Link
                      href={withSave(link.href)}
                      className={
                        isActive
                          ? "block w-full rounded bg-zinc-700/60 px-2.5 py-1.5 text-left text-sm font-medium text-white"
                          : "ui-interactive block w-full rounded px-2.5 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700/40 hover:text-white"
                      }
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
