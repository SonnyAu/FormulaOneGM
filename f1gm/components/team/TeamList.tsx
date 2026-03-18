"use client";

import { driverMap } from "@/data/drivers";
import { teams } from "@/data/teams";
import { TeamCard } from "@/components/team/TeamCard";

type TeamListProps = {
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
};

export function TeamList({ selectedTeamId, onSelectTeam }: TeamListProps) {
  return (
    <div className="space-y-3">
      {teams.map((team) => {
        const resolvedDrivers = team.driverIds
          .map((driverId) => driverMap.get(driverId))
          .filter((driver): driver is NonNullable<typeof driver> => driver !== undefined);

        return (
          <TeamCard
            key={team.id}
            team={team}
            drivers={resolvedDrivers}
            selected={selectedTeamId === team.id}
            onSelect={onSelectTeam}
          />
        );
      })}
    </div>
  );
}
