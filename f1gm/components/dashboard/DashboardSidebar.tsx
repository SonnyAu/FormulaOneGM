const menuSections = [
  {
    label: "League",
    links: ["Calendar", "Standings", "Race Results", "Finances", "Regulations", "News Feed"],
  },
  {
    label: "Team",
    links: ["Roster", "Car Development", "Pit Crew", "Sponsors", "Inbox", "GM History"],
  },
  {
    label: "Drivers",
    links: ["Lineup", "Academy", "Contracts", "Scouting", "Transfers"],
  },
  {
    label: "Performance",
    links: ["Strategy Lab", "Telemetry", "Comparisons", "Season Objectives"],
  },
];

type DashboardSidebarProps = {
  activeLabel?: string;
};

export function DashboardSidebar({ activeLabel = "Dashboard" }: DashboardSidebarProps) {
  return (
    <div className="h-full p-3">
      <p className="rounded bg-zinc-700/40 px-3 py-2 text-sm font-semibold text-zinc-100">{activeLabel}</p>
      <div className="mt-3 space-y-5">
        {menuSections.map((section) => (
          <div key={section.label}>
            <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">{section.label}</p>
            <ul className="space-y-1">
              {section.links.map((link) => (
                <li key={link}>
                  <button
                    type="button"
                    className="block w-full rounded px-2 py-1 text-left text-sm text-zinc-300 hover:bg-zinc-700/40 hover:text-white"
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
