const menuSections = [
  {
    label: "League",
    links: ["Standings", "Calendar", "Race Weekend", "Finances", "Regulations", "News Feed"],
  },
  {
    label: "Team",
    links: ["Roster", "Schedule", "Finances", "Factory", "R&D", "Inbox"],
  },
  {
    label: "Drivers",
    links: ["Contracts", "Scouting", "Transfer List", "Academy"],
  },
  {
    label: "Stats",
    links: ["Race Pace", "Qualifying", "Pit Stops", "Reliability", "Car Comparison"],
  },
];

type DashboardSidebarProps = {
  activeLabel?: string;
};

export function DashboardSidebar({ activeLabel = "Dashboard" }: DashboardSidebarProps) {
  return (
    <div className="h-full min-h-[calc(100vh-44px)] p-3">
      <p className="rounded bg-cyan-950/50 px-3 py-2 text-sm font-semibold tracking-wide text-cyan-100">{activeLabel}</p>
      <div className="mt-4 space-y-5">
        {menuSections.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">▾ {section.label}</p>
            <ul className="space-y-1">
              {section.links.map((link) => (
                <li key={link}>
                  <button
                    type="button"
                    className="ui-interactive block w-full rounded px-2.5 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700/40 hover:text-white"
                  >
                    {link}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
